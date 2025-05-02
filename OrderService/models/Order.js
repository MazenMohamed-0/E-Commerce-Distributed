const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  sellerId: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: [
      'pending',
      'stock_validating',
      'stock_validated',
      'payment_pending',
      'payment_completed',
      'completed',
      'failed',
      'cancelled'
    ],
    default: 'pending',
    index: true
  },
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    message: String
  }],
  shippingAddress: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'paypal'],
    default: 'cash',
    index: true
  },
  // Payment references (not full payment data)
  payment: {
    serviceId: {
      type: String,
      default: 'payment-service'
    },
    paymentId: {
      type: String,
      sparse: true,
      index: true
    },
    paypalPaymentId: {
      type: String,
      sparse: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending'
    },
    amount: {
      type: Number
    },
    updatedAt: {
      type: Date
    },
    paymentUrl: {
      type: String
    }
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  sagaId: {
    type: String,
    index: true
  },
  error: {
    message: String,
    step: String,
    timestamp: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add pre-save middleware to handle status changes
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Add status change to history if status changed
  if (this.isModified('status')) {
    if (!this.statusHistory) {
      this.statusHistory = [];
    }
    
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      message: `Order status changed to ${this.status}`
    });
  }
  
  // Add payment status change to history if payment status changed
  if (this.isModified('payment.status')) {
    if (!this.statusHistory) {
      this.statusHistory = [];
    }
    
    this.statusHistory.push({
      status: `payment_${this.payment.status}`,
      timestamp: new Date(),
      message: `Payment status changed to ${this.payment.status}`
    });
    
    // Update payment.updatedAt
    this.payment.updatedAt = new Date();
  }
  
  next();
});

// Method to update payment info (called when receiving data from Payment service)
orderSchema.methods.updatePaymentInfo = function(paymentData) {
  if (!this.payment) {
    this.payment = {};
  }
  
  // Update only relevant fields
  if (paymentData.status) this.payment.status = paymentData.status;
  if (paymentData.paymentId) this.payment.paymentId = paymentData.paymentId;
  if (paymentData.paypalPaymentId) this.payment.paypalPaymentId = paymentData.paypalPaymentId;
  if (paymentData.amount) this.payment.amount = paymentData.amount;
  if (paymentData.paymentUrl) this.payment.paymentUrl = paymentData.paymentUrl;
  
  this.payment.updatedAt = new Date();
  
  // Update order status based on payment status
  if (paymentData.status === 'completed' && this.status === 'payment_pending') {
    this.status = 'payment_completed';
  } else if (paymentData.status === 'failed' && ['pending', 'payment_pending'].includes(this.status)) {
    this.status = 'failed';
    if (paymentData.error) {
      this.error = {
        message: paymentData.error,
        step: 'payment',
        timestamp: new Date()
      };
    }
  }
};

module.exports = mongoose.model('Order', orderSchema); 