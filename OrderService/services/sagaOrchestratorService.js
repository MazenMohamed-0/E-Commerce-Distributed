const Order = require('../models/Order');
const orderEventHandler = require('../events/orderEventHandler');
const rabbitmq = require('../../shared/rabbitmq');
const eventTypes = require('../../shared/eventTypes');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'saga-orchestrator.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

class SagaOrchestratorService {
  // Entry point for starting a new order SAGA
  async startOrderSaga(userId, orderData) {
    const sagaId = uuidv4();
    logger.info('Starting new order SAGA', { sagaId, userId });
    
    let order = null;
    try {
      // 1. Validate products
      const itemsForValidation = orderData.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));
      
      logger.info('SAGA: Validating products', { sagaId, itemsForValidation });
      order = await this.createPendingOrder(userId, orderData, sagaId);
      
      // Update order status to reflect stock validation
      order.status = 'stock_validating';
      await order.save();
      
      const validationResult = await orderEventHandler.requestProductValidation(itemsForValidation);
      if (!validationResult || !validationResult.isValid) {
        throw new Error('Product validation failed: ' + (validationResult?.message || 'Unknown error'));
      }

      // 2. Update order with validated product info
      order.status = 'stock_validated';
      await order.save();
      logger.info('SAGA: Stock validated', { sagaId, orderId: order._id });

