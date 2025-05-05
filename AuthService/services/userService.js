const userRepository = require('../repositories/userRepository');
const redisClient = require('../../shared/redis');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'user-service.log' })
  ]
});

class UserService {
  constructor() {
    // Define cache keys and TTLs
    this.CACHE_KEYS = {
      USER_PROFILE: 'user:profile:',
      USER_BY_ID: 'user:id:',
      USER_BY_EMAIL: 'user:email:',
      ALL_USERS: 'users:all',
      ALL_USERS_BY_ROLE: 'users:role:',
      ALL_SELLERS: 'users:sellers:all',
      SELLERS_BY_STATUS: 'users:sellers:status:',
      PENDING_SELLERS: 'users:sellers:pending',
      SELLER_STORE: 'user:seller:store:',
      BUYER_ADDRESS: 'user:buyer:address:'
    };
    
    this.CACHE_TTL = {
      USER_PROFILE: 3600, // 1 hour
      USER_BY_ID: 1800, // 30 minutes
      ALL_USERS: 600, // 10 minutes
      SELLERS: 600, // 10 minutes
      SELLER_STORE: 1800, // 30 minutes
      BUYER_ADDRESS: 1800 // 30 minutes
    };
  }
  
  // Helper method to invalidate user-related caches
  async invalidateUserCache(userId, email) {
    try {
      const keysToDelete = [
        `${this.CACHE_KEYS.USER_PROFILE}${userId}`,
        `${this.CACHE_KEYS.USER_BY_ID}${userId}`,
        this.CACHE_KEYS.ALL_USERS,
        `${this.CACHE_KEYS.SELLER_STORE}${userId}`,
        `${this.CACHE_KEYS.BUYER_ADDRESS}${userId}`
      ];
      
      if (email) {
        keysToDelete.push(`${this.CACHE_KEYS.USER_BY_EMAIL}${email}`);
      }
      
      for (const key of keysToDelete) {
        await redisClient.delete(key);
      }
      
      // Also invalidate role and status based caches
      await redisClient.deletePattern(`${this.CACHE_KEYS.ALL_USERS_BY_ROLE}*`);
      await redisClient.deletePattern(`${this.CACHE_KEYS.SELLERS_BY_STATUS}*`);
      await redisClient.delete(this.CACHE_KEYS.PENDING_SELLERS);
      
      logger.info(`Cache invalidated for user ${userId}`);
    } catch (error) {
      logger.error(`Error invalidating cache for user ${userId}:`, error);
    }
  }

