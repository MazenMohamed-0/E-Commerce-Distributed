const mongoose = require('mongoose');
const User = require('../models/User');

const adminSchema = new mongoose.Schema({
  // Add any admin-specific fields here
  permissions: {
    type: [String],
    default: ['manage_users', 'manage_sellers', 'manage_products']
  }
});

// Create the Admin model using discriminator
const Admin = User.discriminator('admin', adminSchema);

module.exports = Admin; 