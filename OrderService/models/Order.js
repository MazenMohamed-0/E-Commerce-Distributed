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
  productName: {
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
    required: true,
    min: 0
  },
  imageUrl: {
    type: String,
    required: false
  }
});

const orderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: false,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: [
      'pending',
      'processing',
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
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(address) {
        // Check if it's a string or an object with required fields
        if (typeof address === 'string') {
          return address.trim().length > 0;
        }
        return address && 
               address.fullName && 
               address.addressLine1 && 
               address.city && 
               address.state && 
               address.postalCode && 
               address.country && 
               address.phoneNumber;
      },
      message: 'Shipping address must include fullName, addressLine1, city, state, postalCode, country, and phoneNumber'
    }
  },
  billingAddress: {
    fullName: {
      type: String
    },
    addressLine1: {
      type: String
    },
    addressLine2: {
      type: String
    },
    city: {
      type: String
    },
    state: {
      type: String
    },
    postalCode: {
      type: String
    },
    country: {
      type: String,
      default: 'US'
    },
    phoneNumber: {
      type: String
    }
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'paypal', 'credit_card', 'bank_transfer', 'stripe'],
    default: 'stripe',
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
    paypalOrderId: {
      type: String,
      sparse: true
    },
    stripePaymentIntentId: {
      type: String,
      sparse: true
    },
    stripeClientSecret: {
      type: String
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
  shipping: {
    carrier: {
      type: String
    },
    trackingNumber: {
      type: String,
      sparse: true
    },
    estimatedDelivery: {
      type: Date
    },
    actualDelivery: {
      type: Date
    },
    shippingCost: {
      type: Number,
      default: 0
    }
  },
  tax: {
    amount: {
      type: Number,
      default: 0
    },
    rate: {
      type: Number,
      default: 0
    }
  },
  discount: {
    code: {
      type: String
    },
    amount: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number
    }
  },
  notes: {
    type: String
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
}, { timestamps: true });

// Update the pre-save middleware to calculate totalAmount automatically if not provided
orderSchema.pre('save', function(next) {
  // Update timestamps
  this.updatedAt = Date.now();
  
  // Calculate totalAmount if not provided
  if (!this.totalAmount || this.totalAmount <= 0) {
    this.totalAmount = this.items.reduce((total, item) => {
      return total + (parseFloat(item.price) * parseInt(item.quantity));
    }, 0);
  }
  
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
  if (paymentData.paypalOrderId) this.payment.paypalOrderId = paymentData.paypalOrderId;
  if (paymentData.amount) this.payment.amount = paymentData.amount;
  if (paymentData.paymentUrl) this.payment.paymentUrl = paymentData.paymentUrl;
  if (paymentData.stripePaymentIntentId) this.payment.stripePaymentIntentId = paymentData.stripePaymentIntentId;
  
  this.payment.updatedAt = new Date();
  
  // Handle payment status updates
  if (paymentData.status === 'completed') {
    // If order is already failed, we should not update it to completed
    if (this.status === 'failed') {
      // Add to status history but don't change order status
      if (!this.statusHistory) {
        this.statusHistory = [];
      }
      
      this.statusHistory.push({
        status: 'payment_completed_but_order_failed',
        timestamp: new Date(),
        message: 'Payment was completed but order had already failed (stock validation failed or other issues)'
      });
      
      // Keep payment status as completed
      this.payment.status = 'completed';
      
      // Leave order status as 'failed'
    } 
    // If order is in a valid state for completion (pending or processing)
    else if (this.status === 'pending' || this.status === 'processing') {
      // Mark payment as completed
      this.payment.status = 'completed';
      
      // Then update the order status directly to completed
      this.status = 'completed';
      
      // Add to status history
      if (!this.statusHistory) {
        this.statusHistory = [];
      }
      
      this.statusHistory.push({
        status: 'completed',
        timestamp: new Date(),
        message: 'Order completed automatically after successful payment'
      });
    }
  } 
  // Handle failed payment
  else if (paymentData.status === 'failed') {
    this.payment.status = 'failed';
    
    // Only update order status to failed if it's in a pending or processing state 
    // (don't change completed orders to failed)
    if (['pending', 'processing'].includes(this.status)) {
      this.status = 'failed';
      
      if (paymentData.error) {
        this.error = {
          message: paymentData.error,
          step: 'payment',
          timestamp: new Date()
        };
      }
    }
  }
};

// Static method to calculate total amount
orderSchema.statics.calculateTotalAmount = function(items) {
  return items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
};

// Virtual for total items count
orderSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

module.exports = mongoose.model('Order', orderSchema); 