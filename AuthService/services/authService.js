const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Buyer = require('../models/Buyer');

class AuthService {
  constructor() {
    this.secret = process.env.JWT_SECRET;
  }

  generateToken(user) {
    return jwt.sign(
      { 
        userId: user._id,
        role: user.role
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
          role: userData.role
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

      return {
        user: userResponse,
        token
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error('Registration failed: ' + error.message);
    }
  }

  async login(email, password) {
    try {
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw new Error('Invalid credentials');
      }

      // Check if user is a pending seller
      if (user.role === 'seller' && user.status === 'pending') {
        return {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            storeName: user.storeName,
            taxNumber: user.taxNumber,
            storeDescription: user.storeDescription,
            contactNumber: user.contactNumber
          },
          pendingSeller: true,
          message: 'Your seller account is pending approval. Please wait for admin verification.'
        };
      }

      // Check if user is a rejected seller
      if (user.role === 'seller' && user.status === 'rejected') {
        throw new Error('Your seller account has been rejected. Please contact support for more information.');
      }

      // Check if user is a suspended seller
      if (user.role === 'seller' && user.status === 'suspended') {
        throw new Error('Your seller account has been suspended. Please contact support for more information.');
      }

      // Generate token for approved users
      const token = this.generateToken(user);
      
      return {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          ...(user.role === 'seller' && {
            storeName: user.storeName,
            taxNumber: user.taxNumber,
            storeDescription: user.storeDescription,
            contactNumber: user.contactNumber
          })
        },
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
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async getUserProfile(userId) {
    try {
      // Try to find user in any of the user collections
      let user = await User.findById(userId);
      
      if (!user) {
        // If not found in User collection, try Seller
        user = await Seller.findById(userId);
      }
      
      if (!user) {
        // If not found in Seller collection, try Buyer
        user = await Buyer.findById(userId);
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Prepare the response object with common fields
      const userProfile = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      };

      // Add seller-specific fields if the user is a seller
      if (user.role === 'seller') {
        userProfile.storeName = user.storeName;
        userProfile.taxNumber = user.taxNumber;
        userProfile.storeDescription = user.storeDescription;
        userProfile.contactNumber = user.contactNumber;
        userProfile.status = user.status;
      }

      return userProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }
}

module.exports = new AuthService();