      // 3. Handle payment based on payment method
      if (order.paymentMethod === 'cash') {
        // For cash payments, we can complete the order immediately
        order.status = 'completed';
        order.payment.status = 'completed';
        await order.save();
        
        logger.info('SAGA: Cash order completed', { sagaId, orderId: order._id });
        await orderEventHandler.publishOrderEvent(eventTypes.ORDER_COMPLETED, {
          orderId: order._id,
          userId: order.userId,
          items: order.items
        });
        
        return { order };
      } else {
        // For PayPal payments, we need to create a payment
        return await this.initiatePaypalPayment(order, sagaId);
      }
    } catch (error) {
      logger.error('SAGA: Error in order SAGA', { sagaId, error: error.message });
      
      // Compensation logic
      if (order) {
        order.status = 'failed';
        order.error = {
          message: error.message,
          step: order.status,
          timestamp: new Date()
        };
        await order.save();
        
        await orderEventHandler.publishOrderEvent(eventTypes.ORDER_FAILED, {
          orderId: order._id,
          userId: order.userId,
          reason: error.message
        });
      }
      
      throw error;
    }
  }
  
  // Helper method to create a pending order
  async createPendingOrder(userId, orderData, sagaId) {
    // Calculate total amount
    const totalAmount = orderData.items.reduce(
      (total, item) => total + (item.price * item.quantity), 
      0
    );
    
    // Create new order
    const order = new Order({
      userId,
      items: orderData.items,
      totalAmount,
      status: 'pending',
      payment: {
        status: 'pending'
      },
      shippingAddress: orderData.shippingAddress,
      paymentMethod: orderData.paymentMethod,
      sagaId,
      idempotencyKey: orderData.idempotencyKey
    });
    
    await order.save();
    logger.info('SAGA: Order created', { sagaId, orderId: order._id });
    return order;
  }
  
  // Helper method to initiate PayPal payment
  async initiatePaypalPayment(order, sagaId) {
    // Update order status
    order.status = 'payment_pending';
    await order.save();
    
    const correlationId = `payment-${order._id}-${Date.now()}`;
    const replyTo = `payment.result.${correlationId}`;
    
    // Listen for PAYMENT_RESULT
    try {
      const paymentResultPromise = new Promise(async (resolve, reject) => {
        // Create temporary response queue
        await rabbitmq.createTemporaryResponseQueue('payment-events', correlationId, (message) => {
          if (message.data.status === 'created') {
            resolve(message.data);
          } else {
            reject(new Error(message.data.error || 'Payment creation failed'));
          }
        });
        
        // Send PAYMENT_REQUEST event
        await rabbitmq.publish('payment-events', eventTypes.PAYMENT_REQUEST, {
          type: eventTypes.PAYMENT_REQUEST,
          correlationId,
          data: {
            orderId: order._id,
            userId: order.userId,
            amount: order.totalAmount,
            currency: 'USD',
            idempotencyKey: order.idempotencyKey,
            replyTo
          }
        });
      });
      
      const paymentResult = await paymentResultPromise;
      logger.info('SAGA: Payment request sent, approvalUrl received', { 
        sagaId, 
        orderId: order._id,
        paymentId: paymentResult.paymentId 
      });
      
      // Update order with payment info
      order.payment.paymentId = paymentResult.paymentId;
      order.payment.paypalPaymentId = paymentResult.paymentId;
      order.payment.paymentUrl = paymentResult.approvalUrl;
      await order.save();
      
      // Return needed info for frontend redirect
      return { 
        order, 
        approvalUrl: paymentResult.approvalUrl, 
        paymentId: paymentResult.paymentId 
      };
    } catch (error) {
      logger.error('SAGA: Payment initiation failed', { sagaId, orderId: order._id, error: error.message });
      throw error;
    }
  }

  // Handle payment execution after user approval
  async handlePaymentExecution(orderId, paymentId, payerId, userId) {
    let order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    
    // Verify user owns this order
    if (order.userId !== userId) {
      throw new Error('Unauthorized access to order');
    }
    
    try {
      const correlationId = `payment-execute-${orderId}-${Date.now()}`;
      const replyTo = `payment.result.${correlationId}`;
      
      // Listen for PAYMENT_RESULT
      const paymentResultPromise = new Promise(async (resolve, reject) => {
        await rabbitmq.createTemporaryResponseQueue('payment-events', correlationId, (message) => {
          if (message.data.status === 'completed') {
            resolve(message.data);
          } else {
            reject(new Error(message.data.error || 'Payment execution failed'));
          }
        });
        
        // Send PAYMENT_EXECUTE event
        await rabbitmq.publish('payment-events', eventTypes.PAYMENT_EXECUTE, {
          type: eventTypes.PAYMENT_EXECUTE,
          correlationId,
          data: {
            paymentId,
            payerId,
            orderId,
            userId,
            replyTo
          }
        });
      });
      
      const paymentResult = await paymentResultPromise;
      
      // Update order with payment data
      const paymentData = {
        status: 'completed',
        paymentId: paymentResult.paymentId,
        paypalPaymentId: paymentId
      };
      
      order.updatePaymentInfo(paymentData);
      
      // Update order status
      order.status = 'payment_completed';
      await order.save();
      
      // Publish order completed event
      await orderEventHandler.publishOrderEvent(eventTypes.ORDER_COMPLETED, {
        orderId: order._id,
        userId: order.userId,
        items: order.items
      });
      
      return { order, payment: paymentResult };
    } catch (error) {
      logger.error('SAGA: Payment execution failed', { orderId, error: error.message });
      
      // Compensation logic - update order with failure
      const paymentData = {
        status: 'failed',
        error: error.message
      };
      
      order.updatePaymentInfo(paymentData);
      await order.save();
      
      // Publish order failed event
      await orderEventHandler.publishOrderEvent(eventTypes.ORDER_FAILED, {
        orderId: order._id,
        userId: order.userId,
        reason: error.message
      });
      
      throw error;
    }
  }
  
  // Method to handle order status updates asynchronously
  async processOrderAsync(order) {
    try {
      const sagaId = order.sagaId || uuidv4();
      logger.info('Processing order asynchronously', { sagaId, orderId: order._id });
      
      // 1. Validate stock
      order.status = 'stock_validating';
      await order.save();
      
      const itemsForValidation = order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));
      
      const validationResult = await orderEventHandler.requestProductValidation(itemsForValidation);
      if (!validationResult || !validationResult.isValid) {
        throw new Error('Product validation failed: ' + (validationResult?.message || 'Unknown error'));
      }
      
      // 2. Update order with validation results
      order.status = 'stock_validated';
      await order.save();
      
      // 3. Handle payment based on method
      if (order.paymentMethod === 'cash') {
        // Complete order for cash payments
        order.status = 'completed';
        order.payment.status = 'completed';
        await order.save();
        
        await orderEventHandler.publishOrderEvent(eventTypes.ORDER_COMPLETED, {
          orderId: order._id,
          userId: order.userId,
          items: order.items
        });
      } else {
        // Create PayPal payment
        await this.initiatePaypalPayment(order, sagaId);
      }
      
      return order;
    } catch (error) {
      logger.error('Error processing order asynchronously', { 
        orderId: order._id, 
        error: error.message 
      });
      
      // Update order with failure
      order.status = 'failed';
      order.error = {
        message: error.message,
        step: order.status || 'processing',
        timestamp: new Date()
      };
      await order.save();
      
      throw error;
    }
  }
}

module.exports = new SagaOrchestratorService(); 