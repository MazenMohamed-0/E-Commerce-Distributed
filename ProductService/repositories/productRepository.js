const Product = require('../models/Product');

/**
 * Product Repository
 * Handles all database operations for the Product model
 */
class ProductRepository {
  /**
   * Find all products
   * @returns {Promise<Array>} - Array of product objects
   */
  async findAll() {
    return await Product.find();
  }

  /**
   * Find a product by ID
   * @param {String} id - Product ID
   * @returns {Promise<Object>} - Product object
   */
  async findById(id) {
    return await Product.findById(id);
  }
  
  /**
   * Create a new product
   * @param {Object} productData - Product data with createdBy field
   * @returns {Promise<Object>} - Created product object
   */
  async create(productData) {
    if (!productData.createdBy) {
      throw new Error('Seller ID (createdBy) is required');
    }
    const product = new Product(productData);
    return await product.save();
  }
  
  /**
   * Update a product
   * @param {String} id - Product ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Updated product object
   */
  async update(id, updateData) {
    // Don't allow updating createdBy field
    if (updateData.createdBy) {
      delete updateData.createdBy;
    }
    return await Product.findByIdAndUpdate(id, updateData, { new: true });
  }
  
  /**
   * Delete a product
   * @param {String} id - Product ID
   * @returns {Promise<Object>} - Deleted product object
   */
  async delete(id) {
    return await Product.findByIdAndDelete(id);
  }
  
  /**
   * Find products by seller ID
   * @param {String} sellerId - Seller ID
   * @returns {Promise<Array>} - Array of product objects
   */
  async findBySeller(sellerId) {
    return await Product.find({ createdBy: sellerId });
  }
  
  /**
   * Update product stock
   * @param {String} id - Product ID
   * @param {Number} newStock - New stock quantity
   * @returns {Promise<Object>} - Updated product object
   */
  async updateStock(id, newStock) {
    const product = await Product.findById(id);
    if (!product) return null;
    
    product.stock = newStock;
    product.updatedAt = Date.now();
    return await product.save();
  }

  /**
   * Find products by category
   * @param {String} category - Category name
   * @returns {Promise<Array>} - Array of product objects
   */
  async findByCategory(category) {
    return await Product.find({ category });
  }

  /**
   * Search products by name or description
   * @param {String} query - Search query
   * @returns {Promise<Array>} - Array of product objects
   */
  async search(query) {
    return await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    });
  }
}

module.exports = new ProductRepository();
