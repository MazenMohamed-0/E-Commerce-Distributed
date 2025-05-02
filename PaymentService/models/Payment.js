const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['created', 'approved', 'failed', 'completed', 'cancelled'],
    default: 'created',
    index: true
  },
  paypalPaymentId: {
    type: String,
    index: true
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  payer: {
    type: Object
  },
  transactions: {
    type: Array
  },
  error: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0
  },
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    message: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Add pre-save middleware to track status changes
paymentSchema.pre('save', function(next) {
  // Add status change to history if status changed
  if (this.isModified('status')) {
    if (!this.statusHistory) {
      this.statusHistory = [];
    }
    
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      message: `Payment status changed to ${this.status}`
    });
  }
  
  next();
});

module.exports = mongoose.model('Payment', paymentSchema); 