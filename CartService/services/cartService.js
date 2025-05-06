const Cart = require('../models/Cart');
const cartEventHandler = require('../events/cartEventHandler');
const rabbitmq = require('../shared/rabbitmq');
const winston = require('winston');
const jwt = require('jsonwebtoken');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'cart-service.log' })
  ]
});

class CartService {
  constructor() {
    this.initializeProductEventHandler();
  }

  async initializeProductEventHandler() {
    try {
      // Subscribe to product responses
      await rabbitmq.subscribe(
        'product-events',
        'cart-service-product-details',
        'product.details.response',
        this.handleProductDetailsResponse.bind(this)
      );
        } catch (error) {
      logger.error('Error initializing product event handler:', error);
    }
  }

  // Store callbacks for pending product detail requests
  productDetailsCallbacks = new Map();

  async getProductDetails(productId) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Requesting product details for:', productId);
        // Store the callback with the productId as key
        this.productDetailsCallbacks.set(productId, { resolve, reject });

        // Publish request for product details
        rabbitmq.publish('product-events', 'product.details.request', {
          type: 'product.details.request',
          data: {
            productId,
            replyTo: 'product.details.response'
          }
        });

        // Set timeout for the request
        setTimeout(() => {
          if (this.productDetailsCallbacks.has(productId)) {
            this.productDetailsCallbacks.delete(productId);
            reject(new Error('Product details request timed out'));
          }
        }, 5000); // 5 seconds timeout

      } catch (error) {
        this.productDetailsCallbacks.delete(productId);
        reject(error);
      }
    });
  }

  async handleProductDetailsResponse(message) {
    try {
      console.log('Received product details response:', message);
      const { data } = message;
      const { productId, error } = data;
      const callback = this.productDetailsCallbacks.get(productId);

      if (callback) {
        if (error) {
          callback.reject(new Error(error));
        } else {
          callback.resolve(data);
        }
        this.productDetailsCallbacks.delete(productId);
      }
    } catch (error) {
      logger.error('Error handling product details response:', error);
    }
  }

  async getCart(userId) {
    try {
      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return { userId, items: [], totalAmount: 0 };
      }

      // Get unique product IDs from cart
      const productIds = [...new Set(cart.items.map(item => item.productId))];
      
      if (productIds.length === 0) {
        return {
          userId: cart.userId,
          items: [],
          totalAmount: 0
        };
      }

      // Request product details for all products in cart
      const productDetailsPromises = productIds.map(productId => 
        this.getProductDetails(productId)
      );
      
      const productDetails = await Promise.all(productDetailsPromises);
      
      // Create a map of product details for easy lookup
      const productDetailsMap = productDetails.reduce((map, product) => {
        if (!product) {
          throw new Error(`Product details not found for productId: ${product.productId}`);
        }
        map[product.productId] = product;
        return map;
      }, {});

      // Enrich cart items with product details
      const enrichedItems = cart.items.map(item => {
        const product = productDetailsMap[item.productId];
        if (!product) {
          throw new Error(`Product details not found for productId: ${item.productId}`);
        }
        
        return {
          productId: item.productId,
          quantity: item.quantity,
          name: product.name,
          price: product.price,
          stock: product.stock,
          imageUrl: product.imageUrl,
          // Use the stored sellerId from the cart if available, otherwise use the one from product details
          sellerId: item.sellerId || product.sellerId || product.createdBy
        };
      });

      // Calculate total amount
      const totalAmount = enrichedItems.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0
      );

      return {
        userId: cart.userId,
        items: enrichedItems,
        totalAmount
      };
    } catch (error) {
      logger.error('Error getting cart:', error);
      throw error;
    }
  }

  async addToCart(userId, itemData, token) {
    try {
      // Validate token is provided
      if (!token) {
        throw new Error('Authorization token is required');
      }

      // Request product details through RabbitMQ
      const productDetails = await this.getProductDetails(itemData.productId);
      
      // Validate product exists
      if (!productDetails) {
        throw new Error('Product not found');
      }

      // Validate stock availability
      if (productDetails.stock < itemData.quantity) {
        throw new Error(`Requested quantity (${itemData.quantity}) exceeds available stock (${productDetails.stock})`);
      }

      let cart = await Cart.findOne({ userId });

      if (!cart) {
        cart = new Cart({ userId, items: [] });
      }

      // Check if product already exists in cart
      const existingItemIndex = cart.items.findIndex(item => item.productId === itemData.productId);

      if (existingItemIndex >= 0) {
        // Calculate total quantity including existing items
        const newTotalQuantity = cart.items[existingItemIndex].quantity + itemData.quantity;
        
        // Validate total quantity against stock
        if (newTotalQuantity > productDetails.stock) {
          throw new Error(`Total quantity (${newTotalQuantity}) would exceed available stock (${productDetails.stock})`);
        }
        
        cart.items[existingItemIndex].quantity = newTotalQuantity;
        // Update stock information
        cart.items[existingItemIndex].stock = productDetails.stock;
        // Ensure seller ID is set in case it was missing
        if (!cart.items[existingItemIndex].sellerId && (itemData.sellerId || productDetails.sellerId)) {
          cart.items[existingItemIndex].sellerId = itemData.sellerId || productDetails.sellerId;
        }
      } else {
        // Add new item with only necessary information
        cart.items.push({
          productId: itemData.productId,
          quantity: itemData.quantity,
          stock: productDetails.stock,
          sellerId: itemData.sellerId || productDetails.sellerId || productDetails.createdBy,
          // Add missing required fields
          name: productDetails.name,
          price: productDetails.price,
          imageUrl: productDetails.imageUrl
        });
      }

      // Update total amount
      cart.totalAmount = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      await cart.save();

      // Publish cart updated event with minimal information
      await cartEventHandler.publishCartEvent('CART_UPDATED', {
        userId,
        items: cart.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      });

      logger.info(`Cart updated for user: ${userId}`);
      return cart;
    } catch (error) {
      logger.error('Error adding to cart:', error);
      throw error;
    }
  }

    async removeFromCart(userId, productId) {
        try {
      const cart = await Cart.findOne({ userId });

            if (!cart) {
                throw new Error('Cart not found');
            }
            
      cart.items = cart.items.filter(item => item.productId !== productId);
      cart.totalAmount = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      await cart.save();

      // Publish cart updated event
      await cartEventHandler.publishCartEvent('CART_UPDATED', {
        userId,
        items: cart.items
      });

      logger.info(`Item removed from cart: ${productId} for user: ${userId}`);
      return cart;
        } catch (error) {
      logger.error('Error removing from cart:', error);
      throw error;
        }
    }

    async clearCart(userId) {
        try {
      const cart = await Cart.findOneAndUpdate(
        { userId },
        { items: [], totalAmount: 0 },
        { new: true }
      );

            if (!cart) {
                throw new Error('Cart not found');
            }
            
      // Publish cart updated event
      await cartEventHandler.publishCartEvent('CART_UPDATED', {
        userId,
        items: []
      });

      logger.info(`Cart cleared for user: ${userId}`);
      return cart;
        } catch (error) {
      logger.error('Error clearing cart:', error);
      throw error;
    }
  }

  async updateItemQuantity(userId, productId, quantity) {
    try {
      const cart = await Cart.findOne({ userId });

      if (!cart) {
        throw new Error('Cart not found');
      }

      const itemIndex = cart.items.findIndex(item => item.productId === productId);
      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }

      cart.items[itemIndex].quantity = quantity;
      cart.totalAmount = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      await cart.save();

      // Publish cart updated event
      await cartEventHandler.publishCartEvent('CART_UPDATED', {
        userId,
        items: cart.items
      });

      logger.info(`Item quantity updated in cart: ${productId} to ${quantity} for user: ${userId}`);
      return cart;
    } catch (error) {
      logger.error('Error updating item quantity:', error);
      throw error;
    }
    }
}

module.exports = new CartService();
