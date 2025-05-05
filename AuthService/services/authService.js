const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Buyer = require('../models/Buyer');
const redisClient = require('../../shared/redis');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'auth-service.log' })
  ]
});

class AuthService {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    
    // Define cache keys and TTLs
    this.CACHE_KEYS = {
      USER_PROFILE: 'user:profile:',
      USER_BY_EMAIL: 'user:email:',
      TOKEN_VERIFICATION: 'token:verify:',
      USER_SESSION: 'user:session:'
    };
    
    this.CACHE_TTL = {
      USER_PROFILE: 3600, // 1 hour
      USER_BY_EMAIL: 600, // 10 minutes
      TOKEN_VERIFICATION: 300, // 5 minutes - shorter TTL for security
      USER_SESSION: 86400 // 24 hours - matches token expiry
    };
  }
  
  // Helper method to invalidate user auth caches
  async invalidateAuthCache(userId, email, token) {
    try {
      const keysToDelete = [
        `${this.CACHE_KEYS.USER_PROFILE}${userId}`,
        `${this.CACHE_KEYS.USER_SESSION}${userId}`
      ];
      
      if (email) {
        keysToDelete.push(`${this.CACHE_KEYS.USER_BY_EMAIL}${email}`);
      }
      
      if (token) {
        keysToDelete.push(`${this.CACHE_KEYS.TOKEN_VERIFICATION}${token}`);
      }
      
      for (const key of keysToDelete) {
        await redisClient.delete(key);
      }
      
      logger.info(`Auth cache invalidated for user ${userId}`);
    } catch (error) {
      logger.error(`Error invalidating auth cache for user ${userId}:`, error);
    }
  }

  generateToken(user) {
    return jwt.sign(
      { 
        userId: user._id,
        role: user.role,
        email: user.email
      },
      this.secret,
      { expiresIn: '24h' }
    );
  }

  async register(userData) {
    try {
      console.log('Registering user with data:', userData);
      
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Create user based on role
      let user;
      if (userData.role === 'seller') {
        console.log('Creating seller user');
        user = new Seller({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          storeName: userData.storeInfo.storeName,
          taxNumber: userData.storeInfo.taxNumber,
          storeDescription: userData.storeInfo.storeDescription || '',
          contactNumber: userData.storeInfo.contactNumber || '',
          status: 'pending'
        });
      } else {
        console.log('Creating buyer user');
        user = new Buyer({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          status: 'approved'
        });
      }

      await user.save();
      console.log('User saved successfully');

      // Prepare the user object with base fields
      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      };

      // Add seller-specific fields if the user is a seller
      if (user.role === 'seller') {
        // Always include storeInfo for sellers
        userResponse.storeInfo = {
          storeName: user.storeName || '',
          taxNumber: user.taxNumber || '',
          storeDescription: user.storeDescription || '',
          contactNumber: user.contactNumber || '',
          status: user.status || 'pending'
        };

        // If user is a seller with pending status, don't generate token
        if (user.status === 'pending') {
          return {
            user: userResponse,
            message: 'Your seller account is pending approval. Please wait for admin verification.'
          };
        }
      }

      // Generate token for non-seller users or approved sellers
      const token = this.generateToken(user);
      
      // Cache the user session
      await this.cacheUserSession(user._id, token, userResponse);

      return {
        user: userResponse,
        token
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error('Registration failed: ' + error.message);
    }
  }
  
  // Helper method to cache user session data
  async cacheUserSession(userId, token, userData) {
    try {
      // Cache user session with token
      await redisClient.set(
        `${this.CACHE_KEYS.USER_SESSION}${userId}`,
        { token, userData },
        this.CACHE_TTL.USER_SESSION
      );
      
      // Cache token verification data
      await redisClient.set(
        `${this.CACHE_KEYS.TOKEN_VERIFICATION}${token}`,
        { userId, role: userData.role, email: userData.email },
        this.CACHE_TTL.TOKEN_VERIFICATION
      );
      
      logger.info(`User session cached for user ${userId}`);
    } catch (error) {
      logger.error(`Error caching user session for ${userId}:`, error);
    }
  }

  async login(email, password) {
    try {
      // Try to get user from cache first
      const cacheKey = `${this.CACHE_KEYS.USER_BY_EMAIL}${email}`;
      let user = null;
      
      const cachedUser = await redisClient.get(cacheKey);
      if (cachedUser) {
        logger.info(`Cache hit: User with email ${email} fetched from cache`);
        user = cachedUser;
      } else {
        // Find user in database
        user = await User.findOne({ email });
        
        if (user) {
          // Store a copy for cache operations, preserving the original for password comparison
          const userForCache = user.toObject();
          
          // Cache user for future requests
          await redisClient.set(
            cacheKey,
            userForCache,
            this.CACHE_TTL.USER_BY_EMAIL
          );
          logger.info(`Cache miss: User with email ${email} fetched from database and cached`);
        }
      }
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // If user came from cache, we need to get a fresh copy for password comparison
      // as the password hash comparison requires the mongoose methods
      let freshUser = user;
      if (cachedUser) {
        freshUser = await User.findOne({ email });
        if (!freshUser) {
          throw new Error('User no longer exists');
        }
      }

      // Check password (must use the mongoose document for this)
      const isMatch = await freshUser.comparePassword(password);
      if (!isMatch) {
        throw new Error('Invalid credentials');
      }

      // For the remaining operations, ensure we have a plain object
      const userObj = cachedUser ? user : user.toObject();

      // Check if user is a pending seller
      if (userObj.role === 'seller' && userObj.status === 'pending') {
        return {
          user: {
            id: userObj._id,
            name: userObj.name,
            email: userObj.email,
            role: userObj.role,
            status: userObj.status,
            storeName: userObj.storeName,
            taxNumber: userObj.taxNumber,
            storeDescription: userObj.storeDescription,
            contactNumber: userObj.contactNumber
          },
          pendingSeller: true,
          message: 'Your seller account is pending approval. Please wait for admin verification.'
        };
      }

      // Check if user is a rejected seller
      if (userObj.role === 'seller' && userObj.status === 'rejected') {
        throw new Error('Your seller account has been rejected. Please contact support for more information.');
      }

      // Check if user is a suspended seller
      if (userObj.role === 'seller' && userObj.status === 'suspended') {
        throw new Error('Your seller account has been suspended. Please contact support for more information.');
      }

      // Generate token for approved users
      // Use the mongoose document for generating the token
      const token = this.generateToken(freshUser);
      
      const userResponse = {
        id: userObj._id,
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        status: userObj.status,
        ...(userObj.role === 'seller' && {
          storeName: userObj.storeName,
          taxNumber: userObj.taxNumber,
          storeDescription: userObj.storeDescription,
          contactNumber: userObj.contactNumber
        })
      };
      
      // Cache the user session
      await this.cacheUserSession(userObj._id, token, userResponse);
      
      return {
        user: userResponse,
        token
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async changeUserRole(userId, newRole) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.role = newRole;
      await user.save();
      
      // Invalidate user caches
      await this.invalidateAuthCache(userId, user.email);

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      };
    } catch (error) {
      throw new Error('Failed to change user role: ' + error.message);
    }
  }

  verifyToken(token) {
    try {
      // Try to get from cache first
      return new Promise(async (resolve, reject) => {
        try {
          const cacheKey = `${this.CACHE_KEYS.TOKEN_VERIFICATION}${token}`;
          const cachedVerification = await redisClient.get(cacheKey);
          
          if (cachedVerification) {
            logger.info(`Cache hit: Token verification fetched from cache`);
            return resolve(cachedVerification);
          }
          
          // If not in cache, verify with JWT
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // Store in cache for future requests
          await redisClient.set(
            cacheKey,
            decoded,
            this.CACHE_TTL.TOKEN_VERIFICATION
          );
          
          logger.info(`Cache miss: Token verification performed and cached`);
          resolve(decoded);
        } catch (error) {
          logger.error('Token verification error:', error);
          reject(new Error('Invalid token'));
        }
      });
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async getUserProfile(userId) {
    try {
      // Try to get from cache first
      const cacheKey = `${this.CACHE_KEYS.USER_PROFILE}${userId}`;
      const cachedProfile = await redisClient.get(cacheKey);
      
      if (cachedProfile) {
        logger.info(`Cache hit: User profile for ${userId} fetched from cache`);
        return cachedProfile;
      }
      
      // If not in cache, get from database
      const user = await User.findById(userId).select('-password');
      if (!user) {
        throw new Error('User not found');
      }

      // Convert to proper format expected by the client
      // Important: Use id instead of _id
      const userProfile = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        status: user.status || 'approved'
      };

      // Add role-specific fields
      if (user.role === 'seller') {
        userProfile.storeInfo = {
          storeName: user.storeName || '',
          taxNumber: user.taxNumber || '',
          storeDescription: user.storeDescription || '',
          contactNumber: user.contactNumber || '',
          status: user.status || 'pending'
        };
      }
      
      // Store in cache for future requests
      await redisClient.set(
        cacheKey,
        userProfile,
        this.CACHE_TTL.USER_PROFILE
      );
      
      logger.info(`Cache miss: User profile for ${userId} fetched from database and cached`);
      return userProfile;
    } catch (error) {
      logger.error(`Error getting user profile for ${userId}:`, error);
      throw new Error('Failed to get user profile: ' + error.message);
    }
  }

  async logout(userId, token) {
    try {
      // Invalidate user caches
      await this.invalidateAuthCache(userId, null, token);
      
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      logger.error(`Error during logout for user ${userId}:`, error);
      throw new Error('Logout failed: ' + error.message);
    }
  }
}

module.exports = new AuthService();