const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { verifyToken } = require('../middleware/authMiddleware');

// Public routes
// Get payment status - public for webhooks/callbacks
router.get('/:id/status', async (req, res) => {
  try {
    const payment = await paymentService.getPaymentStatus(req.params.id);
    res.json(payment);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Protected routes - require authentication
router.use(verifyToken);

// Create a new PayPal payment (requires authentication)
router.post('/', async (req, res) => {
  try {
    // Use authenticated user ID from token
    const userId = req.user.userId;
    const { orderId, amount, currency } = req.body;
    
    const { payment, newPayment } = await paymentService.createPayment({ 
      orderId, 
      userId, 
      amount, 
      currency 
    });
    
    // Return PayPal approval URL for redirect
    const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
    res.json({ 
      approvalUrl: approvalUrl?.href, 
      paymentId: payment.id,
      orderId: newPayment.orderId
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Execute PayPal payment after user approval (requires authentication)
router.post('/execute', async (req, res) => {
  try {
    const { paymentId, payerId } = req.body;
    const { payment, updated } = await paymentService.executePayment(paymentId, payerId);
    
    // Check if payment belongs to the authenticated user
    if (updated.userId !== req.user.userId) {
      return res.status(403).json({ message: 'You are not authorized to execute this payment' });
    }
    
    res.json({ payment, updated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 