  // Get all users with role filtering
  async getAllUsers(role = null) {
    try {
      // Determine cache key based on whether role filter is applied
      const cacheKey = role ? 
        `${this.CACHE_KEYS.ALL_USERS_BY_ROLE}${role}` : 
        this.CACHE_KEYS.ALL_USERS;
      
      // Try to get from cache first
      const cachedUsers = await redisClient.get(cacheKey);
      if (cachedUsers) {
        logger.info(`Cache hit: All users${role ? ' with role ' + role : ''} fetched from cache`);
        return cachedUsers;
      }
      
      // If not in cache, get from database
      const users = await userRepository.findAll(role);
      
      // Store in cache for future requests
      await redisClient.set(
        cacheKey,
        users,
        this.CACHE_TTL.ALL_USERS
      );
      
      logger.info(`Cache miss: All users${role ? ' with role ' + role : ''} fetched from database and cached`);
      return users;
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }

  // Get all sellers with status filtering
  async getAllSellers(status = null) {
    try {
      // Determine cache key based on whether status filter is applied
      const cacheKey = status ? 
        `${this.CACHE_KEYS.SELLERS_BY_STATUS}${status}` : 
        this.CACHE_KEYS.ALL_SELLERS;
      
      // Try to get from cache first
      const cachedSellers = await redisClient.get(cacheKey);
      if (cachedSellers) {
        logger.info(`Cache hit: All sellers${status ? ' with status ' + status : ''} fetched from cache`);
        return cachedSellers;
      }
      
      // If not in cache, get from database
      const sellers = await userRepository.findAllSellers(status);
      
      // Store in cache for future requests
      await redisClient.set(
        cacheKey,
        sellers,
        this.CACHE_TTL.SELLERS
      );
      
      logger.info(`Cache miss: All sellers${status ? ' with status ' + status : ''} fetched from database and cached`);
      return sellers;
    } catch (error) {
      logger.error('Error getting all sellers:', error);
      throw error;
    }
  }

  // Get all buyers
  async getAllBuyers() {
    // Reuse the getAllUsers method with role filter
    return this.getAllUsers('buyer');
  }

  // Get user by ID
  async getUserById(id) {
    try {
      // Try to get from cache first
      const cacheKey = `${this.CACHE_KEYS.USER_BY_ID}${id}`;
      const cachedUser = await redisClient.get(cacheKey);
      
      if (cachedUser) {
        logger.info(`Cache hit: User ${id} fetched from cache`);
        return cachedUser;
      }
      
      // If not in cache, get from database
    const user = await userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
      
      // Store in cache for future requests
      await redisClient.set(
        cacheKey,
        user,
        this.CACHE_TTL.USER_BY_ID
      );
      
      logger.info(`Cache miss: User ${id} fetched from database and cached`);
    return user;
    } catch (error) {
      logger.error(`Error getting user by ID ${id}:`, error);
      throw error;
    }
  }

  // Create new user with role validation
  async createUser(userData) {
    try {
    const { name, email, password, role } = userData;

    // Validate required fields
    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required');
    }

    // Validate role
    if (role && !['buyer', 'seller', 'admin'].includes(role)) {
      throw new Error('Invalid role. Must be buyer, seller, or admin');
    }

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Validate seller-specific fields if role is seller
    if (role === 'seller') {
      const requiredSellerFields = ['storeName', 'taxNumber'];
      const missingFields = requiredSellerFields.filter(field => !userData.storeInfo?.[field]);
      if (missingFields.length > 0) {
        throw new Error(`Missing required seller fields: ${missingFields.join(', ')}`);
      }
    }

    // Create new user
    const userToCreate = {
      name,
      email,
      password,
      role: role || 'buyer',
      ...(role === 'seller' && {
        storeInfo: userData.storeInfo,
        sellerStatus: 'pending'
      }),
      ...(role === 'buyer' && {
        shippingAddress: userData.shippingAddress
      })
    };

    const user = await userRepository.create(userToCreate);
    
    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;
      
      // Invalidate relevant caches
      await this.invalidateUserCache(user._id, user.email);
    
    return userResponse;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  // Update user with role-specific validations
  async updateUser(id, updates, isAdmin) {
    try {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Special handling for admin routes - allow all updates
    if (isAdmin) {
      console.log('Admin update with data:', updates);
      
      // Handle status - this is what was missing
      if (updates.status) {
        user.status = updates.status;
      }
      console.log(user);
      
      // Handle seller-specific fields
      if (user.role === 'seller') {
        if (updates.sellerStatus) user.sellerStatus = updates.sellerStatus;
        if (updates.rejectionReason) user.rejectionReason = updates.rejectionReason;
        
        // Handle store info if provided
        if (updates.storeInfo) {
          user.storeInfo = {
            ...user.storeInfo,
            ...updates.storeInfo
          };
        }
      }
      
      // Handle buyer-specific fields
      if (user.role === 'buyer' && updates.shippingAddress) {
        user.shippingAddress = updates.shippingAddress;
      }
      
      // Create updates object with all the changes
      const updatedFields = {
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        status: user.status,
        ...(user.role === 'seller' && {
          sellerStatus: user.sellerStatus,
          rejectionReason: user.rejectionReason,
          storeInfo: user.storeInfo
        }),
        ...(user.role === 'buyer' && {
          shippingAddress: user.shippingAddress
        })
      };
      
      // Update the user through the repository
      const updatedUser = await userRepository.update(id, updatedFields);
      const userResponse = updatedUser.toObject();
      delete userResponse.password;
        
        // Invalidate relevant caches
        await this.invalidateUserCache(id, updatedUser.email);
        
      return userResponse;
    }
    
    // Regular user update (non-admin) with validation
    // Update allowed fields based on role
    const allowedUpdates = {
      common: ['name', 'email', 'password'],
      buyer: ['shippingAddress'],
      seller: ['storeInfo'],
      admin: ['role', 'sellerStatus', 'rejectionReason']
    };

    const updateKeys = Object.keys(updates);
    const userRole = user.role;

    // Check if updates are valid for the user's role
    const isValidOperation = updateKeys.every(update => {
      return allowedUpdates.common.includes(update) ||
             (userRole === 'buyer' && allowedUpdates.buyer.includes(update)) ||
             (userRole === 'seller' && allowedUpdates.seller.includes(update));
    });

    if (!isValidOperation) {
      throw new Error('Invalid updates for user role');
    }

    // Handle role-specific updates
    if (userRole === 'seller') {
      if (updates.storeInfo) {
        // Only allow updating certain store info fields
        const allowedStoreInfoUpdates = [
          'storeDescription', 'contactNumber'
        ];
        
        Object.keys(updates.storeInfo).forEach(key => {
          if (allowedStoreInfoUpdates.includes(key)) {
            user.storeInfo[key] = updates.storeInfo[key];
          }
        });
      }
    }

    if (userRole === 'buyer') {
      if (updates.shippingAddress) user.shippingAddress = updates.shippingAddress;
    }

    // Handle common updates
    if (updates.name) user.name = updates.name;
    if (updates.email) user.email = updates.email;
    if (updates.password) user.password = updates.password;

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
      
      // Invalidate relevant caches
      await this.invalidateUserCache(id, user.email);
      
    return userResponse;
    } catch (error) {
      logger.error(`Error updating user ${id}:`, error);
      throw error;
    }
  }

  // Delete user
  async deleteUser(id) {
    try {
      // Get user email before deleting
      const user = await userRepository.findById(id);
      if (!user) {
        throw new Error('User not found');
      }
      
      const email = user.email;
      
    const result = await userRepository.delete(id);
    if (result.deletedCount === 0) {
      throw new Error('User not found');
    }
      
      // Invalidate relevant caches
      await this.invalidateUserCache(id, email);
      
    return { message: 'User deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting user ${id}:`, error);
      throw error;
    }
  }

  // Check permissions
  hasPermission(currentUser, targetUserId) {
    return currentUser.role === 'admin' || currentUser.id === targetUserId;
  }

  // Get pending sellers for admin approval
  async getPendingSellers() {
    try {
      // Try to get from cache first
      const cachedPendingSellers = await redisClient.get(this.CACHE_KEYS.PENDING_SELLERS);
      
      if (cachedPendingSellers) {
        logger.info('Cache hit: Pending sellers fetched from cache');
        return cachedPendingSellers;
      }
      
      // If not in cache, get from database
      const pendingSellers = await userRepository.findAllSellers('pending');
      
      // Store in cache for future requests (with shorter TTL as this changes frequently)
      await redisClient.set(
        this.CACHE_KEYS.PENDING_SELLERS,
        pendingSellers,
        300 // 5 minutes TTL
      );
      
      logger.info('Cache miss: Pending sellers fetched from database and cached');
      return pendingSellers;
    } catch (error) {
      logger.error('Error getting pending sellers:', error);
      throw error;
    }
  }

  // Approve seller
  async approveSeller(sellerId) {
    try {
    const seller = await userRepository.findById(sellerId);
    if (!seller || seller.role !== 'seller') {
      throw new Error('Seller not found');
    }
    
      seller.status = 'approved';
      await seller.save();
      
      // Invalidate relevant caches
      await this.invalidateUserCache(sellerId, seller.email);
      await redisClient.delete(this.CACHE_KEYS.PENDING_SELLERS);
      await redisClient.deletePattern(`${this.CACHE_KEYS.SELLERS_BY_STATUS}*`);
      
      return seller;
    } catch (error) {
      logger.error(`Error approving seller ${sellerId}:`, error);
      throw error;
    }
  }

  // Reject seller
  async rejectSeller(sellerId, reason) {
    try {
    const seller = await userRepository.findById(sellerId);
    if (!seller || seller.role !== 'seller') {
      throw new Error('Seller not found');
    }
    
      seller.status = 'rejected';
      if (reason) {
        seller.rejectionReason = reason;
      }
      
      await seller.save();
      
      // Invalidate relevant caches
      await this.invalidateUserCache(sellerId, seller.email);
      await redisClient.delete(this.CACHE_KEYS.PENDING_SELLERS);
      await redisClient.deletePattern(`${this.CACHE_KEYS.SELLERS_BY_STATUS}*`);
      
      return seller;
    } catch (error) {
      logger.error(`Error rejecting seller ${sellerId}:`, error);
      throw error;
    }
  }

  // Get seller store by ID
  async getSellerStore(sellerId) {
    try {
      // Try to get from cache first
      const cacheKey = `${this.CACHE_KEYS.SELLER_STORE}${sellerId}`;
      const cachedStore = await redisClient.get(cacheKey);
      
      if (cachedStore) {
        logger.info(`Cache hit: Seller store for ${sellerId} fetched from cache`);
        return cachedStore;
      }
      
      // If not in cache, get from database
      const seller = await userRepository.findById(sellerId);
    if (!seller || seller.role !== 'seller') {
      throw new Error('Seller not found');
    }
      
      // Store in cache for future requests
      await redisClient.set(
        cacheKey,
        seller.storeInfo,
        this.CACHE_TTL.SELLER_STORE
      );
      
      logger.info(`Cache miss: Seller store for ${sellerId} fetched from database and cached`);
      return seller.storeInfo;
    } catch (error) {
      logger.error(`Error getting seller store for ${sellerId}:`, error);
      throw error;
    }
  }

  // Get buyer shipping address
  async getBuyerShippingAddress(buyerId) {
    try {
      // Try to get from cache first
      const cacheKey = `${this.CACHE_KEYS.BUYER_ADDRESS}${buyerId}`;
      const cachedAddress = await redisClient.get(cacheKey);
      
      if (cachedAddress) {
        logger.info(`Cache hit: Buyer address for ${buyerId} fetched from cache`);
        return cachedAddress;
      }
      
      // If not in cache, get from database
      const buyer = await userRepository.findById(buyerId);
    if (!buyer || buyer.role !== 'buyer') {
      throw new Error('Buyer not found');
    }
      
      // Store in cache for future requests
      await redisClient.set(
        cacheKey,
        buyer.shippingAddress,
        this.CACHE_TTL.BUYER_ADDRESS
      );
      
      logger.info(`Cache miss: Buyer address for ${buyerId} fetched from database and cached`);
      return buyer.shippingAddress;
    } catch (error) {
      logger.error(`Error getting buyer address for ${buyerId}:`, error);
      throw error;
    }
  }

  // Update user status (admin only)
  async updateUserStatus(userId, status) {
    try {
      if (!['active', 'suspended', 'deactivated'].includes(status)) {
        throw new Error('Invalid status value');
      }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

      user.status = status;
      await user.save();
      
      // Invalidate relevant caches
      await this.invalidateUserCache(userId, user.email);
      
      if (user.role === 'seller') {
        await redisClient.deletePattern(`${this.CACHE_KEYS.SELLERS_BY_STATUS}*`);
      }
      
      return user;
    } catch (error) {
      logger.error(`Error updating user status for ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = new UserService(); 