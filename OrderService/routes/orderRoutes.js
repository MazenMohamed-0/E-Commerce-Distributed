const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const verifyToken = require('../middleware/authMiddleware');

// Apply JWT verification to all routes
router.use(verifyToken);

// Get all orders (admin only)
router.get('/', async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        const orders = await orderService.getAllOrders();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get orders for the authenticated user
router.get('/my-orders', async (req, res) => {
    try {
        const orders = await orderService.getOrdersByUser(req.user.userId);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single order (only if user owns the order or is admin)
router.get('/:id', async (req, res) => {
    try {
        const order = await orderService.getOrderById(req.params.id);
        
        // Check if user owns the order or is admin
        if (order.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        res.json(order);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// Create order (automatically associates with authenticated user)
router.post('/', async (req, res) => {
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
router.patch('/:id/status', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        const updatedOrder = await orderService.updateOrderStatus(req.params.id, req.body.status);
        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update payment status
router.patch('/:id/payment', async (req, res) => {
    try {
        const order = await orderService.getOrderById(req.params.id);
        
        // Check if user owns the order or is admin
        if (order.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const updatedOrder = await orderService.updatePaymentStatus(req.params.id, req.body.paymentStatus);
        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router; 