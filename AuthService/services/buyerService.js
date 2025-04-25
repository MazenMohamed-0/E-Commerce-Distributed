const Buyer = require('../models/Buyer');

class BuyerService {
  // Get all buyers
  async getAllBuyers() {
    return await Buyer.find().select('-password');
  }

  // Get buyer by ID
  async getBuyerById(id) {
    const buyer = await Buyer.findById(id).select('-password');
    if (!buyer) {
      throw new Error('Buyer not found');
    }
    return buyer;
  }

  // Create new buyer
  async createBuyer(buyerData) {
    const { name, email, password, shippingAddress } = buyerData;

    // Validate required fields
    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required');
    }

    // Check if buyer already exists
    const existingBuyer = await Buyer.findOne({ email });
    if (existingBuyer) {
      throw new Error('Buyer already exists with this email');
    }

    const buyer = new Buyer({
      name,
      email,
      password,
      role: 'buyer',
      shippingAddress
    });

    await buyer.save();
    
    const buyerResponse = buyer.toObject();
    delete buyerResponse.password;
    return buyerResponse;
  }

  // Update buyer
  async updateBuyer(id, updates) {
    const buyer = await Buyer.findById(id);
    if (!buyer) {
      throw new Error('Buyer not found');
    }

    // Only allow updating certain fields
    const allowedUpdates = ['name', 'email', 'password', 'shippingAddress'];
    const updateKeys = Object.keys(updates);

    const isValidOperation = updateKeys.every(update => 
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      throw new Error('Invalid updates');
    }

    updateKeys.forEach(key => {
      buyer[key] = updates[key];
    });

    await buyer.save();

    const buyerResponse = buyer.toObject();
    delete buyerResponse.password;
    return buyerResponse;
  }

  // Update shipping address
  async updateShippingAddress(buyerId, address) {
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      throw new Error('Buyer not found');
    }

    buyer.shippingAddress = address;
    await buyer.save();

    return buyer.shippingAddress;
  }
}

module.exports = new BuyerService(); 