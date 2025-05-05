const rabbitmq = require('../../shared/rabbitmq');
const eventTypes = require('../../shared/eventTypes');
const Order = require('../models/Order');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'order-service-events.log' })
  ]
});

class OrderEventHandler {
  constructor() {
    this.initializeEventHandlers();
  }

  async initializeEventHandlers() {
    try {
      await rabbitmq.connect();

      // Subscribe to product events
      await rabbitmq.subscribe('product-events', 'order-service-product-queue', 'product.#', this.handleProductEvent.bind(this));

      // Subscribe to user events
      await rabbitmq.subscribe('user-events', 'order-service-user-queue', 'user.#', this.handleUserEvent.bind(this));

      // IMPORTANT: Consistent queue names for payment events
      // Use the same queue name that payment service publishes to
      await rabbitmq.subscribe(
        'payment-events', 
        'order-service-payment-queue', 
        'payment.#', 
        this.handlePaymentEvent.bind(this)
      );
      
      // Add specific subscription for payment result events using the exact routing key from PaymentService
      await rabbitmq.subscribe(
        'payment-events', 
        'order-service-payment-result-queue', 
        eventTypes.PAYMENT_RESULT, 
        this.handlePaymentStatusUpdate.bind(this)
      );
      
      // Add subscription for order details requests
      await rabbitmq.subscribe(
        'order-events', 
        'order-service-details-request-queue', 
        'order.details.request', 
        this.handleOrderDetailsRequest.bind(this)
      );

      logger.info('Order service event handlers initialized');
    } catch (error) {
      logger.error('Error initializing event handlers:', error);
      throw error;
    }
  }

  async handleProductEvent(event) {
    try {
      const { type, data } = event;

      switch (type) {
        case eventTypes.PRODUCT_DELETED:
          // Update orders that contain the deleted product
          await Order.updateMany(
            { 'items.productId': data.productId },
            { $pull: { items: { productId: data.productId } } }
          );
          logger.info(`Updated orders after product deletion: ${data.productId}`);
          break;

        case eventTypes.PRODUCT_UPDATED:
          // Update product details in orders
          await Order.updateMany(
            { 'items.productId': data.productId },
            { 
              $set: { 
                'items.$[elem].price': data.price,
                'items.$[elem].name': data.name
              }
            },
            { arrayFilters: [{ 'elem.productId': data.productId }] }
          );
          logger.info(`Updated orders after product update: ${data.productId}`);
          break;
      }
    } catch (error) {
      logger.error('Error handling product event:', error);
      throw error;
    }
  }

  async handleUserEvent(event) {
    try {
      const { type, data } = event;

      switch (type) {
        case eventTypes.USER_DELETED:
          // Handle user deletion (e.g., anonymize orders)
          await Order.updateMany(
            { userId: data.userId },
            { $set: { userId: 'deleted_user' } }
          );
          logger.info(`Updated orders after user deletion: ${data.userId}`);
          break;
      }
    } catch (error) {
      logger.error('Error handling user event:', error);
      throw error;
    }
  }

  async handlePaymentEvent(event) {
    try {
      const { type, data } = event;
      
      logger.info(`Received payment event: ${type}`, { eventData: JSON.stringify(data) });
      
      // Route the event based on type
      switch (type) {
        case 'payment.created':
          logger.info(`Payment created for order ${data.orderId}`);
          return this.handlePaymentCreated(data);
          
        case 'payment.status':
        case eventTypes.PAYMENT_RESULT:
          logger.info(`Payment status update for order ${data.orderId}`);
          return this.handlePaymentStatusUpdate(event);
          
        case 'payment.cancelled':
          logger.info(`Payment cancelled for order ${data.orderId}`);
          return this.handlePaymentCancelled(data);
          
        default:
          logger.info(`Unhandled payment event type: ${type}`);
      }
    } catch (error) {
      logger.error('Error processing payment event:', error);
      throw error;
    }
  }

