const Product = require('../models/Product');
const productEventHandler = require('../events/productEventHandler');
const winston = require('winston');
const rabbitmq = require('../../shared/rabbitmq');
const redisClient = require('../../shared/redis');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'product-service.log' })
  ]
});

class ProductService {
  constructor() {
    // Define cache keys and TTLs
    this.CACHE_KEYS = {
      ALL_PRODUCTS: 'products:all',
      PRODUCT_DETAILS: 'product:',
      PRODUCT_CATEGORY: 'products:category:',
      PRODUCT_SEARCH: 'products:search:',
      SELLER_PRODUCTS: 'products:seller:'
    };
    
    this.CACHE_TTL = {
      ALL_PRODUCTS: 600, // 10 minutes
      PRODUCT_DETAILS: 1800, // 30 minutes
      PRODUCT_CATEGORY: 900, // 15 minutes
      PRODUCT_SEARCH: 300, // 5 minutes
      SELLER_PRODUCTS: 600 // 10 minutes
    };
    
    // Connect to Redis when service starts
    redisClient.connect().catch(err => {
      logger.error('Failed to connect to Redis:', err);
    });
    
    // Subscribe to events that should invalidate cache
    this.setupCacheInvalidation();
  }
  
  setupCacheInvalidation() {
    // This will be implemented with RabbitMQ event handlers
    // to invalidate cache when products are modified
  }
  
