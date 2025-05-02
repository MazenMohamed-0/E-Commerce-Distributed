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

  async publishOrderEvent(eventType, data) {
    try {
      await rabbitmq.publish('order-events', eventType, {
        type: eventType,
        data
      });
      logger.info(`Published ${eventType} event`);
    } catch (error) {
      logger.error(`Error publishing ${eventType} event:`, error);
      throw error;
    }
  }

  // Request product validation from Product Service
  async requestProductValidation(products) {
    try {
      // Generate a correlation ID for this request
      const correlationId = Date.now().toString();
      
      // Create a promise that will be resolved when we receive the response
      const validationPromise = new Promise(async (resolve, reject) => {
        let queueName;
        const timeoutId = setTimeout(() => {
          reject(new Error('Product validation timeout'));
          // Cleanup will be handled in the finally block
        }, 5000); // 5 seconds timeout

        try {
          // Create a temporary response queue
          queueName = await rabbitmq.createTemporaryResponseQueue(
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
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        } finally {
          // Cleanup function to be called after resolution or rejection
          if (queueName) {
            setTimeout(async () => {
              try {
                await rabbitmq.unsubscribe(queueName);
              } catch (error) {
                console.error('Error cleaning up temporary queue:', error);
              }
            }, 1000); // Give a second for the message to be processed
          }
        }
      });

      // Wait for the response
      const validationResult = await validationPromise;
      return validationResult;
    } catch (error) {
      logger.error('Error requesting product validation:', error);
      throw error;
    }
  }
}

module.exports = new OrderEventHandler(); 