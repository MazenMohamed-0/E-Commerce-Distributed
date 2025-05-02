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
router.get('/:id', async (req, res) => {
    try {
        const order = await orderService.getOrderById(req.params.id);
        res.json(order);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// Create order asynchronously and return immediately
router.post('/', verifyToken, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    const userId = req.user.userId;
    
    // Generate idempotency key from request or use one provided by client
    const idempotencyKey = req.headers['idempotency-key'] || uuidv4();
    
    // Check for existing order with same idempotency key
    const existingOrder = await Order.findOne({ idempotencyKey });
    if (existingOrder) {
      return res.status(200).json({ 
        message: 'Order already exists', 
        order: existingOrder,
        status: existingOrder.status 
      });
    }
    
    // Create order with initial pending status
    const order = new Order({
      userId,
      items,
      shippingAddress,
      paymentMethod,
      status: 'pending',
      idempotencyKey
    });
    
    // Save to database
    await order.save();
    
    // Start the saga process asynchronously
    orderService.processOrderAsync(order);
    
    // Return immediately with order ID and status
    res.status(201).json({
      message: 'Order created and processing started',
      orderId: order._id,
      status: 'pending'
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get order status - for polling from frontend
router.get('/:id/status', verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if order belongs to authenticated user
    if (order.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }
    
    res.json({ 
      orderId: order._id,
      status: order.status,
      paymentUrl: order.paymentUrl || null,
      message: getStatusMessage(order.status)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

// Execute payment after PayPal approval (buyer only)
router.post('/:orderId/payment/execute', isBuyer, async (req, res) => {
    try {
        const { paymentId, payerId } = req.body;
        const { order, payment } = await sagaOrchestrator.handlePaymentExecution(
            req.params.orderId,
            paymentId,
            payerId,
            req.user.userId
        );
        res.json({ order, payment });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;