  async getAllProducts() {
    try {
      // Try to get from cache first
      const cachedProducts = await redisClient.get(this.CACHE_KEYS.ALL_PRODUCTS);
      if (cachedProducts) {
        logger.info('Cache hit: All products fetched from cache');
        return cachedProducts;
      }
      
      // If not in cache, get from database
      const products = await Product.find();
      
      // Ensure we're storing plain objects, not Mongoose documents
      const plainProducts = products.map(product => product.toObject());
      
      // Store in cache for future requests
      await redisClient.set(
        this.CACHE_KEYS.ALL_PRODUCTS, 
        plainProducts, 
        this.CACHE_TTL.ALL_PRODUCTS
      );
      
      logger.info('Cache miss: All products fetched from database and cached');
      return plainProducts;
    } catch (error) {
      logger.error('Error getting all products:', error);
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      const product = new Product(productData);
      await product.save();
            
      // Publish product created event
      await productEventHandler.handleProductCreated(product);
      
      // Invalidate relevant caches
      await this.invalidateProductCaches();

      logger.info(`Product created: ${product._id}`);
      return product;
    } catch (error) {
      logger.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(productId, updateData) {
    try {
      const product = await Product.findByIdAndUpdate(
        productId,
        updateData,
        { new: true }
      );
                
      if (!product) {
        throw new Error('Product not found');
      }

      // Publish product updated event
      await productEventHandler.handleProductUpdated(product);
      
      // Invalidate specific product cache and other relevant caches
      await this.invalidateProductCaches(productId);

      logger.info(`Product updated: ${productId}`);
      return product;
        } catch (error) {
      logger.error('Error updating product:', error);
      throw error;
        }
    }

  async deleteProduct(productId) {
        try {
      const product = await Product.findByIdAndDelete(productId);

            if (!product) {
                throw new Error('Product not found');
            }
            
      // Publish product deleted event
      await productEventHandler.handleProductDeleted(productId);
      
      // Invalidate caches
      await this.invalidateProductCaches(productId);

      logger.info(`Product deleted: ${productId}`);
      return { message: 'Product deleted successfully' };
        } catch (error) {
      logger.error('Error deleting product:', error);
      throw error;
    }
  }

  async updateStock(productId, newStock) {
    try {
      const product = await Product.findByIdAndUpdate(
        productId,
        { stock: newStock },
        { new: true }
      );

      if (!product) {
        throw new Error('Product not found');
      }

      // Publish stock updated event
      await productEventHandler.handleStockUpdated(productId, newStock);
      
      // Invalidate specific product cache
      await redisClient.delete(`${this.CACHE_KEYS.PRODUCT_DETAILS}${productId}`);

      logger.info(`Product stock updated: ${productId} to ${newStock}`);
      return product;
        } catch (error) {
      logger.error('Error updating product stock:', error);
      throw error;
        }
    }

  async getProductById(productId) {
    try {
      // Try to get from cache first
      const cacheKey = `${this.CACHE_KEYS.PRODUCT_DETAILS}${productId}`;
      const cachedProduct = await redisClient.get(cacheKey);
      
      if (cachedProduct) {
        logger.info(`Cache hit: Product ${productId} fetched from cache`);
        return cachedProduct;
      }
      
      // If not in cache, get from database
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      // Convert to plain object before caching
      const plainProduct = product.toObject();
      
      // Store in cache for future requests
      await redisClient.set(
        cacheKey,
        plainProduct,
        this.CACHE_TTL.PRODUCT_DETAILS
      );
      
      logger.info(`Cache miss: Product ${productId} fetched from database and cached`);
      return plainProduct;
    } catch (error) {
      logger.error('Error getting product:', error);
      throw error;
    }
  }

  async getProductDetailsWithSeller(productId) {
    try {
      const product = await this.getProductById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Generate a unique correlation ID for this request
      const correlationId = `seller-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create a promise to handle the response
      return new Promise((resolve, reject) => {
        // Create a temporary response queue
        rabbitmq.createTemporaryResponseQueue('user-events', correlationId, async (message) => {
          try {
            if (message.data.error) {
              reject(new Error(message.data.error));
              return;
            }

            // Combine product data with seller information
            // Since product is already a plain object from getProductById, we don't need toObject()
            const productWithSeller = {
              ...product,
              seller: {
                storeName: message.data.storeName,
                sellerId: product.createdBy
              }
            };

            resolve(productWithSeller);
          } catch (error) {
            reject(error);
          }
        }).then(() => {
          // Send request for seller information
          rabbitmq.publish('user-events', 'user.store.request', {
            type: 'user.store.request',
            correlationId: correlationId,
            data: {
              userId: product.createdBy,
              correlationId: correlationId
            }
          });
        }).catch(reject);
      });
    } catch (error) {
      logger.error('Error getting product details with seller:', error);
      throw error;
    }
  }

  async getProductsByCategory(category) {
        try {
      // Try to get from cache first
      const cacheKey = `${this.CACHE_KEYS.PRODUCT_CATEGORY}${category}`;
      const cachedProducts = await redisClient.get(cacheKey);
      
      if (cachedProducts) {
        logger.info(`Cache hit: Products for category ${category} fetched from cache`);
        return cachedProducts;
      }
      
      // If not in cache, get from database
      const products = await Product.find({ category });
      
      // Convert to plain objects
      const plainProducts = products.map(product => product.toObject());
      
      // Store in cache for future requests
      await redisClient.set(
        cacheKey,
        plainProducts,
        this.CACHE_TTL.PRODUCT_CATEGORY
      );
      
      logger.info(`Cache miss: Products for category ${category} fetched from database and cached`);
      return plainProducts;
        } catch (error) {
      logger.error('Error getting category products:', error);
      throw error;
        }
    }

  async searchProducts(query) {
        try {
      // For search queries, create a normalized key to improve cache hits
      const normalizedQuery = query.toLowerCase().trim();
      const cacheKey = `${this.CACHE_KEYS.PRODUCT_SEARCH}${normalizedQuery}`;
      
      // Try to get from cache first
      const cachedResults = await redisClient.get(cacheKey);
      
      if (cachedResults) {
        logger.info(`Cache hit: Search results for "${query}" fetched from cache`);
        return cachedResults;
      }
      
      // If not in cache, perform the search
      const results = await Product.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      });
      
      // Convert to plain objects
      const plainResults = results.map(product => product.toObject());
      
      // Store in cache with a shorter TTL since search results change frequently
      await redisClient.set(
        cacheKey,
        plainResults,
        this.CACHE_TTL.PRODUCT_SEARCH
      );
      
      logger.info(`Cache miss: Search results for "${query}" fetched from database and cached`);
      return plainResults;
        } catch (error) {
      logger.error('Error searching products:', error);
      throw error;
        }
    }

  async getProductsBySeller(sellerId) {
    try {
      // Try to get from cache first
      const cacheKey = `${this.CACHE_KEYS.SELLER_PRODUCTS}${sellerId}`;
      const cachedProducts = await redisClient.get(cacheKey);
      
      if (cachedProducts) {
        logger.info(`Cache hit: Products for seller ${sellerId} fetched from cache`);
        return cachedProducts;
      }
      
      // If not in cache, get from database
      const products = await Product.find({ createdBy: sellerId });
      
      // Convert to plain objects
      const plainProducts = products.map(product => product.toObject());
      
      // Store in cache for future requests
      await redisClient.set(
        cacheKey,
        plainProducts,
        this.CACHE_TTL.SELLER_PRODUCTS
      );
      
      logger.info(`Cache miss: Products for seller ${sellerId} fetched from database and cached`);
      return plainProducts;
    } catch (error) {
      logger.error('Error getting seller products:', error);
      throw error;
    }
  }
  
  // Helper method to invalidate various product caches
  async invalidateProductCaches(productId = null) {
    try {
      // Always invalidate the all products cache
      await redisClient.delete(this.CACHE_KEYS.ALL_PRODUCTS);
      
      // If a specific product ID is provided, invalidate that product's cache
      if (productId) {
        await redisClient.delete(`${this.CACHE_KEYS.PRODUCT_DETAILS}${productId}`);
      }
      
      // Optionally invalidate category and search caches that might contain this product
      // This is a simplistic approach - in production you might want more targeted invalidation
      
      logger.info('Product caches invalidated successfully');
      return true;
    } catch (error) {
      logger.error('Error invalidating product caches:', error);
      return false;
    }
  }
}

module.exports = new ProductService();