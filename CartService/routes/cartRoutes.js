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
        
        if (!cart.items || cart.items.length === 0) {
            return res.status(200).json({
                message: 'Cart is empty',
                cart: {
                    userId: cart.userId,
                    items: [],
                    totalAmount: 0
                }
            });
        }

        res.status(200).json({
            message: 'Cart retrieved successfully',
            cart
        });
    } catch (error) {
        if (error.message.includes('Product details not found')) {
            res.status(404).json({ 
                message: 'Some products in cart could not be found',
                error: error.message 
            });
        } else if (error.message.includes('timeout')) {
            res.status(504).json({ 
                message: 'Product service request timed out',
                error: error.message 
            });
        } else {
            res.status(500).json({ 
                message: 'Error retrieving cart',
                error: error.message 
            });
        }
    }
});

// Add item to cart
router.post('/', isBuyer, async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const token = req.headers.authorization;
        
        // Basic validation
        if (!productId || !quantity) {
            return res.status(400).json({ 
                success: false,
                message: 'Product ID and quantity are required' 
            });
        }

        if (quantity <= 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Quantity must be greater than 0' 
            });
        }

        // Add to cart
        await cartService.addToCart(req.user.userId, { productId, quantity }, token);
        
        // Return success response without product details
        res.status(201).json({
            success: true,
            message: 'Product successfully added to the cart'
        });
    } catch (error) {
        // Handle specific error types
        if (error.message.includes('stock')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to add product to cart',
            error: error.message
        });
    }
});

// Update cart item quantity
router.put('/:productId', isBuyer, async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;
        
        if (!quantity || quantity < 0) {
            return res.status(400).json({ message: 'Invalid quantity' });
        }
        
        const cart = await cartService.updateItemQuantity(req.user.userId, productId, quantity);
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
