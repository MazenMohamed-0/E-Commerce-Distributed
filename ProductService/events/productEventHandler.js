const rabbitmq = require('../../shared/rabbitmq');
const eventTypes = require('../../shared/eventTypes');
const Product = require('../models/Product');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const mongoose = require('mongoose');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'product-service-events.log' })
  ]
});

class ProductEventHandler {
  constructor() {
    this.initializeEventHandlers();
  }

  async initializeEventHandlers() {
    try {
      await rabbitmq.connect();

      // Define subscriptions
      const subscriptions = [
        { exchange: 'product-events', queue: 'product-service-queue', routingKey: 'product.#' }
      ];

      // Log all subscriptions
      console.log('\nProduct Service Subscriptions:');
      console.log('------------------------');
      for (const sub of subscriptions) {
        console.log(`Exchange: ${sub.exchange}`);
        console.log(`Queue: ${sub.queue}`);
        console.log(`Routing Key: ${sub.routingKey}`);
        console.log('------------------------');
        await rabbitmq.subscribe(sub.exchange, sub.queue, sub.routingKey, this.handleProductEvent.bind(this));
      }

      // Subscribe to product detail requests
      await rabbitmq.subscribe(
        'product-events',
        'product-details-request-queue',
        'product.details.request',
        this.handleProductDetailsRequest.bind(this)
      );

      // Subscribe to product validation requests
      await rabbitmq.subscribe(
        'product-events',
        'product-service-validation',
        'product.validation.request',
        this.handleProductValidationRequest.bind(this)
      );

      logger.info('Product service event handlers initialized');
    } catch (error) {
      logger.error('Error initializing event handlers:', error);
      throw error;
    }
  }

  async handleProductEvent(event) {
    try {
      const { type, data } = event;
      console.log('\nProduct Service Received Event:');
      console.log('------------------------');
      console.log(`Type: ${type}`);
      console.log(`Data:`, data);
      console.log('------------------------');

      switch (type) {
        case eventTypes.PRODUCT_CREATED:
          logger.info(`Product created event received: ${data.productId}`);
          break;
        case eventTypes.PRODUCT_UPDATED:
          logger.info(`Product updated event received: ${data.productId}`);
          break;
        case eventTypes.PRODUCT_DELETED:
          logger.info(`Product deleted event received: ${data.productId}`);
          break;
        case eventTypes.PRODUCT_STOCK_UPDATED:
          logger.info(`Product stock updated event received: ${data.productId}`);
          break;
      }
    } catch (error) {
      logger.error('Error handling product event:', error);
      throw error;
    }
  }

  async publishProductEvent(type, data) {
    try {
      const exchange = 'product-events';
      console.log('\nProduct Service Publishing Event:');
      console.log('------------------------');
      console.log(`Exchange: ${exchange}`);
      console.log(`Type: ${type}`);
      console.log(`Data:`, data);
      console.log('------------------------');
      
      await rabbitmq.publish(exchange, type, { type, data });
      logger.info(`Published product event: ${type}`);
    } catch (error) {
      logger.error('Error publishing product event:', error);
      throw error;
    }
  }

  async handleProductCreated(product) {
    try {
      await this.publishProductEvent(eventTypes.PRODUCT_CREATED, {
        productId: product._id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        description: product.description,
        category: product.category,
        sellerId: product.createdBy
      });
    } catch (error) {
      logger.error('Error handling product creation:', error);
      throw error;
    }
  }

  async handleProductUpdated(product) {
    try {
      await this.publishProductEvent(eventTypes.PRODUCT_UPDATED, {
        productId: product._id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        description: product.description,
        category: product.category,
        sellerId: product.createdBy
      });
    } catch (error) {
      logger.error('Error handling product update:', error);
      throw error;
    }
  }

  async handleProductDeleted(productId) {
    try {
      await this.publishProductEvent(eventTypes.PRODUCT_DELETED, {
        productId
      });
    } catch (error) {
      logger.error('Error handling product deletion:', error);
      throw error;
    }
  }

  async handleStockUpdated(productId, newStock) {
    try {
      await this.publishProductEvent(eventTypes.PRODUCT_STOCK_UPDATED, {
        productId,
        stock: newStock
      });
    } catch (error) {
      logger.error('Error handling stock update:', error);
      throw error;
    }
  }

