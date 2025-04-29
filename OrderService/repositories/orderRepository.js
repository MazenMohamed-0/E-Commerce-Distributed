const Order = require('../models/Order');

/**
 * Order Repository
 * Handles all database operations for the Order model
 */
class OrderRepository {
  /**
   * Find all orders
   * @returns {Promise<Array>} - Array of order objects
   */
  async findAll() {
    return await Order.find();
  }

  /**
   * Find orders by user ID
   * @param {String} userId - User ID
   * @returns {Promise<Array>} - Array of order objects
   */
  async findByUser(userId) {
    return await Order.find({ userId });
  }

  /**
   * Find an order by ID
   * @param {String} id - Order ID
   * @returns {Promise<Object>} - Order object
   */
  async findById(id) {
    return await Order.findById(id);
  }

  /**
   * Create a new order
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} - Created order object
   */
  async create(orderData) {
    const order = new Order(orderData);
    return await order.save();
  }

  /**
   * Update order status
   * @param {String} id - Order ID
   * @param {String} status - New status
   * @returns {Promise<Object>} - Updated order object
   */
  async updateStatus(id, status) {
    const order = await Order.findById(id);
    if (!order) return null;
    
    order.status = status;
    order.updatedAt = Date.now();
    return await order.save();
  }

  /**
   * Update payment status
   * @param {String} id - Order ID
   * @param {String} paymentStatus - New payment status
   * @returns {Promise<Object>} - Updated order object
   */
  async updatePaymentStatus(id, paymentStatus) {
    const order = await Order.findById(id);
    if (!order) return null;
    
    order.paymentStatus = paymentStatus;
    order.updatedAt = Date.now();
    return await order.save();
  }

  /**
   * Find orders for products created by a specific seller
   * @param {Array} productIds - Array of product IDs created by the seller
   * @returns {Promise<Array>} - Array of order objects
   */
  async findOrdersForProducts(productIds) {
    return await Order.find({
      'items.productId': { $in: productIds }
    });
  }

  /**
   * Find orders by status
   * @param {String} status - Order status
   * @returns {Promise<Array>} - Array of order objects
   */
  async findByStatus(status) {
    return await Order.find({ status });
  }

  /**
   * Find orders by payment status
   * @param {String} paymentStatus - Payment status
   * @returns {Promise<Array>} - Array of order objects
   */
  async findByPaymentStatus(paymentStatus) {
    return await Order.find({ paymentStatus });
  }

  /**
   * Find orders created within a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} - Array of order objects
   */
  async findByDateRange(startDate, endDate) {
    return await Order.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });
  }
}

module.exports = new OrderRepository();
