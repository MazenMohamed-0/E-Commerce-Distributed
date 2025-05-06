const mongoose = require('mongoose');
const User = require('../models/User');

const adminSchema = new mongoose.Schema({
  permissions: {
    canManageUsers: {
      type: Boolean,
      default: true
    },
    canManageSellers: {
      type: Boolean,
      default: true
    },
    canManageProducts: {
      type: Boolean,
      default: true
    },
    canManageOrders: {
      type: Boolean,
      default: true
    },
    superAdmin: {
      type: Boolean,
      default: false
    }
  },
  lastLogin: {
    type: Date
  }
});

// Create the Admin model using discriminator
const Admin = User.discriminator('admin', adminSchema);

module.exports = Admin; 