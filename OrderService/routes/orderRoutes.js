const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const { verifyToken, isAuthorized } = require('../middleware/authMiddleware');

// Apply JWT verification to all routes
router.use(verifyToken);

// Get all orders (admin only)
router.get('/', isAuthorized, async (req, res) => {
    try {
        const orders = await orderService.getAllOrders();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get orders for the authenticated user
router.get('/my-orders', isAuthorized, async (req, res) => {
    try {
        const orders = await orderService.getOrdersByUser(req.user.userId);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single order (only if user owns the order or is admin)
router.get('/:id', isAuthorized, async (req, res) => {
    try {
        const order = await orderService.getOrderById(req.params.id);
        res.json(order);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// Create order (automatically associates with authenticated user)
router.post('/', isAuthorized, async (req, res) => {
    try {
        const orderData = {
            ...req.body,
            userId: req.user.userId // Automatically set the user ID from the token
        };
        const newOrder = await orderService.createOrder(orderData);
        res.status(201).json(newOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update order status (admin only)
router.patch('/:id/status', isAuthorized, async (req, res) => {
    try {
        const updatedOrder = await orderService.updateOrderStatus(req.params.id, req.body.status);
        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update payment status
router.patch('/:id/payment', isAuthorized, async (req, res) => {
    try {
        const updatedOrder = await orderService.updatePaymentStatus(req.params.id, req.body.paymentStatus);
        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router; 