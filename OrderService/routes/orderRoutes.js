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
        const orders = await orderService.getOrdersByUser(req.user.userId);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get orders for products created by the seller (seller only)
router.get('/seller-orders', isSeller, async (req, res) => {
    try {
        // Get the token from the request headers
        const token = req.headers.authorization;
        
        // Get orders for products created by this seller
        const orders = await orderService.getOrdersForSeller(req.user.userId, token);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single order (only if user owns the order or is admin)
router.get('/:id', async (req, res) => {
    try {
        console.log('Fetching order with ID:', req.params.id);
        // Pass the authentication token to the service for product details retrieval
        const token = req.headers.authorization;
        const order = await orderService.getOrderById(req.params.id, token);
        res.json(order);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// Create order (buyer only)
router.post('/', isBuyer, async (req, res) => {
    try {
        // Add user ID from the authenticated user
        const orderData = {
            ...req.body,
            userId: req.user.userId,
            // Pass the token to the service for inter-service communication
            token: req.headers.authorization
        };
        
        const newOrder = await orderService.createOrder(orderData);
        res.status(201).json(newOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update order status (admin only)
router.patch('/:id/status', isAdmin, async (req, res) => {
    try {
        const updatedOrder = await orderService.updateOrderStatus(req.params.id, req.body.status);
        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update payment status (admin only)
router.patch('/:id/payment', isAdmin, async (req, res) => {
    try {
        const updatedOrder = await orderService.updatePaymentStatus(req.params.id, req.body.paymentStatus);
        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;