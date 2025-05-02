const express = require('express');
const router = express.Router();
const productService = require('../services/productService');
const { verifyToken, isAuthorized, isSeller } = require('../middleware/authMiddleware');

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
        const product = await productService.getProductDetailsWithSeller(req.params.id);
        res.json(product);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

router.use(verifyToken);

// Get seller's products
router.get('/seller/products', isSeller, async (req, res) => {
    try {
        const products = await productService.getProductsBySeller(req.user.userId);
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Special endpoint for order processing to reduce stock
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
        
        const result = await productService.updateStock(
            req.params.id, 
            quantity
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