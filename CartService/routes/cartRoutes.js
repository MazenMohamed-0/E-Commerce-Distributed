const express = require('express');
const router = express.Router();
const cartService = require('../services/cartService');
const { verifyToken, isBuyer } = require('../middleware/authMiddleware');

// Apply token verification middleware to all routes
router.use(verifyToken);

// Get user's cart
router.get('/', isBuyer, async (req, res) => {
    try {
        const cart = await cartService.getCart(req.user.userId);
        res.json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', isBuyer, async (req, res) => {
    console.log(req.user);
    try {
        const { productId, quantity } = req.body;
        
        if (!productId || !quantity || quantity <= 0) {
            return res.status(400).json({ message: 'Invalid product ID or quantity' });
        }
        
        // Extract token from the Authorization header
        const token = req.headers.authorization?.split(' ')[1];
        const cart = await cartService.addToCart(req.user.userId, { productId, quantity }, token);
        res.status(201).json(cart);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
// Add item to cart

// Update cart item quantity
router.put('/:productId', isBuyer, async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;
        
        if (!quantity || quantity < 0) {
            return res.status(400).json({ message: 'Invalid quantity' });
        }
        
        // Extract token from the Authorization header
        const token = req.headers.authorization?.split(' ')[1];
        const cart = await cartService.updateCartItem(req.user.userId, productId, quantity, token);
        res.json(cart);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Remove item from cart
router.delete('/:productId', isBuyer, async (req, res) => {
    try {
        const { productId } = req.params;
        const cart = await cartService.removeFromCart(req.user.userId, productId);
        res.json(cart);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Clear cart
router.delete('/', isBuyer, async (req, res) => {
    try {
        const result = await cartService.clearCart(req.user.userId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