  async handleProductDetailsRequest(message) {
    try {
      console.log('Received product details request:', message);
      const { productId, replyTo } = message.data;
      
      if (!productId) {
        throw new Error('Product ID is required');
      }

      // Fetch product from database
      const product = await Product.findById(productId);
      
      if (!product) {
        console.log(`Product not found: ${productId}`);
        await rabbitmq.publish('product-events', replyTo, {
          type: 'product.details.response',
          correlationId: message.correlationId,
          data: {
            productId,
            error: 'Product not found'
          }
        });
        return;
      }

      console.log('Found product:', product);
      // Send product details back
      await rabbitmq.publish('product-events', replyTo, {
        type: 'product.details.response',
        correlationId: message.correlationId,
        data: {
          productId: product._id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          imageUrl: product.imageUrl,
          description: product.description,
          category: product.category,
          sellerId: product.createdBy
        }
      });

      logger.info(`Product details sent for product: ${productId}`);
    } catch (error) {
      logger.error('Error handling product details request:', error);
      if (message.data && message.data.replyTo) {
        await rabbitmq.publish('product-events', message.data.replyTo, {
          type: 'product.details.response',
          correlationId: message.correlationId,
          data: {
            productId: message.data.productId,
            error: error.message
          }
        });
      }
    }
  }

  async handleProductValidationRequest(message) {
    try {
      console.log('Received validation request:', message);
      
      // Ensure message has the correct structure
      if (!message || !message.data || !Array.isArray(message.data.products)) {
        throw new Error('Invalid message format: products array is required');
      }

      const { correlationId, data } = message;
      const { products, replyTo } = data;

      console.log('Validating products:', JSON.stringify(products));

      try {
        // First phase: Just validate products without modifying stock
        const validationResults = await Promise.all(
          products.map(async (item) => {
            if (!item || !item.productId) {
              return {
                productId: item?.productId || 'unknown',
                isValid: false,
                hasStock: false,
                currentStock: 0,
                error: 'Invalid product data format'
              };
            }

            try {
              // Check if the productId is a valid ObjectId
              if (!mongoose.Types.ObjectId.isValid(item.productId)) {
                console.log(`Invalid product ID format: ${item.productId}`);
                return {
                  productId: item.productId,
                  isValid: false,
                  hasStock: false,
                  currentStock: 0,
                  error: 'Invalid product ID format'
                };
              }

              // Find product without modifying stock yet
              const product = await Product.findById(item.productId);
              
              if (!product) {
                console.log(`Product not found: ${item.productId}`);
                return {
                  productId: item.productId,
                  isValid: false,
                  hasStock: false,
                  currentStock: 0,
                  error: 'Product not found',
                  productDetails: null
                };
              }

              // Check if there's enough stock
              const hasEnoughStock = product.stock >= item.quantity;
              console.log(`Product ${item.productId} (${product.name}): available stock=${product.stock}, requested=${item.quantity}, has enough=${hasEnoughStock}`);
              
              return {
                productId: item.productId,
                isValid: true,
                hasStock: hasEnoughStock,
                currentStock: product.stock,
                previousStock: product.stock,
                error: !hasEnoughStock ? `Insufficient stock (available: ${product.stock}, requested: ${item.quantity})` : null,
                productDetails: {
                  name: product.name,
                  price: product.price,
                  sellerId: product.createdBy
                }
              };
            } catch (error) {
              console.error(`Error validating product ${item.productId}:`, error);
              return {
                productId: item.productId,
                isValid: false,
                hasStock: false,
                currentStock: 0,
                error: error.message
              };
            }
          })
        );

        // Log detailed validation results for each product
        console.log('Detailed validation results:');
        validationResults.forEach(result => {
          console.log(`- Product ${result.productId}: Valid=${result.isValid}, HasStock=${result.hasStock}, Stock=${result.currentStock}`);
          if (!result.isValid || !result.hasStock) {
            console.log(`  Error: ${result.error}`);
          }
        });

        // Check if all products are valid and have sufficient stock
        const allProductsValid = validationResults.every(result => result.isValid && result.hasStock);

        const response = {
          type: replyTo,
          correlationId,
          data: {
            isValid: allProductsValid,
            validationResults,
            message: allProductsValid ? 
              'All products are valid and have sufficient stock' : 
              'Some products are invalid or out of stock'
          }
        };

        console.log('Sending validation response:', JSON.stringify(response.data));

        // Send validation response
        await rabbitmq.publish('product-events', replyTo, response);

        logger.info('Product validation response sent', { correlationId });
      } catch (error) {
        console.log('Error during validation:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Error handling product validation request:', error);
      console.error('Validation error:', error);
      
      // Send error response
      const errorResponse = {
        type: message?.data?.replyTo || 'product.validation.response',
        correlationId: message?.correlationId,
        data: {
          isValid: false,
          validationResults: [],
          message: 'Product validation failed',
          error: error.message
        }
      };

      console.log('Sending error response:', errorResponse);
      
      if (message?.data?.replyTo) {
        await rabbitmq.publish('product-events', message.data.replyTo, errorResponse);
      }
    }
  }
}

module.exports = new ProductEventHandler(); 