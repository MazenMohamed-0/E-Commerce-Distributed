const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const paymentEventHandler = require('../events/paymentEventHandler');
const { verifyToken } = require('../middleware/authMiddleware');

// Get payment gateways configuration
router.get('/config', (req, res) => {
  const gatewaysConfig = paymentService.getPaymentGateways();
  res.json(gatewaysConfig);
});

// Create a payment
router.post('/', verifyToken, async (req, res) => {
  try {
    const { orderId, amount, currency = 'USD', paymentMethod = 'stripe' } = req.body;
    const userId = req.user.userId;

    if (!orderId || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const payment = await paymentService.createPayment({
      orderId,
      userId,
      amount,
      currency,
      paymentMethod
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Confirm a Stripe payment
router.post('/stripe/confirm', verifyToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ message: 'Payment intent ID is required' });
    }

    const result = await paymentService.confirmStripePayment(paymentIntentId);
    res.json(result);
  } catch (error) {
    console.error('Error confirming Stripe payment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get payment status by payment ID
router.get('/:paymentId', verifyToken, async (req, res) => {
  try {
    const payment = await paymentService.getPaymentStatus(req.params.paymentId);
    res.json(payment);
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(404).json({ message: error.message });
  }
});

// Get payment status by order ID
router.get('/order/:orderId', verifyToken, async (req, res) => {
  try {
    const payment = await paymentService.getPaymentByOrderId(req.params.orderId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found for this order' });
    }
    
    res.json(payment);
  } catch (error) {
    console.error('Error getting payment by order ID:', error);
    res.status(500).json({ message: error.message });
  }
});

// Cancel a payment
router.post('/:paymentId/cancel', verifyToken, async (req, res) => {
  try {
    const result = await paymentService.cancelPayment(req.params.paymentId);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling payment:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
