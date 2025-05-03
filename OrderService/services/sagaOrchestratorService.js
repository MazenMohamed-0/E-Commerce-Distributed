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
        // For Stripe payments, we need to create a payment intent
        return await this.initiatePayment(order, sagaId);
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
  
  // Helper method to initiate payment based on payment method
  async initiatePayment(order, sagaId) {
    try {
      // Update order status
      order.status = 'payment_pending';
      await order.save();
      
      const correlationId = `payment-${order._id}-${Date.now()}`;
      
      // Payment method - default to stripe if not specified
      const paymentMethod = order.paymentMethod || 'stripe';
      
      logger.info('Initiating payment', { 
        sagaId, 
        orderId: order._id, 
        paymentMethod,
        amount: order.totalAmount
      });
      
      // Listen for PAYMENT_RESULT
      const paymentResultPromise = new Promise(async (resolve, reject) => {
        // Set timeout for payment request - 30 seconds
        const timeoutId = setTimeout(() => {
          reject(new Error('Payment request timed out after 30 seconds'));
        }, 30000);
        
        // Create a unique queue name for the response
        const queueName = `response-${correlationId}`;
        
        // Create temporary response queue
        await rabbitmq.createTemporaryResponseQueue('payment-events', correlationId, (message) => {
          clearTimeout(timeoutId);
          logger.info('Received payment result', { correlationId, data: message.data });
          
          if (message.data && message.data.success) {
            resolve(message.data);
          } else {
            logger.error('Invalid payment response - payment failed', { 
              correlationId, 
              responseData: JSON.stringify(message.data) 
            });
            reject(new Error(message.data?.error || 'Payment creation failed'));
          }
        });
        
        // Send PAYMENT_REQUEST event with debug info
        logger.info('Sending payment request', { 
          correlationId, 
          orderId: order._id,
          userId: order.userId,
          amount: order.totalAmount,
          paymentMethod,
          currency: 'USD' 
        });
        
        // Use the same queue name format that createTemporaryResponseQueue creates
        const replyTo = queueName;
        
        await rabbitmq.publish('payment-events', eventTypes.PAYMENT_REQUEST, {
          type: eventTypes.PAYMENT_REQUEST,
          correlationId,
          data: {
            orderId: order._id,
            userId: order.userId,
            amount: order.totalAmount,
            currency: 'USD',
            paymentMethod,
            idempotencyKey: order.idempotencyKey,
            replyTo
          }
        });
        
        logger.info('Payment request sent, waiting for response');
      });
      
      const paymentResult = await paymentResultPromise;
      logger.info('SAGA: Payment request processed', { 
        sagaId, 
        orderId: order._id,
        paymentId: paymentResult.paymentId,
        paymentMethod
      });
      
      // Initialize payment object if it doesn't exist
      if (!order.payment) {
        order.payment = {};
      }
      
      // Update order with payment info based on payment method
      if (paymentMethod === 'stripe') {
        // For Stripe, we store the payment intent ID and client secret
        if (!paymentResult.stripePaymentIntentId || !paymentResult.stripeClientSecret) {
          throw new Error('Missing Stripe payment details from Payment Service');
        }
        
        order.payment.paymentId = paymentResult.paymentId;
        order.payment.stripePaymentIntentId = paymentResult.stripePaymentIntentId;
        order.payment.stripeClientSecret = paymentResult.stripeClientSecret;
        order.payment.status = 'pending';
        
        // Set order status to payment_pending for Stripe payments
        order.status = 'payment_pending';
        
        // Log the client secret (partial) for debugging
        logger.info('Stripe payment intent created with client secret', {
          orderId: order._id,
          paymentIntentId: paymentResult.stripePaymentIntentId,
          hasClientSecret: !!paymentResult.stripeClientSecret,
          clientSecretStart: paymentResult.stripeClientSecret ? paymentResult.stripeClientSecret.substring(0, 10) + '...' : 'none'
        });
      } else if (paymentMethod === 'cash') {
        // For cash payments, just record the payment ID
        order.payment.paymentId = paymentResult.paymentId;
        order.payment.status = 'pending';
      } else {
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
      }
      
      await order.save();
      
      logger.info('Order updated with payment info', {
        orderId: order._id,
        paymentMethod,
        paymentId: order.payment.paymentId
      });
      
      // Return needed info for frontend
      return { 
        order, 
        ...paymentResult
      };
    } catch (error) {
      logger.error('SAGA: Payment initiation failed', { 
        orderId: order._id, 
        error: error.message 
      });
      
      // Update order with error
      order.status = 'failed';
      order.error = {
        message: `Payment initiation failed: ${error.message}`,
        step: 'payment_initiation',
        timestamp: new Date()
      };
      await order.save();
      
      throw error;
    }
  }

  // Method to handle order status updates asynchronously
  async processOrderAsync(order) {
    try {
      const sagaId = order.sagaId || uuidv4();
      logger.info('Processing order asynchronously', { 
        sagaId, 
        orderId: order._id,
        status: order.status,
        paymentMethod: order.paymentMethod
      });
      
      // Verify order exists and has required fields
      if (!order || !order._id) {
        throw new Error('Invalid order object');
      }
      
      // 1. Validate stock
      logger.info('Step 1: Validating stock', { orderId: order._id });
      order.status = 'stock_validating';
      await order.save();
      
      // Check if order has items
      if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
        throw new Error('Order has no items to validate');
      }
      
      // Log current items with their details
      logger.info('Order items details:', {
        orderId: order._id,
        items: order.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          sellerId: item.sellerId,
          quantity: item.quantity,
          price: item.price
        }))
      });
      
      // Map items for product validation
      const itemsForValidation = order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));
      
      logger.info('Requesting product validation', { 
        orderId: order._id, 
        products: itemsForValidation 
      });
      
      const validationResult = await orderEventHandler.requestProductValidation(itemsForValidation);
      logger.info('Validation result received', { 
        orderId: order._id,
        isValid: validationResult?.isValid,
        message: validationResult?.message
      });
      
      if (!validationResult || !validationResult.isValid) {
        // Log detailed validation results for debugging
        if (validationResult && validationResult.validationResults) {
          const invalidItems = validationResult.validationResults
            .filter(result => !result.isValid || !result.hasStock)
            .map(result => ({
              productId: result.productId,
              valid: result.isValid,
              hasStock: result.hasStock,
              currentStock: result.currentStock,
              error: result.error
            }));
            
          logger.error('Product validation failed', {
            orderId: order._id,
            invalidItems
          });
        }
        
        throw new Error(validationResult?.message || 'Product validation failed: Some products are invalid or out of stock');
      }
      
      // 2. Update order with validation results
      logger.info('Step 2: Stock validated, updating order', { orderId: order._id });
      order.status = 'stock_validated';
      await order.save();
      
      // 3. Handle payment based on method
      logger.info('Step 3: Processing payment', { 
        orderId: order._id,
        paymentMethod: order.paymentMethod 
      });
      
      if (order.paymentMethod === 'cash') {
        // Complete order for cash payments
        logger.info('Cash payment, completing order', { orderId: order._id });
        order.status = 'completed';
        
        // Ensure payment object exists
        if (!order.payment) {
          order.payment = {};
        }
        
        order.payment.status = 'completed';
        await order.save();
        
        logger.info('Publishing order completed event', { orderId: order._id });
        await orderEventHandler.publishOrderEvent(eventTypes.ORDER_COMPLETED, {
          orderId: order._id,
          userId: order.userId,
          items: order.items
        });
      } else if (order.paymentMethod === 'stripe') {
        // Create payment
        logger.info(`${order.paymentMethod} payment, initiating payment flow`, { orderId: order._id });
        try {
          const paymentResult = await this.initiatePayment(order, sagaId);
          
          logger.info('Payment initiation successful', {
            orderId: order._id,
            paymentMethod: order.paymentMethod,
            paymentId: paymentResult.paymentId
          });
          
          return order;
        } catch (error) {
          logger.error('Payment initiation failed', {
            orderId: order._id,
            error: error.message,
            errorStack: error.stack
          });
          
          // Update order with error information
          order.status = 'failed';
          order.error = {
            message: `Payment initiation failed: ${error.message}`,
            step: 'payment_initiation',
            timestamp: new Date()
          };
          await order.save();
          
          throw error;
        }
      } else {
        throw new Error(`Unsupported payment method: ${order.paymentMethod}`);
      }
      
      logger.info('Order processing complete', { 
        orderId: order._id,
        status: order.status
      });
      
      return order;
    } catch (error) {
      logger.error('Error processing order asynchronously', { 
        orderId: order?._id, 
        error: error.message,
        stack: error.stack
      });
      
      if (order) {
        // Update order with failure
        order.status = 'failed';
        order.error = {
          message: error.message,
          step: order.status || 'processing',
          timestamp: new Date()
        };
        await order.save();
      }
      
      // Don't throw the error - just log it to avoid crashing the API response
      console.error('Order processing error:', error);
      return order;
    }
  }
}

module.exports = new SagaOrchestratorService(); 