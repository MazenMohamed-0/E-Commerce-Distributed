const Cart = require('../models/Cart');

/**
 * Cart Repository
 * Handles all database operations for the Cart model
 */
class CartRepository {
  /**
   * Find a cart by user ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} - Cart object
   */
  async findByUser(userId) {
    return await Cart.findOne({ userId });
  }

  /**
   * Create a new cart
   * @param {Object} cartData - Cart data
   * @returns {Promise<Object>} - Created cart object
   */
  async create(cartData) {
    const cart = new Cart(cartData);
    return await cart.save();
  }

  /**
   * Update a cart
   * @param {String} userId - User ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} - Updated cart object
   */
  async update(userId, updates) {
    const cart = await Cart.findOne({ userId });
    if (!cart) return null;
    
    Object.keys(updates).forEach(key => {
      cart[key] = updates[key];
    });
    
    cart.updatedAt = Date.now();
    return await cart.save();
  }

  /**
   * Add item to cart
   * @param {String} userId - User ID
   * @param {Object} item - Cart item
   * @returns {Promise<Object>} - Updated cart object
   */
  async addItem(userId, item) {
    // Find the cart or create if it doesn't exist
    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        totalAmount: 0
      });
    }
    
    // Check if the product already exists in the cart
    const existingItemIndex = cart.items.findIndex(
      cartItem => cartItem.productId.toString() === item.productId.toString()
    );
    
    if (existingItemIndex > -1) {
      // Update existing item
      cart.items[existingItemIndex].quantity += item.quantity;
    } else {
      // Add new item
      cart.items.push(item);
    }
    
    // Recalculate total amount
    cart.totalAmount = cart.items.reduce(
      (total, item) => total + (item.price * item.quantity), 0
    );
    
    cart.updatedAt = Date.now();
    return await cart.save();
  }

  /**
   * Update cart item
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @param {Number} quantity - New quantity
   * @returns {Promise<Object>} - Updated cart object
   */
  async updateItem(userId, productId, quantity) {
    const cart = await Cart.findOne({ userId });
    if (!cart) return null;
    
    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId.toString()
    );
    
    if (itemIndex === -1) return null;
    
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity;
    }
    
    // Recalculate total amount
    cart.totalAmount = cart.items.reduce(
      (total, item) => total + (item.price * item.quantity), 0
    );
    
    cart.updatedAt = Date.now();
    return await cart.save();
  }

  /**
   * Remove item from cart
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @returns {Promise<Object>} - Updated cart object
   */
  async removeItem(userId, productId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) return null;
    
    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId.toString()
    );
    
    if (itemIndex === -1) return null;
    
    // Remove item
    cart.items.splice(itemIndex, 1);
    
    // Recalculate total amount
    cart.totalAmount = cart.items.reduce(
      (total, item) => total + (item.price * item.quantity), 0
    );
    
    cart.updatedAt = Date.now();
    return await cart.save();
  }

  /**
   * Clear cart
   * @param {String} userId - User ID
   * @returns {Promise<Object>} - Updated cart object
   */
  async clearCart(userId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) return null;
    
    cart.items = [];
    cart.totalAmount = 0;
    cart.updatedAt = Date.now();
    
    return await cart.save();
  }

  /**
   * Delete cart
   * @param {String} userId - User ID
   * @returns {Promise<Object>} - Deletion result
   */
  async delete(userId) {
    return await Cart.deleteOne({ userId });
  }
}

module.exports = new CartRepository();
