const rabbitmq = require('../../shared/rabbitmq');
const eventTypes = require('../../shared/eventTypes');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const jwt = require('jsonwebtoken');
const redisClient = require('../../shared/redis');

// Configure event logger
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'product-service-events.log' })
  ]
});

class ProductEventHandler {
  constructor() {
    // Define cache keys for invalidation
    this.CACHE_KEYS = {
      ALL_PRODUCTS: 'products:all',
      PRODUCT_DETAILS: 'product:',
      PRODUCT_CATEGORY: 'products:category:',
      PRODUCT_SEARCH: 'products:search:',
      SELLER_PRODUCTS: 'products:seller:'
    };
    
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
      for (const sub of subscriptions) {
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

      // Subscribe to order completed events to reduce stock
      await rabbitmq.subscribe(
        'order-events',
        'product-service-order-completed',
        eventTypes.ORDER_COMPLETED,
        this.handleOrderCompleted.bind(this)
      );
      
      // Subscribe to events that should trigger cache invalidation
      this.setupCacheInvalidationHandlers();

      logger.info('Product service event handlers initialized');
    } catch (error) {
      logger.error('Error initializing event handlers:', error);
      throw error;
    }
  }
  
  async setupCacheInvalidationHandlers() {
    try {
      // Subscribe to events from other services that should invalidate product caches
      await rabbitmq.subscribe(
        'inventory-events',
        'product-service-inventory-updated',
        'inventory.updated',
        this.handleInventoryUpdated.bind(this)
      );
      
      // More event subscriptions can be added here
      
      logger.info('Cache invalidation handlers initialized');
    } catch (error) {
      logger.error('Error setting up cache invalidation handlers:', error);
    }
  }
  
  async handleInventoryUpdated(event) {
    try {
      const { productId } = event.data;
      if (productId) {
        await this.invalidateProductCache(productId);
        logger.info(`Cache invalidated due to inventory update for product ${productId}`);
      }
    } catch (error) {
      logger.error('Error handling inventory updated event for cache invalidation:', error);
    }
  }
  
  async invalidateProductCache(productId) {
    try {
      // Invalidate specific product cache
      await redisClient.delete(`${this.CACHE_KEYS.PRODUCT_DETAILS}${productId}`);
      
      // Also invalidate the all products list
      await redisClient.delete(this.CACHE_KEYS.ALL_PRODUCTS);
      
      // We don't know which category this product belongs to, so we'd need to 
      // either fetch the product to find out, or invalidate all category caches
      // For now, we'll just log that more specific invalidation could be implemented
      logger.info(`Invalidated cache for product ${productId}`);
      
      return true;
    } catch (error) {
      logger.error(`Error invalidating cache for product ${productId}:`, error);
      return false;
    }
  }
  
  async invalidateSellerProductsCache(sellerId) {
    try {
      await redisClient.delete(`${this.CACHE_KEYS.SELLER_PRODUCTS}${sellerId}`);
      logger.info(`Invalidated cache for seller ${sellerId}`);
      return true;
    } catch (error) {
      logger.error(`Error invalidating cache for seller ${sellerId}:`, error);
      return false;
    }
  }
  
  async invalidateCategoryCache(category) {
    try {
      await redisClient.delete(`${this.CACHE_KEYS.PRODUCT_CATEGORY}${category}`);
      logger.info(`Invalidated cache for category ${category}`);
      return true;
    } catch (error) {
      logger.error(`Error invalidating cache for category ${category}:`, error);
      return false;
    }
  }
  
  async invalidateSearchCache() {
    try {
      // Search caches use pattern matching to delete all search-related keys
      await redisClient.deletePattern(`${this.CACHE_KEYS.PRODUCT_SEARCH}*`);
      logger.info('Invalidated all search caches');
      return true;
    } catch (error) {
      logger.error('Error invalidating search caches:', error);
      return false;
    }
  }

