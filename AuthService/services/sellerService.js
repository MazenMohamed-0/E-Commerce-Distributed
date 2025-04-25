const Seller = require('../models/Seller');

class SellerService {
  // Get all sellers with status filtering
  async getAllSellers(status = null) {
    const query = status ? { status } : {};
    return await Seller.find(query).select('-password');
  }

  // Get seller by ID
  async getSellerById(id) {
    const seller = await Seller.findById(id).select('-password');
    if (!seller) {
      throw new Error('Seller not found');
    }
    return seller;
  }

  // Get seller store information
  async getSellerStoreInfo(id) {
    const seller = await Seller.findById(id).select('name storeName status');
    if (!seller) {
      throw new Error('Seller not found');
    }

    return {
      _id: seller._id,
      name: seller.name,
      storeName: seller.storeName || 'Unknown Store',
      status: seller.status
    };
  }

  // Get multiple seller store information
  async getMultipleSellerStoreInfo(ids) {
    const sellers = await Seller.find({ _id: { $in: ids } })
      .select('name storeName status');

    return sellers.map(seller => ({
      _id: seller._id,
      name: seller.name,
      storeName: seller.storeName || 'Unknown Store',
      status: seller.status
    }));
  }

  // Create new seller
  async createSeller(sellerData) {
    const { name, email, password, storeInfo } = sellerData;

    // Validate required fields
    if (!name || !email || !password || !storeInfo?.storeName || !storeInfo?.taxNumber) {
      throw new Error('Missing required fields');
    }

    // Check if seller already exists
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      throw new Error('Seller already exists with this email');
    }

    const seller = new Seller({
      name,
      email,
      password,
      role: 'seller',
      storeInfo,
      status: 'pending'
    });

    await seller.save();
    
    const sellerResponse = seller.toObject();
    delete sellerResponse.password;
    return sellerResponse;
  }

  // Update seller
  async updateSeller(id, updates) {
    const seller = await Seller.findById(id);
    if (!seller) {
      throw new Error('Seller not found');
    }

    // Only allow updating certain fields
    const allowedUpdates = ['storeDescription', 'contactNumber'];
    const updateKeys = Object.keys(updates.storeInfo || {});

    const isValidOperation = updateKeys.every(update => 
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      throw new Error('Invalid updates');
    }

    updateKeys.forEach(key => {
      seller.storeInfo[key] = updates.storeInfo[key];
    });

    await seller.save();

    const sellerResponse = seller.toObject();
    delete sellerResponse.password;
    return sellerResponse;
  }

  // Get pending sellers
  async getPendingSellers() {
    return await Seller.find({ status: 'pending' }).select('-password');
  }

  // Approve seller
  async approveSeller(sellerId) {
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      throw new Error('Seller not found');
    }
    seller.status = 'approved';
    await seller.save();
    return { message: 'Seller approved successfully' };
  }

  // Reject seller
  async rejectSeller(sellerId, reason) {
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      throw new Error('Seller not found');
    }
    seller.status = 'rejected';
    seller.rejectionReason = reason;
    await seller.save();
    return { message: 'Seller rejected successfully' };
  }
}

module.exports = new SellerService(); 