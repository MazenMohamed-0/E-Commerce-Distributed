const User = require('../models/User');

class UserService {
  // Get all users with role filtering
  async getAllUsers(role = null) {
    const query = role ? { role } : {};
    return await User.find(query).select('-password');
  }

  // Get all sellers with status filtering
  async getAllSellers(status = null) {
    const query = { role: 'seller' };
    if (status) {
      query.sellerStatus = status;
    }
    return await User.find(query).select('-password');
  }

  // Get all buyers
  async getAllBuyers() {
    return await this.getAllUsers('buyer');
  }

  // Get user by ID
  async getUserById(id) {
    const user = await User.findById(id).select('-password');
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  // Create new user with role validation
  async createUser(userData) {
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
    const existingUser = await User.findOne({ email });
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
    const user = new User({
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
    });

    await user.save();
    
    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    
    return userResponse;
  }

  // Update user with role-specific validations
  async updateUser(id, updates, isAdmin) {
    const user = await User.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Special handling for admin routes - allow all updates
    if (isAdmin) {
      console.log('Admin update with data:', updates);
      
      // Handle basic fields
      if (updates.name) user.name = updates.name;
      if (updates.email) user.email = updates.email;
      if (updates.password) user.password = updates.password;
      
      // Role changes are not allowed through the edit form
      // We keep the existing role
      
      // Handle status - this is what was missing
      if (updates.status) {
        user.status = updates.status;
      }
      
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
      
      await user.save();
      const userResponse = user.toObject();
      delete userResponse.password;
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
    return userResponse;
  }

  // Delete user
  async deleteUser(id) {
    const result = await User.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new Error('User not found');
    }
    return { message: 'User deleted successfully' };
  }

  // Check if user has permission to access/modify another user's data
  hasPermission(currentUser, targetUserId) {
    return currentUser.role === 'admin' || currentUser._id.toString() === targetUserId;
  }

  // Get pending seller applications
  async getPendingSellers() {
    return await User.find({ 
      role: 'seller', 
      sellerStatus: 'pending' 
    }).select('-password');
  }

  // Approve seller application
  async approveSeller(sellerId) {
    const seller = await User.findById(sellerId);
    if (!seller || seller.role !== 'seller') {
      throw new Error('Seller not found');
    }
    seller.sellerStatus = 'approved';
    await seller.save();
    return { message: 'Seller approved successfully' };
  }

  // Reject seller application
  async rejectSeller(sellerId, reason) {
    const seller = await User.findById(sellerId);
    if (!seller || seller.role !== 'seller') {
      throw new Error('Seller not found');
    }
    seller.sellerStatus = 'rejected';
    seller.rejectionReason = reason;
    await seller.save();
    return { message: 'Seller rejected successfully' };
  }

  // Get seller's store information
  async getSellerStore(sellerId) {
    const seller = await User.findById(sellerId).select('storeInfo sellerStatus');
    if (!seller || seller.role !== 'seller') {
      throw new Error('Seller not found');
    }
    return seller;
  }

  // Get buyer's shipping address
  async getBuyerShippingAddress(buyerId) {
    const buyer = await User.findById(buyerId).select('shippingAddress');
    if (!buyer || buyer.role !== 'buyer') {
      throw new Error('Buyer not found');
    }
    return buyer;
  }

  // Update user status (admin only)
  async updateUserStatus(userId, status) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate status
    if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      throw new Error('Invalid status');
    }

    user.status = status;
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    return userResponse;
  }
}

module.exports = new UserService(); 