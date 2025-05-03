const rabbitmqService = require('../services/rabbitmqService');
const paymentService = require('../services/paymentService');
const eventTypes = require('../../shared/eventTypes');
const rabbitmq = require('../../shared/rabbitmq');


class PaymentEventHandler {
  async init() {
    await rabbitmqService.connect();
    this.setupEventListeners();
  }

  async setupEventListeners() {
    try {
      // Subscribe to payment requests from Order Service
      await this.subscribeToOrderPaymentRequests();
      
      // Add explicit subscription for payment.create.request
      await this.subscribeToPaymentCreateRequest();
      
      // Listen for order cancelled events
      this.subscribeToOrderCancellations();
      
      // Listen for payment status check requests
      this.subscribeToPaymentStatusChecks();
    } catch (error) {
      console.error('Error setting up payment event listeners:', error);
      throw error;
    }
  }

  // Subscribe to payment requests from order service
  async subscribeToOrderPaymentRequests() {
    await rabbitmqService.subscribeToOrderEvents(eventTypes.PAYMENT_REQUEST, async (message) => {
      try {
        const { data, correlationId } = message;
        
        if (!data || !data.orderId || !data.userId || !data.amount) {
          throw new Error('Invalid payment request data');
        }
        
        // Get payment method from request or default to stripe
        const paymentMethod = data.paymentMethod || 'stripe';
        
        // Create payment for the order
        const paymentResult = await paymentService.createPayment({
          orderId: data.orderId,
          userId: data.userId,
          amount: data.amount,
          currency: data.currency || 'USD',
          paymentMethod
        });
        
        // Extract the replyTo from the data object
        const replyTo = data.replyTo;
        
        // Send response with appropriate payment data
        if (replyTo) {
          let responseData;
          
          if (paymentMethod === 'stripe') {
            responseData = {
              success: true,
              paymentId: paymentResult.paymentId,
              orderId: paymentResult.orderId,
              stripePaymentIntentId: paymentResult.stripePaymentIntentId,
              stripeClientSecret: paymentResult.stripeClientSecret
            };
          } else if (paymentMethod === 'cash') {
            responseData = {
              success: true,
              paymentId: paymentResult.paymentId,
              orderId: paymentResult.orderId
            };
          } else {
            throw new Error(`Unsupported payment method: ${paymentMethod}`);
          }
          
          // Use the exchange-based publishing that matches the temporary queue pattern
          try {
            // If replyTo looks like a queue name with the format response-payment-...,
            // extract the correlation ID and use it as the routing key
            if (replyTo.startsWith('response-') && replyTo.includes('payment-')) {
              await rabbitmq.publish(
                'payment-events',
                `response.${correlationId}`, 
                {
                  correlationId,
                  type: `response.${correlationId}`,
                  data: responseData
                }
              );
            } else {
              // Fall back to direct queue publishing for backward compatibility
              await rabbitmq.publishToQueue(replyTo, {
                correlationId,
                data: responseData
              });
            }
          } catch (queueError) {
            console.error(`Error publishing to queue/exchange: ${queueError.message}`);
            throw queueError;
          }
        } else {
          console.error('No replyTo queue specified in the request');
        }
        
        // Publish payment created event separately to inform the order service
        await this.publishPaymentCreatedEvent(paymentResult);
      } catch (error) {
        // Try to send error response if replyTo is available
        if (message.data && message.data.replyTo) {
          const replyTo = message.data.replyTo;
          try {
            // Get direct reference to shared rabbitmq for publishing to queues
            await rabbitmq.publishToQueue(replyTo, {
              correlationId: message.correlationId,
              data: {
                success: false,
                error: error.message,
                orderId: message.data.orderId
              }
            });
          } catch (queueError) {
            console.error(`Error publishing error response to queue ${replyTo}: ${queueError.message}`);
          }
        }
      }
    });
  }

  // Subscribe to order cancellations
  async subscribeToOrderCancellations() {
    await rabbitmqService.subscribeToOrderEvents(eventTypes.ORDER_CANCELLED, async (message) => {
      try {
        const { data } = message;
        
        // Find payment by orderId
        const payment = await paymentService.getPaymentByOrderId(data.orderId);
        
        if (payment && payment.status === 'pending') {
          // Cancel the payment
          await paymentService.cancelPayment(payment.paymentId);
          
          // Publish payment cancelled event
          await this.publishPaymentCancelledEvent({
            orderId: data.orderId,
            paymentId: payment.paymentId
          });
        }
      } catch (error) {
        console.error('Error processing order cancellation:', error);
      }
    });
  }
  
