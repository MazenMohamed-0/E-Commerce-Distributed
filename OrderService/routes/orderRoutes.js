const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const sagaOrchestrator = require('../services/sagaOrchestratorService');
const { verifyToken, isAuthorized, isAdmin, isBuyer, isSeller } = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');

// Apply JWT verification to all routes
console.log('Applying JWT verification to all routes');
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

// Create order asynchronously and return immediately
router.post('/', verifyToken, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, totalAmount } = req.body;
    const userId = req.user.userId;
    
    console.log('Received order data:', JSON.stringify(req.body, null, 2));
    
    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order validation failed: items array is required and must not be empty' });
    }
    
    if (!shippingAddress) {
      return res.status(400).json({ message: 'Order validation failed: shippingAddress is required' });
    }
    
    // Validate each item has required fields
    for (const item of items) {
      if (!item.productId) {
        return res.status(400).json({ message: 'Order validation failed: items.productId is required' });
      }
      if (!item.sellerId) {
        return res.status(400).json({ message: 'Order validation failed: items.sellerId is required' });
      }
      if (!item.productName) {
        return res.status(400).json({ message: 'Order validation failed: items.productName is required' });
      }
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ message: 'Order validation failed: items.quantity must be greater than 0' });
      }
      if (item.price === undefined || item.price === null || isNaN(parseFloat(item.price))) {
        return res.status(400).json({ message: 'Order validation failed: items.price is required and must be a number' });
      }
    }
    
    // Generate idempotency key from request or use one provided by client
    const idempotencyKey = req.headers['idempotency-key'] || uuidv4();
    
    // Check for existing order with same idempotency key
    const existingOrder = await Order.findOne({ idempotencyKey });
    if (existingOrder) {
      console.log('Existing order found with idempotency key', { 
        idempotencyKey,
        orderId: existingOrder._id,
        status: existingOrder.status
      });
      
      // If the order is still in pending or failed status, try to process it again
      if (existingOrder.status === 'pending' || existingOrder.status === 'failed') {
        console.log('Existing order found in pending/failed state, reprocessing:', existingOrder._id);
        
        // Reset the order status to pending to start fresh
        existingOrder.status = 'pending';
        if (existingOrder.error) {
          existingOrder.error = null; // Clear previous errors
        }
        await existingOrder.save();
        
        // Start the saga process asynchronously - don't wait for it to finish
        sagaOrchestrator.processOrderAsync(existingOrder)
          .then(processedOrder => {
            console.log('Existing order processing completed:', {
              orderId: processedOrder._id,
              status: processedOrder.status
            });
          })
          .catch(err => {
            console.error('Error reprocessing existing order:', err);
          });
      } else {
        console.log('Existing order found with status:', existingOrder.status);
      }
      
      // Return the existing order information
      return res.status(200).json({ 
        message: 'Order already exists', 
        order: {
          _id: existingOrder._id,
          status: existingOrder.status,
          totalAmount: existingOrder.totalAmount,
          paymentMethod: existingOrder.paymentMethod,
          paymentUrl: existingOrder.payment?.paymentUrl || existingOrder.paymentUrl || null
        },
        orderId: existingOrder._id,
        status: existingOrder.status 
      });
    }
    
    // Calculate total amount if not provided
    const calculatedTotalAmount = totalAmount || items.reduce((total, item) => {
      return total + (parseFloat(item.price) * parseInt(item.quantity));
    }, 0);
    
    console.log('Creating order with total amount:', calculatedTotalAmount);
    
    // Create order with initial pending status
    const order = new Order({
      userId,
      items,
      totalAmount: calculatedTotalAmount,
      shippingAddress,
      paymentMethod: paymentMethod || 'cash',
      status: 'pending',
      idempotencyKey,
      sagaId: uuidv4(), // Generate a saga ID for tracking the order process
      payment: {
        status: 'pending'
      }
    });
    
    try {
      // Save to database
      await order.save();
      
      console.log('Order created, initiating saga process', { orderId: order._id });
      
      // Start the saga process asynchronously - don't wait for it to finish
      sagaOrchestrator.processOrderAsync(order)
        .then(processedOrder => {
          console.log('Order processing completed:', {
            orderId: processedOrder._id,
            status: processedOrder.status
          });
        })
        .catch(err => {
          console.error('Error in async order processing:', err);
        });
      
      // Return immediately with order ID and status
      res.status(201).json({
        message: 'Order created and processing started',
        orderId: order._id,
        status: 'pending'
      });
    } catch (error) {
      console.error('Error saving order:', error);
      res.status(400).json({ message: error.message });
    }
  } catch (error) {
    console.error('Error creating order:', error);
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
    
    // Create response with all necessary information
    const responseData = { 
      orderId: order._id,
      status: order.status,
      paymentUrl: order.payment?.paymentUrl || order.paymentUrl || null,
      message: getStatusMessage(order.status),
      error: order.error || null,
      payment: {
        status: order.payment?.status,
        stripePaymentIntentId: order.payment?.stripePaymentIntentId,
        stripeClientSecret: order.payment?.stripeClientSecret
      },
      // Add client secret at the top level too for better compatibility
      stripeClientSecret: order.payment?.stripeClientSecret
    };
    
    console.log('Sending order status response with payment data:', {
      orderId: order._id,
      status: order.status,
      hasStripeSecret: !!order.payment?.stripeClientSecret,
      paymentStatus: order.payment?.status
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('Error getting order status:', error);
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
    'stock_validated': 'Stock validated, processing payment',
    'payment_pending': 'Waiting for payment confirmation',
    'payment_completed': 'Payment received, preparing your order',
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

module.exports = router;