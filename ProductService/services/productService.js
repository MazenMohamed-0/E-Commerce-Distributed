const Product = require('../models/Product');
const productEventHandler = require('../events/productEventHandler');
const winston = require('winston');
const rabbitmq = require('../../shared/rabbitmq');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'product-service.log' })
  ]
});

class ProductService {
  async getAllProducts() {
    try {
      return await Product.find();
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

      logger.info(`Product stock updated: ${productId} to ${newStock}`);
      return product;
        } catch (error) {
      logger.error('Error updating product stock:', error);
      throw error;
        }
    }

  async getProductById(productId) {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      return product;
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
            const productWithSeller = {
              ...product.toObject(),
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
      return await Product.find({ category });
        } catch (error) {
      logger.error('Error getting category products:', error);
      throw error;
        }
    }

  async searchProducts(query) {
        try {
      return await Product.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      });
        } catch (error) {
      logger.error('Error searching products:', error);
      throw error;
        }
    }

  async getProductsBySeller(sellerId) {
    try {
      return await Product.find({ createdBy: sellerId });
    } catch (error) {
      logger.error('Error getting seller products:', error);
      throw error;
    }
  }
}

module.exports = new ProductService();