  // Subscribe to payment status check requests
  async subscribeToPaymentStatusChecks() {
    await rabbitmqService.subscribeToOrderEvents('payment.status.check', async (message) => {
      try {
        const { data, correlationId } = message;
        
        if (!data || !data.orderId) {
          throw new Error('Invalid payment status check request');
        }
        
        // Find payment by orderId
        const payment = await paymentService.getPaymentByOrderId(data.orderId);
        
        if (!payment) {
          throw new Error(`Payment not found for order ${data.orderId}`);
        }
        
        // Always check with payment provider for latest status
        const paymentStatus = await paymentService.getPaymentStatus(payment._id);
        
        // Extract the replyTo from the data object
        const replyTo = data.replyTo;
        
        // Send response with payment status data
        if (replyTo) {
          const responseData = {
            success: true,
            paymentId: payment._id,
            orderId: data.orderId,
            status: paymentStatus.status,
            paymentMethod: payment.paymentMethod
          };
          
          if (payment.paymentMethod === 'stripe') {
            responseData.stripePaymentIntentId = payment.stripePaymentIntentId;
          }
          
          await rabbitmq.publishToQueue(replyTo, {
            correlationId,
            type: 'payment.status.response',
            data: responseData
          });
        }
      } catch (error) {
        // Try to send error response if replyTo is available
        if (message.data && message.data.replyTo) {
          const replyTo = message.data.replyTo;
          try {
            await rabbitmq.publishToQueue(replyTo, {
              correlationId: message.correlationId,
              type: 'payment.status.response',
              data: {
                success: false,
                error: error.message,
                orderId: message.data.orderId
              }
            });
          } catch (queueError) {
            console.error(`Error publishing error response to queue ${replyTo}: ${queueError.message}`);
          }
        }
      }
    });
  }

  // Publish payment created event
  async publishPaymentCreatedEvent(paymentData) {
    await rabbitmqService.publishPaymentEvent('payment.created', {
      orderId: paymentData.orderId,
      paymentId: paymentData.paymentId,
      paymentMethod: paymentData.paymentMethod || 'stripe',
      status: 'pending',
      timestamp: new Date()
    });
  }

  // Publish payment completed event - called when payment is successfully captured
  async publishPaymentCompletedEvent(paymentData) {
    await rabbitmqService.publishPaymentEvent(eventTypes.PAYMENT_RESULT, {
      ...paymentData,
      status: 'completed',
      success: true,
      timestamp: new Date()
    });
  }

  // Publish payment failed event
  async publishPaymentFailedEvent(paymentData) {
    await rabbitmqService.publishPaymentEvent(eventTypes.PAYMENT_RESULT, {
      ...paymentData,
      status: 'failed',
      success: false,
      timestamp: new Date()
    });
  }

  // Publish payment cancelled event
  async publishPaymentCancelledEvent(paymentData) {
    await rabbitmqService.publishPaymentEvent('payment.cancelled', {
      ...paymentData,
      status: 'cancelled',
      timestamp: new Date()
    });
  }

  // Add a new method to specifically handle payment.create.request
  async subscribeToPaymentCreateRequest() {
    await rabbitmq.subscribe(
      'payment-events',
      'payment-service-create-request-queue',
      'payment.create.request',
      async (message) => {
        try {
          const { data, correlationId } = message;
          
          if (!data || !data.orderId || !data.userId || !data.amount) {
            throw new Error('Invalid payment request data');
          }
          
          // Process Stripe payment
          const paymentResult = await paymentService.createStripePayment({
            orderId: data.orderId,
            userId: data.userId,
            amount: data.amount,
            currency: data.currency || 'USD'
          });
          
          // If replyTo is specified, send response back
          if (data.replyTo) {
            const replyTo = data.replyTo;
            const responseData = {
              orderId: data.orderId,
              paymentId: paymentResult.paymentId,
              stripePaymentIntentId: paymentResult.stripePaymentIntentId,
              stripeClientSecret: paymentResult.stripeClientSecret,
              success: true
            };
            
            try {
              await rabbitmq.publish(
                'payment-events',
                replyTo,
                {
                  correlationId,
                  type: replyTo,
                  data: responseData
                }
              );
            } catch (error) {
              console.error(`Error publishing payment creation response: ${error.message}`);
              throw error;
            }
          }
          
          // Publish payment created event
          await this.publishPaymentCreatedEvent(paymentResult);
        } catch (error) {
          // Try to send error response if replyTo is available
          if (message.data?.replyTo) {
            const replyTo = message.data.replyTo;
            try {
              await rabbitmq.publish(
                'payment-events',
                replyTo,
                {
                  correlationId: message.correlationId,
                  type: replyTo,
                  data: {
                    success: false,
                    error: error.message,
                    orderId: message.data.orderId
                  }
                }
              );
            } catch (queueError) {
              console.error(`Error publishing error response: ${queueError.message}`);
            }
          }
        }
      }
    );
  }
}

module.exports = new PaymentEventHandler();