const rabbitmqService = require('../services/rabbitmqService');
const paymentService = require('../services/paymentService');
const eventTypes = require('../../shared/eventTypes');
const rabbitmq = require('../../shared/rabbitmq');

class PaymentEventHandler {
  async init() {
    await rabbitmqService.connect();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for payment request events from order service
    this.subscribeToOrderPaymentRequests();
    
    // Listen for order cancelled events
    this.subscribeToOrderCancellations();
  }

  // Subscribe to payment requests from order service
  async subscribeToOrderPaymentRequests() {
    await rabbitmqService.subscribeToOrderEvents(eventTypes.PAYMENT_REQUEST, async (message) => {
      try {
        console.log('Received payment request:', message);
        const { data, correlationId } = message;
        
        if (!data || !data.orderId || !data.userId || !data.amount) {
          throw new Error('Invalid payment request data');
        }
        
        // Get payment method from request or default to stripe
        const paymentMethod = data.paymentMethod || 'stripe';
        console.log(`Processing ${paymentMethod} payment request for order ${data.orderId}`);
        
        // Create payment for the order
        const paymentResult = await paymentService.createPayment({
          orderId: data.orderId,
          userId: data.userId,
          amount: data.amount,
          currency: data.currency || 'USD',
          paymentMethod
        });
        
        console.log(`${paymentMethod.toUpperCase()} payment created successfully:`, {
          paymentId: paymentResult.paymentId,
          orderId: paymentResult.orderId
        });
        
        // Extract the replyTo from the data object
        const replyTo = data.replyTo;
        
        // Send response with appropriate payment data
        if (replyTo) {
          let responseData;
          
          if (paymentMethod === 'stripe') {
            console.log(`Sending Stripe payment response to ${replyTo}`);
            console.log('Stripe payment data:', { 
              paymentId: paymentResult.paymentId,
              orderId: paymentResult.orderId,
              stripePaymentIntentId: paymentResult.stripePaymentIntentId,
              clientSecret: paymentResult.stripeClientSecret ? paymentResult.stripeClientSecret.substring(0, 10) + '...' : 'missing'
            });
            
            responseData = {
              success: true,
              paymentId: paymentResult.paymentId,
              orderId: paymentResult.orderId,
              stripePaymentIntentId: paymentResult.stripePaymentIntentId,
              stripeClientSecret: paymentResult.stripeClientSecret
            };
          } else if (paymentMethod === 'cash') {
            console.log(`Sending Cash payment response to ${replyTo}`);
            responseData = {
              success: true,
              paymentId: paymentResult.paymentId,
              orderId: paymentResult.orderId
            };
          } else {
            throw new Error(`Unsupported payment method: ${paymentMethod}`);
          }
          
          console.log(`Sending payment response to ${replyTo}`, {
            correlationId,
            success: responseData.success,
            paymentId: responseData.paymentId
          });
          
          // Use the exchange-based publishing that matches the temporary queue pattern
          try {
            // If replyTo looks like a queue name with the format response-payment-...,
            // extract the correlation ID and use it as the routing key
            if (replyTo.startsWith('response-') && replyTo.includes('payment-')) {
              console.log(`Using exchange-based publishing with correlationId: ${correlationId}`);
              
              // Publish to the payment-events exchange with the routing key in the format
              // that matches what createTemporaryResponseQueue is expecting
              await rabbitmq.publish(
                'payment-events',
                `response.${correlationId}`, 
                {
                  correlationId,
                  type: `response.${correlationId}`,
                  data: responseData
                }
              );
              
              console.log(`Successfully published payment response to exchange with routing key response.${correlationId}`);
            } else {
              // Fall back to direct queue publishing for backward compatibility
              await rabbitmq.publishToQueue(replyTo, {
                correlationId,
                data: responseData
              });
              
              console.log(`Successfully published payment response directly to queue ${replyTo}`);
            }
          } catch (queueError) {
            console.error(`Error publishing to queue/exchange: ${queueError.message}`);
            throw queueError;
          }
        } else {
          console.error('No replyTo queue specified in the request');
        }
        
        // Publish payment created event
        await this.publishPaymentCreatedEvent(paymentResult);
      } catch (error) {
        console.error('Error processing payment request:', error);
        
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
        console.log('Received order cancellation:', message);
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

  // Publish payment created event
  async publishPaymentCreatedEvent(paymentData) {
    await rabbitmqService.publishPaymentEvent('payment.created', paymentData);
  }

  // Publish payment completed event - called when payment is successfully captured
  async publishPaymentCompletedEvent(paymentData) {
    await rabbitmqService.publishPaymentEvent(eventTypes.PAYMENT_RESULT, {
      ...paymentData,
      success: true
    });
  }

  // Publish payment failed event
  async publishPaymentFailedEvent(paymentData) {
    await rabbitmqService.publishPaymentEvent(eventTypes.PAYMENT_RESULT, {
      ...paymentData,
      success: false
    });
  }

  // Publish payment cancelled event
  async publishPaymentCancelledEvent(paymentData) {
    await rabbitmqService.publishPaymentEvent('payment.cancelled', paymentData);
  }
}

module.exports = new PaymentEventHandler();