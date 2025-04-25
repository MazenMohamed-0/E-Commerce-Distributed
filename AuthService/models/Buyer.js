const mongoose = require('mongoose');
const User = require('../models/User');

const buyerSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  shippingAddress: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    }
  }
});

// Create the Buyer model using discriminator
const Buyer = User.discriminator('buyer', buyerSchema);

module.exports = Buyer;