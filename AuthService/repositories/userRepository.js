const User = require('../models/User');

/**
 * User Repository
 * Handles all database operations for the User model
 */
class UserRepository {
  /**
   * Find all users with optional role filtering
   * @param {String} role - Optional role filter
   * @returns {Promise<Array>} - Array of user objects
   */
  async findAll(role = null) {
    const query = role ? { role } : {};
    return await User.find(query).select('-password');
  }

  /**
   * Find all sellers with optional status filtering
   * @param {String} status - Optional status filter
   * @returns {Promise<Array>} - Array of seller objects
   */
  async findAllSellers(status = null) {
    const query = { role: 'seller' };
    if (status) {
      query.sellerStatus = status;
    }
    return await User.find(query).select('-password');
  }

  /**
   * Find a user by ID
   * @param {String} id - User ID
   * @returns {Promise<Object>} - User object
   */
  async findById(id) {
    return await User.findById(id).select('-password');
  }

  /**
   * Find a user by email
   * @param {String} email - User email
   * @returns {Promise<Object>} - User object
   */
  async findByEmail(email) {
    return await User.findOne({ email });
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Created user object
   */
  async create(userData) {
    const user = new User(userData);
    await user.save();
    return user;
  }

  /**
   * Update a user
   * @param {String} id - User ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} - Updated user object
   */
  async update(id, updates) {
    const user = await User.findById(id);
    if (!user) return null;
    
    Object.keys(updates).forEach(key => {
      user[key] = updates[key];
    });
    
    await user.save();
    return user;
  }

  /**
   * Delete a user
   * @param {String} id - User ID
   * @returns {Promise<Object>} - Deletion result
   */
  async delete(id) {
    return await User.deleteOne({ _id: id });
  }

  /**
   * Find pending sellers
   * @returns {Promise<Array>} - Array of pending seller objects
   */
  async findPendingSellers() {
    return await User.find({ 
      role: 'seller', 
      sellerStatus: 'pending' 
    }).select('-password');
  }

  /**
   * Find a seller's store information
   * @param {String} sellerId - Seller ID
   * @returns {Promise<Object>} - Seller store information
   */
  async findSellerStore(sellerId) {
    return await User.findById(sellerId).select('storeInfo sellerStatus');
  }

  /**
   * Find a buyer's shipping address
   * @param {String} buyerId - Buyer ID
   * @returns {Promise<Object>} - Buyer shipping address
   */
  async findBuyerShippingAddress(buyerId) {
    return await User.findById(buyerId).select('shippingAddress');
  }
}

module.exports = new UserRepository();