  async handlePaymentCreated(data) {
    try {
      if (!data.orderId) {
        throw new Error('Payment event missing orderId');
      }
      
      // Get the order
      const order = await Order.findById(data.orderId);
      if (!order) {
        logger.error('Order not found for payment event', { orderId: data.orderId });
        return;
      }
      
      // Update order with payment information
      order.payment = {
        ...order.payment,
        paymentId: data.paymentId,
        method: data.paymentMethod || 'stripe',
        status: 'pending'
      };
      
      // For cash payments, we can consider them completed right away
      if (data.paymentMethod === 'cash') {
        order.payment.status = 'completed';
        // Always mark cash payment orders as completed
        order.status = 'completed';
        logger.info(`Cash on delivery order marked as completed: ${data.orderId}`);
      }
      
      await order.save();
      logger.info(`Order updated with payment created info for ${data.orderId}`);
      
      return order;
    } catch (error) {
      logger.error('Error handling payment created event:', error);
      throw error;
    }
  }

  async handlePaymentStatusUpdate(event) {
    try {
      // Extract all possible data fields
      const { orderId, paymentId, status, error, timestamp, success, stripePaymentIntentId } = event.data;
      
      logger.info('Received payment event', { 
        orderId, 
        paymentId,
        status,
        success: !!success,
        eventType: event.type,
        messageData: JSON.stringify(event.data)
      });
      
      if (!orderId) {
        logger.error('Payment event missing orderId', { event });
        return;
      }
      
      // Get the order
      const order = await Order.findById(orderId);
      if (!order) {
        logger.error('Order not found for payment event', { orderId });
        return;
      }
      
      // Log current order state before update
      logger.info('Current order state before payment update', {
        orderId: order._id,
        status: order.status,
        paymentStatus: order.payment ? order.payment.status : 'none'
      });
      
      // Create payment data object from event
      const paymentData = {
        status,
        paymentId,
        updatedAt: timestamp || new Date(),
        stripePaymentIntentId,
        error: error
      };
      
      // Check if success is explicitly defined
      if (success !== undefined) {
        paymentData.status = success ? 'completed' : 'failed';
      }
      
      // Check for special case where payment is successful but order is failed
      const willCompletePayment = paymentData.status === 'completed' || success === true;
      const isOrderFailed = order.status === 'failed';
      
      if (willCompletePayment && isOrderFailed) {
        logger.warn('Payment successful but order already failed. Will mark payment as completed but keep order failed.', {
          orderId: order._id.toString(),
          orderStatus: order.status,
          paymentStatus: paymentData.status
        });
        
        // Publish a special event for this case
        await this.publishOrderEvent('PAYMENT_COMPLETED_FOR_FAILED_ORDER', {
          orderId: order._id.toString(),
          userId: order.userId,
          reason: order.error?.message || 'Unknown error during order processing',
          paymentId: paymentData.paymentId,
          stripePaymentIntentId: paymentData.stripePaymentIntentId,
          timestamp: new Date()
        });
      }
      
      // Update the order with payment info
      const previousStatus = order.status;
      order.updatePaymentInfo(paymentData);
      
      // Save the updated order
      await order.save();
      
      logger.info('Order updated with payment info', {
        orderId: order._id,
        previousStatus,
        newStatus: order.status,
        previousPaymentStatus: order.payment ? order.payment.status : 'none',
        newPaymentStatus: paymentData.status,
        paymentWasSuccessful: paymentData.status === 'completed',
        orderWasCompleted: order.status === 'completed'
      });
      
      // If the order is now completed, publish an ORDER_COMPLETED event
      if (order.status === 'completed' && previousStatus !== 'completed') {
        logger.info('Publishing ORDER_COMPLETED event after payment completion', {
          orderId: order._id,
          userId: order.userId
        });
        
        // Publish the ORDER_COMPLETED event
        await this.publishOrderEvent(eventTypes.ORDER_COMPLETED, {
          orderId: order._id.toString(),
          userId: order.userId,
          status: order.status,
          paymentStatus: order.payment ? order.payment.status : null,
          completedAt: new Date()
        });
      }
      
      // If there was a correlationId and replyTo in the event, send a response
      if (event.correlationId && event.replyTo) {
        try {
          logger.info('Sending payment status update response', {
            correlationId: event.correlationId,
            replyTo: event.replyTo,
            orderId: order._id.toString(),
            status: order.status
          });
          
          await rabbitmq.publish('payment-events', event.replyTo, {
            type: 'payment.status.response',
            correlationId: event.correlationId,
            data: {
              orderId: order._id.toString(),
              status: order.status,
              paymentStatus: order.payment ? order.payment.status : null,
              success: true
            }
          });
        } catch (replyError) {
          logger.error('Error sending payment status update response', {
            error: replyError.message,
            correlationId: event.correlationId
          });
        }
      }
      
      return order;
    } catch (error) {
      logger.error('Error handling payment status update', error);
      throw error;
    }
  }

