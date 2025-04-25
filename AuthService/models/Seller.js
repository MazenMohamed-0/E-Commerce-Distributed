const mongoose = require('mongoose');
const User = require('../models/User');

const sellerSchema = new mongoose.Schema({
  storeName: {
    type: String,
    required: true,
    trim: true
  },
  taxNumber: {
    type: String,
    required: true,
    trim: true
  },
  storeDescription: {
    type: String,
    trim: true,
    default: ''
  },
  contactNumber: {
    type: String,
    trim: true,
    default: ''
  },
  rejectionReason: {
    type: String,
    trim: true
  }
});

// Create the Seller model using discriminator
const Seller = User.discriminator('seller', sellerSchema);

module.exports = Seller;