  async handleProductEvent(event) {
    try {
      const { type, data } = event;

      switch (type) {
        case eventTypes.PRODUCT_CREATED:
          logger.info(`Product created event received: ${data.productId}`);
          // Invalidate relevant caches
          await this.invalidateProductCache(data.productId);
          await this.invalidateSellerProductsCache(data.sellerId);
          await this.invalidateSearchCache();
          break;
        case eventTypes.PRODUCT_UPDATED:
          logger.info(`Product updated event received: ${data.productId}`);
          // Invalidate relevant caches
          await this.invalidateProductCache(data.productId);
          await this.invalidateSellerProductsCache(data.sellerId);
          await this.invalidateSearchCache();
          if (data.category) {
            await this.invalidateCategoryCache(data.category);
          }
          break;
        case eventTypes.PRODUCT_DELETED:
          logger.info(`Product deleted event received: ${data.productId}`);
          // When a product is deleted, find out its details first to invalidate related caches
          const product = await Product.findById(data.productId);
          if (product) {
            await this.invalidateProductCache(data.productId);
            await this.invalidateSellerProductsCache(product.createdBy);
            await this.invalidateCategoryCache(product.category);
            await this.invalidateSearchCache();
          }
          break;
        case eventTypes.PRODUCT_STOCK_UPDATED:
          logger.info(`Product stock updated event received: ${data.productId}`);
          // Just invalidate the specific product cache
          await this.invalidateProductCache(data.productId);
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
      
      // Invalidate caches after product creation
      await this.invalidateProductCache(product._id);
      await this.invalidateSellerProductsCache(product.createdBy);
      await this.invalidateCategoryCache(product.category);
      await this.invalidateSearchCache();
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
      
      // Invalidate caches after product update
      await this.invalidateProductCache(product._id);
      await this.invalidateSellerProductsCache(product.createdBy);
      await this.invalidateCategoryCache(product.category);
      await this.invalidateSearchCache();
    } catch (error) {
      logger.error('Error handling product update:', error);
      throw error;
    }
  }

  async handleProductDeleted(productId) {
    try {
      // Get product details before deleting for cache invalidation
      const product = await Product.findById(productId);
      
      await this.publishProductEvent(eventTypes.PRODUCT_DELETED, {
        productId
      });
      
      // Invalidate caches after product deletion
      await this.invalidateProductCache(productId);
      
      // If we found the product, invalidate related caches
      if (product) {
        await this.invalidateSellerProductsCache(product.createdBy);
        await this.invalidateCategoryCache(product.category);
      }
      
      // Always invalidate these
      await this.invalidateSearchCache();
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
      
      // Invalidate product cache after stock update
      await this.invalidateProductCache(productId);
    } catch (error) {
      logger.error('Error handling stock update:', error);
      throw error;
    }
  }

  async handleProductDetailsRequest(message) {
    try {
      const { productId, replyTo } = message.data;
      
      if (!productId) {
        throw new Error('Product ID is required');
      }

      // Fetch product from database
      const product = await Product.findById(productId);
      
      if (!product) {
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
      // Ensure message has the correct structure
      if (!message || !message.data || !Array.isArray(message.data.products)) {
        throw new Error('Invalid message format: products array is required');
      }

      const { correlationId, data } = message;
      const { products, replyTo } = data;

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
                  sellerId: product.createdBy,
                  imageUrl: product.imageUrl
                }
              };
            } catch (error) {
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

      if (message?.data?.replyTo) {
        await rabbitmq.publish('product-events', message.data.replyTo, errorResponse);
      }
    }
  }

