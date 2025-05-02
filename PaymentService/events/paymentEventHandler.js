const rabbitmq = require('./rabbitmq');
const eventTypes = require('./eventTypes');
const paymentService = require('../services/paymentService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'payment-service-events.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

module.exports = {
  async init() {
    try {
      await rabbitmq.connect();
      // Listen for payment requests
      await rabbitmq.subscribe('payment-events', 'payment-service-queue', eventTypes.PAYMENT_REQUEST, this.handlePaymentRequest.bind(this));
      await rabbitmq.subscribe('payment-events', 'payment-service-queue', eventTypes.PAYMENT_EXECUTE, this.handlePaymentExecute.bind(this));
      logger.info('Payment event handlers initialized');
    } catch (error) {
      logger.error('Failed to initialize payment event handlers', { error: error.message });
      // Still continue - don't stop the service if RabbitMQ is not available immediately
    }
  },

  async handlePaymentRequest(event) {
    try {
      const { orderId, userId, amount, currency, idempotencyKey, replyTo, correlationId } = event.data;
      logger.info('Received PAYMENT_REQUEST', { orderId, userId, amount, correlationId });
      
      const { payment, newPayment, orderReference } = await paymentService.createPayment({ 
        orderId, 
        userId, 
        amount, 
        currency,
        idempotencyKey
      });
      
      const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
      
      // Send PAYMENT_RESULT event with approval URL
      await rabbitmq.publish('payment-events', replyTo, {
        type: eventTypes.PAYMENT_RESULT,
        correlationId,
        data: {
          status: 'created',
          approvalUrl: approvalUrl?.href,
          paymentId: payment.id,
          orderId,
          userId
        }
      });
      
      // Also publish a general payment status event for any interested services
      await rabbitmq.publish('payment-events', 'payment.status', {
        type: 'PAYMENT_STATUS_UPDATED',
        data: {
          orderId,
          paymentId: payment.id,
          paypalPaymentId: payment.id, 
          status: 'created',
          paymentUrl: approvalUrl?.href,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error handling PAYMENT_REQUEST', { error: error.message || error });
      
      let errorMessage = error.message || 'Unknown payment error';
      
      try {
        await rabbitmq.publish('payment-events', event.data.replyTo, {
          type: eventTypes.PAYMENT_RESULT,
          correlationId: event.correlationId,
          data: {
            status: 'failed',
            error: errorMessage,
            orderId: event.data.orderId,
            timestamp: new Date().toISOString()
          }
        });
        
        // Also publish a general payment failure event
        await rabbitmq.publish('payment-events', 'payment.status', {
          type: 'PAYMENT_STATUS_UPDATED',
          data: {
            orderId: event.data.orderId,
            status: 'failed',
            error: errorMessage,
            timestamp: new Date().toISOString()
          }
        });
      } catch (pubError) {
        logger.error('Error publishing payment failure', { 
          error: pubError.message,
          originalError: errorMessage 
        });
      }
    }
  },

  async handlePaymentExecute(event) {
    try {
      const { paymentId, payerId, orderId, userId, replyTo, correlationId } = event.data;
      logger.info('Received PAYMENT_EXECUTE', { paymentId, payerId, orderId, correlationId });
      
      const { payment, updated, orderReference } = await paymentService.executePayment(paymentId, payerId);
      
      // Send PAYMENT_RESULT event with payment status
      await rabbitmq.publish('payment-events', replyTo, {
        type: eventTypes.PAYMENT_RESULT,
        correlationId,
        data: {
          status: payment.state === 'approved' ? 'completed' : 'failed',
          paymentId,
          orderId,
          userId,
          payment
        }
      });
      
      // Also publish a general payment status event
      await rabbitmq.publish('payment-events', 'payment.status', {
        type: 'PAYMENT_STATUS_UPDATED',
        data: {
          orderId,
          paymentId: updated.paypalPaymentId,
          status: updated.status,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error handling PAYMENT_EXECUTE', { 
        error: error.message || error,
        paymentId: event.data.paymentId
      });
      
      let errorMessage = error.message || 'Unknown payment execution error';
      let orderReference = error.orderReference; // Extract order reference if available
      
      try {
        await rabbitmq.publish('payment-events', event.data.replyTo, {
          type: eventTypes.PAYMENT_RESULT,
          correlationId: event.correlationId,
          data: {
            status: 'failed',
            error: errorMessage,
            orderId: orderReference?.orderId || event.data.orderId,
            timestamp: new Date().toISOString()
          }
        });
        
        // Also publish a general payment failure event
        await rabbitmq.publish('payment-events', 'payment.status', {
          type: 'PAYMENT_STATUS_UPDATED',
          data: {
            orderId: orderReference?.orderId || event.data.orderId,
            paymentId: event.data.paymentId,
            status: 'failed',
            error: errorMessage,
            timestamp: new Date().toISOString()
          }
        });
      } catch (pubError) {
        logger.error('Error publishing payment execution failure', { 
          error: pubError.message,
          originalError: errorMessage 
        });
      }
    }
  }
}; 