  async publishOrderEvent(type, data) {
    try {
      console.log('\nOrder Service Publishing Event:');
      console.log('------------------------');
      console.log(`Type: ${type}`);
      console.log(`Data:`, data);
      console.log('------------------------');
      
      await rabbitmq.publish('order-events', type, {
        type,
        data,
        timestamp: new Date()
      });
      
      logger.info(`Published order event: ${type}`, {
        orderId: data.orderId,
        eventType: type
      });
    } catch (error) {
      logger.error('Error publishing order event:', error);
      throw error;
    }
  }

  // Request product validation from Product Service
  async requestProductValidation(products) {
    try {
      logger.info('Requesting product validation', { products });
      
      const correlationId = `product-validation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const validationPromise = new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Product validation request timed out'));
        }, 10000); // 10 seconds timeout
        
        try {
          // Create a temporary response queue
          const queueName = await rabbitmq.createTemporaryResponseQueue(
            'product-events',
            correlationId,
            (message) => {
              if (message.correlationId === correlationId) {
                clearTimeout(timeoutId);
                resolve(message.data);
              }
            }
          );

          // Publish the validation request
          await rabbitmq.publish('product-events', 'product.validation.request', {
            type: 'product.validation.request',
            correlationId,
            data: {
              products,
              replyTo: `response.${correlationId}`
            }
          });
          
          logger.info('Product validation request sent', { correlationId });
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
      
      return await validationPromise;
    } catch (error) {
      logger.error('Error requesting product validation:', error);
      throw error;
    }
  }

  // Handle order details request from other services
  async handleOrderDetailsRequest(message) {
    try {
      logger.info('Received order details request', { 
        correlationId: message.correlationId,
        orderId: message.data?.orderId
      });
      
      if (!message.data || !message.data.orderId || !message.data.replyTo) {
        logger.error('Invalid order details request', { 
          message,
          missingOrderId: !message.data?.orderId,
          missingReplyTo: !message.data?.replyTo
        });
        return;
      }
      
      const { orderId, replyTo } = message.data;
      
      // Find the order
      const order = await Order.findById(orderId);
      
      if (!order) {
        logger.error('Order not found for details request', { orderId });
        
        // Send back error response
        await rabbitmq.publish('order-events', replyTo, {
          type: 'order.details.response',
          correlationId: message.correlationId,
          data: {
            orderId,
            error: 'Order not found',
            success: false
          }
        });
        
        return;
      }
      
      // Extract and format the necessary order details
      const orderDetails = {
        orderId: order._id.toString(),
        userId: order.userId,
        status: order.status,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          productName: item.productName
        })),
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        success: true
      };
      
      logger.info('Sending order details response', { 
        correlationId: message.correlationId,
        orderId: order._id.toString(),
        itemCount: orderDetails.items.length
      });
      
      // Send the response
      await rabbitmq.publish('order-events', replyTo, {
        type: 'order.details.response',
        correlationId: message.correlationId,
        data: orderDetails
      });
    } catch (error) {
      logger.error('Error handling order details request', { 
        error: error.message,
        stack: error.stack
      });
      
      // Try to send error response if possible
      if (message.data?.replyTo) {
        await rabbitmq.publish('order-events', message.data.replyTo, {
          type: 'order.details.response',
          correlationId: message.correlationId,
          data: {
            orderId: message.data?.orderId,
            error: error.message,
            success: false
          }
        });
      }
    }
  }
}

module.exports = new OrderEventHandler(); 