  // Handle order completed event to reduce stock
  async handleOrderCompleted(event) {
    try {
      logger.info('Received order completed event', { 
        orderId: event.data.orderId 
      });
      
      // We need to get the order details to know what products and quantities were ordered
      const orderId = event.data.orderId;
      
      if (!orderId) {
        logger.error('Order completed event missing orderId', { event });
        return;
      }
      
      // Request order details from the Order service
      const orderDetails = await this.requestOrderDetails(orderId);
      
      if (!orderDetails || !Array.isArray(orderDetails.items) || orderDetails.items.length === 0) {
        logger.error('Failed to get valid order details', { orderId });
        return;
      }
      
      // Only reduce stock if the order status is exactly "completed"
      if (orderDetails.status !== 'completed') {
        logger.warn('Skipping stock reduction because order status is not completed', {
          orderId,
          status: orderDetails.status
        });
        return;
      }
      
      logger.info('Processing stock reduction for order', {
        orderId,
        itemCount: orderDetails.items.length,
        status: orderDetails.status
      });
      
      // Process each item and reduce stock
      const productService = require('../services/productService');
      const stockUpdateResults = await Promise.all(
        orderDetails.items.map(async (item) => {
          try {
            // Find the product
            const product = await Product.findById(item.productId);
            
            if (!product) {
              logger.error('Product not found for stock reduction', { 
                productId: item.productId,
                orderId 
              });
              return {
                productId: item.productId,
                success: false,
                error: 'Product not found'
              };
            }
            
            // Calculate new stock level
            const newStock = Math.max(0, product.stock - item.quantity);
            
            // Update the stock
            await productService.updateStock(item.productId, newStock);
            
            logger.info('Stock reduced for product', {
              productId: item.productId,
              previousStock: product.stock,
              newStock,
              reduction: item.quantity
            });
            
            return {
              productId: item.productId,
              success: true,
              previousStock: product.stock,
              newStock,
              reduction: item.quantity
            };
          } catch (error) {
            logger.error('Error reducing stock for product', {
              productId: item.productId,
              orderId,
              error: error.message
            });
            
            return {
              productId: item.productId,
              success: false,
              error: error.message
            };
          }
        })
      );
      
      logger.info('Stock reduction completed for order', {
        orderId,
        results: stockUpdateResults
      });
    } catch (error) {
      logger.error('Error handling order completed event', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  // Helper method to request order details from Order service
  async requestOrderDetails(orderId) {
    try {
      logger.info('Requesting order details', { orderId });
      
      // Generate a correlation ID for this request
      const correlationId = Date.now().toString();
      
      // Create a promise that will be resolved when we receive the response
      const detailsPromise = new Promise(async (resolve, reject) => {
        let queueName;
        const timeoutId = setTimeout(() => {
          reject(new Error('Order details request timeout'));
        }, 5000); // 5 seconds timeout
        
        try {
          // Create a temporary response queue
          queueName = await rabbitmq.createTemporaryResponseQueue(
            'order-events',
            correlationId,
            (message) => {
              if (message.correlationId === correlationId) {
                clearTimeout(timeoutId);
                resolve(message.data);
              }
            }
          );
          
          // Publish the order details request
          await rabbitmq.publish('order-events', 'order.details.request', {
            type: 'order.details.request',
            correlationId,
            data: {
              orderId,
              replyTo: `response.${correlationId}`
            }
          });
          
          logger.info('Order details request sent', { correlationId, orderId });
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        } finally {
          // Cleanup function
          if (queueName) {
            setTimeout(async () => {
              try {
                await rabbitmq.unsubscribe(queueName);
              } catch (error) {
                console.error('Error cleaning up temporary queue:', error);
              }
            }, 1000);
          }
        }
      });
      
      return await detailsPromise;
    } catch (error) {
      logger.error('Error requesting order details', {
        orderId,
        error: error.message
      });
      
      // If request fails, try to get the order details from a direct API call
      try {
        // This is a fallback mechanism - in a real system, you might use HTTP calls here
        logger.info('Attempting fallback for order details');
        
        // In this case, we're mocking a response as there's no direct HTTP client set up
        return {
          orderId,
          items: [], // Empty array will prevent any stock updates
          error: 'Failed to get order details via event, and no fallback implemented'
        };
      } catch (fallbackError) {
        logger.error('Fallback for order details also failed', {
          orderId,
          error: fallbackError.message
        });
        
        return null;
      }
    }
  }
}

module.exports = new ProductEventHandler(); 