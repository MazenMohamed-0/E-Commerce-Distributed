const rabbitmq = require('../shared/rabbitmq');
const eventTypes = require('../shared/eventTypes');
const Cart = require('../models/Cart');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'cart-service-events.log' })
  ]
});

class CartEventHandler {
  constructor() {
    this.initializeEventHandlers();
  }

  async initializeEventHandlers() {
    try {
      await rabbitmq.connect();

      // Subscribe to product events
      const productSubscriptions = [
        { exchange: 'product-events', queue: 'cart-service-product-queue', routingKey: 'product.#' }
      ];

      // Subscribe to user events
      const userSubscriptions = [
        { exchange: 'user-events', queue: 'cart-service-user-queue', routingKey: 'user.#' }
      ];

      // Log all subscriptions
      console.log('\nCart Service Subscriptions:');
      console.log('------------------------');
      for (const sub of [...productSubscriptions, ...userSubscriptions]) {
        console.log(`Exchange: ${sub.exchange}`);
        console.log(`Queue: ${sub.queue}`);
        console.log(`Routing Key: ${sub.routingKey}`);
        console.log('------------------------');
        await rabbitmq.subscribe(sub.exchange, sub.queue, sub.routingKey, this.handleProductEvent.bind(this));
      }

      logger.info('Cart service event handlers initialized');
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
          // Remove deleted products from all carts
          await Cart.updateMany(
            { 'items.productId': data.productId },
            { $pull: { items: { productId: data.productId } } }
          );
          logger.info(`Updated carts after product deletion: ${data.productId}`);
          break;

        case eventTypes.PRODUCT_UPDATED:
          // Update product details in carts
          await Cart.updateMany(
            { 'items.productId': data.productId },
            { 
              $set: { 
                'items.$[elem].price': data.price,
                'items.$[elem].name': data.name,
                'items.$[elem].stock': data.stock
              }
            },
            { arrayFilters: [{ 'elem.productId': data.productId }] }
          );
          logger.info(`Updated carts after product update: ${data.productId}`);
          break;

        case eventTypes.PRODUCT_STOCK_UPDATED:
          // Update product stock in carts
          await Cart.updateMany(
            { 'items.productId': data.productId },
            { 
              $set: { 
                'items.$[elem].stock': data.stock
              }
            },
            { arrayFilters: [{ 'elem.productId': data.productId }] }
          );
          logger.info(`Updated cart items stock: ${data.productId}`);
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
          // Delete user's cart
          await Cart.deleteOne({ userId: data.userId });
          logger.info(`Deleted cart for user: ${data.userId}`);
          break;
      }
    } catch (error) {
      logger.error('Error handling user event:', error);
      throw error;
    }
  }

  async publishCartEvent(type, data) {
    try {
      const exchange = 'cart-events';
      console.log('\nCart Service Publishing Event:');
      console.log('------------------------');
      console.log(`Exchange: ${exchange}`);
      console.log(`Type: ${type}`);
      console.log(`Data:`, data);
      console.log('------------------------');
      
      await rabbitmq.publish(exchange, type, { type, data });
      logger.info(`Published cart event: ${type}`);
    } catch (error) {
      logger.error('Error publishing cart event:', error);
      throw error;
    }
  }
}

module.exports = new CartEventHandler(); 