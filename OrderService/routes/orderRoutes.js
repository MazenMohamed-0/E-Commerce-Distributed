const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const { verifyToken, isAuthorized, isAdmin, isBuyer, isSeller } = require('../middleware/authMiddleware');

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

// Create order (buyer only)
router.post('/', isBuyer, async (req, res) => {
    try {
        const newOrder = await orderService.createOrder(req.user.userId, req.body);
        res.status(201).json(newOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

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