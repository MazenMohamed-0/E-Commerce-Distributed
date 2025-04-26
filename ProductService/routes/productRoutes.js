const express = require('express');
const router = express.Router();
const productService = require('../services/productService');
const { verifyToken, isAuthorized } = require('../middleware/authMiddleware');

// Public routes (no authentication required)
router.get('/', async (req, res) => {
    try {
        const products = await productService.getAllProducts();
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const product = await productService.getProductById(req.params.id);
        res.json(product);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// Protected routes (require authentication)
router.use(verifyToken);

// Special endpoint for order processing to reduce stock
// This endpoint is specifically for the Order Service to reduce stock during checkout
router.post('/:id/reduce-stock', async (req, res) => {
    try {
        // Check if this is a service-to-service call from the Order Service
        const isServiceCall = req.headers['x-service-type'] === 'order-service';
        
        // Only allow stock reduction if it's from Order Service or an admin/seller
        if (!isServiceCall && req.user.role !== 'admin' && req.user.role !== 'seller') {
            return res.status(403).json({ 
                message: 'Forbidden: Only Order Service, admins, or sellers can reduce stock' 
            });
        }
        
        const { quantity, orderId } = req.body;
        
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ message: 'Invalid quantity specified' });
        }
        
        const result = await productService.reduceProductStock(
            req.params.id, 
            quantity,
            orderId
        );
        
        res.json(result);
    } catch (error) {
        console.error('Error reducing stock:', error);
        res.status(400).json({ message: error.message });
    }
});

// Create product (admin or seller only)
router.post('/', isAuthorized, async (req, res) => {
    try {
        // Add the creator information to the product data
        const productData = {
            ...req.body,
            createdBy: req.user.userId
        };
        
        const newProduct = await productService.createProduct(productData);
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update product (admin only)
router.patch('/:id', isAuthorized, async (req, res) => {
    try {
        const updatedProduct = await productService.updateProduct(req.params.id, req.body);
        res.json(updatedProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete product (admin only)
router.delete('/:id', isAuthorized, async (req, res) => {
    try {
        const result = await productService.deleteProduct(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;