const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const sagaOrchestrator = require('../services/sagaOrchestratorService');
const { verifyToken, isAuthorized, isAdmin, isBuyer, isSeller } = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const eventTypes = require('../../shared/eventTypes');
const orderEventHandler = require('../events/orderEventHandler');
const axios = require('axios');

// Apply JWT verification to all routes
router.use(verifyToken);

// Get all orders (admin only)
router.get('/', isAdmin, async (req, res) => {
    try {
        const orders = await orderService.getAllOrders();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get orders for the authenticated user (buyer only)
router.get('/my-orders', isBuyer, async (req, res) => {
    try {
        const orders = await orderService.getUserOrders(req.user.userId);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get orders for products created by the seller (seller only)
router.get('/seller-orders', isSeller, async (req, res) => {
    try {
        const orders = await orderService.getOrdersForSeller(req.user.userId);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single order (only if user owns the order or is admin)
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const order = await orderService.getOrderById(req.params.id);
        
        // Check if order belongs to authenticated user or user is admin
        if (order.userId !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You do not have permission to view this order' });
        }
        
        res.json(order);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// Create order with simplified process
router.post('/', verifyToken, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, totalAmount } = req.body;
    const userId = req.user.userId;
    const userEmail = req.user.email; // Extract email from JWT token
    
    console.log(`[ORDER ROUTES] Creating order for user: ${userId}, email: ${userEmail}`);
    
    // Basic validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order validation failed: items array is required and must not be empty' });
    }
    
    if (!shippingAddress) {
      return res.status(400).json({ message: 'Order validation failed: shippingAddress is required' });
    }
    
    // Validate user email
    if (!userEmail) {
      console.warn(`[ORDER ROUTES] No email found in JWT token for user ${userId}`);
    }
    
    // Create order and check availability/stock in one step
    try {
      // Process order
      const order = await orderService.createOrder(userId, {
        items,
        shippingAddress,
        paymentMethod: paymentMethod || 'cash',
        totalAmount
      }, userEmail); // Pass the userEmail from JWT
      
      // Return response based on payment method
      if (order.paymentMethod === 'stripe' && order.payment?.stripeClientSecret) {
        res.status(201).json({
          message: 'Order created successfully',
          orderId: order._id,
          status: order.status,
          hasStripePayment: true,
          stripeClientSecret: order.payment.stripeClientSecret
        });
      } else {
        // For cash payment or completed orders
        res.status(201).json({
          message: 'Order created successfully',
          orderId: order._id,
          status: order.status
        });
      }
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get order status - for polling from frontend
router.get('/:id/status', verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ 
        message: 'Order not found',
        status: 'error',
        orderId: req.params.id
      });
    }
    
    // Check if order belongs to authenticated user
    if (order.userId !== req.user.userId) {
      return res.status(403).json({ 
        message: 'Not authorized to view this order',
        status: 'error',
        orderId: req.params.id
      });
    }
    
    // Check if we need payment info but don't have it yet
    const needsPaymentInfo = order.status === 'processing' && 
                            order.paymentMethod === 'stripe' && 
                            (!order.payment || !order.payment.stripeClientSecret);
    
    if (needsPaymentInfo) {
      try {
        // Try to get payment info from payment service
        const paymentResult = await sagaOrchestrator.initiatePayment(order, order.sagaId || uuidv4());
        
        // Refresh order to get updated payment info
        await order.save();
      } catch (paymentError) {
        // Continue with the available info even if getting payment info fails
      }
    }
    
    // Create response with all necessary information
    const responseData = { 
      orderId: order._id,
      status: order.status,
      totalAmount: order.totalAmount,
      paymentUrl: order.payment?.paymentUrl || order.paymentUrl || null,
      message: getStatusMessage(order.status),
      error: order.error || null,
      payment: {
        status: order.payment?.status,
        hasPaymentIntent: !!order.payment?.stripePaymentIntentId,
        hasClientSecret: !!order.payment?.stripeClientSecret
      }
    };
    
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ 
      message: `Error retrieving order status: ${error.message}`,
      status: 'error',
      orderId: req.params.id
    });
  }
});

// Helper function to get user-friendly status message
function getStatusMessage(status) {
  const messages = {
    'pending': 'Your order is being processed',
    'processing': 'Processing your order and payment',
    'completed': 'Order completed successfully',
    'failed': 'Order processing failed',
    'cancelled': 'Order was cancelled'
  };
  return messages[status] || 'Processing your order';
}

// Update order status (admin only)
router.patch('/:id/status', isAdmin, async (req, res) => {
    try {
        const updatedOrder = await orderService.processOrder(req.params.id);
        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Cancel order (buyer or admin)
router.post('/:id/cancel', async (req, res) => {
    try {
        const { reason } = req.body;
        const updatedOrder = await orderService.cancelOrder(req.params.id, reason);
        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Force complete order (admin only)
router.post('/:id/complete', isAdmin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Update order status
        order.status = 'completed';
        if (order.payment) {
            order.payment.status = 'completed';
        }
        
        // Add to status history
        if (!order.statusHistory) {
            order.statusHistory = [];
        }
        
        order.statusHistory.push({
            status: 'completed',
            timestamp: new Date(),
            message: 'Order manually completed by admin'
        });
        
        await order.save();
        
        // Publish order completed event to trigger stock reduction
        await orderEventHandler.publishOrderEvent(eventTypes.ORDER_COMPLETED, {
            orderId: order._id,
            userId: order.userId
        });
        
        res.json({
            message: 'Order successfully marked as completed',
            order: {
                _id: order._id,
                status: order.status,
                updatedAt: order.updatedAt
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Refund payment for failed order (admin only)
router.post('/:id/refund', isAdmin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Check if this is a failed order with completed payment
        if (order.status !== 'failed' || order.payment?.status !== 'completed') {
            return res.status(400).json({ 
                message: 'Refund is only available for failed orders with completed payments',
                orderStatus: order.status,
                paymentStatus: order.payment?.status
            });
        }
        
        // Call payment service to process the refund
        try {
            const paymentId = order.payment.paymentId || order.payment.stripePaymentIntentId;
            
            if (!paymentId) {
                return res.status(400).json({ message: 'No payment ID found for refund' });
            }
            
            const refundResponse = await axios.post(
                `${process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005'}/payments/refund`,
                {
                    paymentId,
                    orderId: order._id,
                    amount: order.totalAmount,
                    reason: 'Order failed but payment was processed'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${req.headers.authorization.split(' ')[1]}`
                    }
                }
            );
            
            // Update order with refund info
            if (!order.payment.refunds) {
                order.payment.refunds = [];
            }
            
            order.payment.refunds.push({
                refundId: refundResponse.data.refundId,
                amount: order.totalAmount,
                status: 'completed',
                reason: 'Order failed but payment was processed',
                createdAt: new Date()
            });
            
            // Add to status history
            if (!order.statusHistory) {
                order.statusHistory = [];
            }
            
            order.statusHistory.push({
                status: 'payment_refunded',
                timestamp: new Date(),
                message: 'Payment refunded by admin'
            });
            
            await order.save();
            
            res.json({
                message: 'Payment refund initiated successfully',
                order: {
                    _id: order._id,
                    status: order.status,
                    paymentStatus: order.payment.status,
                    refunded: true
                }
            });
        } catch (refundError) {
            res.status(500).json({ 
                message: `Error processing refund: ${refundError.message}`,
                orderDetails: {
                    orderId: order._id,
                    paymentId: order.payment?.paymentId || order.payment?.stripePaymentIntentId
                }
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Test endpoint for email sending
router.post('/test-email', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email; // Extract email from JWT token
    
    // Log the full token object for debugging
    console.log(`[TEST EMAIL] JWT token contains: ${JSON.stringify(req.user)}`);
    
    if (!userEmail) {
      return res.status(400).json({ 
        message: 'No email found in JWT token. Make sure your token includes the email claim.',
        tokenContents: req.user
      });
    }
    
    console.log(`[TEST EMAIL] Sending test email to: ${userEmail}`);
    
    // Create a test order
    const testOrder = {
      _id: `test-${Date.now()}`,
      userId: userId,
      userEmail: userEmail,
      totalAmount: 199.99,
      status: 'processing',
      paymentMethod: 'Credit Card',
      createdAt: new Date(),
      shippingAddress: {
        fullName: "Test User",
        addressLine1: "123 Test Street",
        city: "Test City",
        state: "TS",
        postalCode: "12345",
        country: "Test Country",
        phoneNumber: "555-123-4567"
      },
      items: [
        {
          productId: "test-product-1",
          productName: "Test Product 1",
          quantity: 1,
          price: 99.99
        },
        {
          productId: "test-product-2",
          productName: "Test Product 2",
          quantity: 2,
          price: 49.99
        }
      ]
    };
    
    // Send the email
    const result = await orderService.sendOrderConfirmationEmail(testOrder);
    
    if (result.success) {
      res.status(200).json({ 
        message: 'Test email sent successfully', 
        messageId: result.messageId, 
        recipient: userEmail,
        tokenDecoded: req.user
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to send test email', 
        error: result.error, 
        tokenDecoded: req.user
      });
    }
  } catch (error) {
    console.error('[TEST EMAIL] Error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;