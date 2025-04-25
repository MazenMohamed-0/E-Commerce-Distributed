const express = require('express');
const router = express.Router();
const productService = require('../services/productService');
const { verifyToken, isAuthorized } = require('../middleware/authMiddleware');

router.use(verifyToken); // Apply token verification middleware to all routes
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

// Protected routes (require authentication and admin role)


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