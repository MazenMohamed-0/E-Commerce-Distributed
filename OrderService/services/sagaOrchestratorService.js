const Order = require('../models/Order');
const orderEventHandler = require('../events/orderEventHandler');
const rabbitmq = require('../shared/rabbitmq');
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
  // Entry point for processing an order
  async processOrderAsync(order) {
    const sagaId = order.sagaId || uuidv4();
    logger.info('Processing order', { sagaId, orderId: order._id });
    
    try {
      // 1. Validate products and stock
      const itemsForValidation = order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));
      
      logger.info('Validating products and stock', { sagaId, itemsForValidation });
      
      const validationResult = await orderEventHandler.requestProductValidation(itemsForValidation);
      if (!validationResult || !validationResult.isValid) {
        throw new Error('Product validation failed: ' + (validationResult?.message || 'Products unavailable or insufficient stock'));
      }
      
      logger.info('Products and stock validated successfully', { sagaId, orderId: order._id });
      
      // 2. Handle payment based on method
      if (order.paymentMethod === 'stripe') {
        // For Stripe, create payment intent
        logger.info('Creating Stripe payment', { sagaId, orderId: order._id });
        
        // Request payment via RabbitMQ
        const paymentResult = await this.requestPaymentCreation(order);
        
        // Update order with payment info
        order.payment = {
          status: 'pending',
          stripeClientSecret: paymentResult.stripeClientSecret,
          stripePaymentIntentId: paymentResult.stripePaymentIntentId
        };
        
        // Update order status
        order.status = 'processing';
        await order.save();
        
        logger.info('Stripe payment created', { 
          sagaId, 
          orderId: order._id,
          paymentIntent: paymentResult.stripePaymentIntentId
        });
      } else if (order.paymentMethod === 'cash') {
        // For cash payment, mark order as completed
        logger.info('Processing cash payment', { sagaId, orderId: order._id });
        
        order.status = 'completed';
        order.payment = { status: 'completed' };
        await order.save();
        
        // Notify about completed order for inventory update
        await orderEventHandler.publishOrderEvent('ORDER_COMPLETED', {
          orderId: order._id,
          userId: order.userId,
          items: order.items
        });
        
        logger.info('Cash payment completed', { sagaId, orderId: order._id });
      }
      
      return order;
    } catch (error) {
      logger.error('Order processing failed', { 
        sagaId, 
        orderId: order._id,
        error: error.message
      });
      
      // Update order to failed status
      order.status = 'failed';
      order.error = {
        message: error.message,
        step: 'order_processing',
        timestamp: new Date()
      };
      await order.save();
      
      throw error;
    }
  }
  
  // Helper to request payment creation via RabbitMQ
  async requestPaymentCreation(order) {
    const correlationId = `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Payment request timed out'));
      }, 10000);
      
      try {
        const queueName = await rabbitmq.createTemporaryResponseQueue(
          'payment-events',
          correlationId,
          (message) => {
            clearTimeout(timeoutId);
            if (message.data.error) {
              reject(new Error(message.data.error));
            } else {
              resolve(message.data);
            }
          }
        );
        
        await rabbitmq.publish('payment-events', 'payment.create.request', {
          type: 'payment.create.request',
          correlationId,
          data: {
            orderId: order._id,
            userId: order.userId,
            amount: order.totalAmount,
            paymentMethod: 'stripe',
            replyTo: `response.${correlationId}`
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }
}

module.exports = new SagaOrchestratorService(); 