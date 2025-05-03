const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['paypal', 'stripe', 'credit_card'],
    required: true,
    default: 'stripe'
  },
  // PayPal specific fields
  paypalOrderId: {
    type: String,
    sparse: true,
    index: true
  },
  paypalPaymentId: {
    type: String,
    sparse: true
  },
  // Stripe specific fields
  stripePaymentIntentId: {
    type: String,
    sparse: true,
    index: true
  },
  stripeClientSecret: {
    type: String
  },
  error: {
    message: String,
    code: String,
    timestamp: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Update timestamp on save
paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Payment', paymentSchema); 