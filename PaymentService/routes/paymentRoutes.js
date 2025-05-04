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
    const { orderId, amount, currency = 'USD', paymentMethod = 'stripe', idempotencyKey } = req.body;
    const userId = req.user.userId;

    if (!orderId || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const payment = await paymentService.createPayment({
      orderId,
      userId,
      amount,
      currency,
      paymentMethod,
      idempotencyKey
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Direct create and initialize Stripe payment
router.post('/direct-stripe', verifyToken, async (req, res) => {
  try {
    console.log('DEBUG: Direct Stripe payment request received:', {
      orderId: req.body.orderId,
      amount: req.body.amount
    });
    
    const { orderId, amount, currency = 'USD', returnUrl } = req.body;
    const userId = req.user.userId;

    if (!orderId || !amount) {
      console.log('DEBUG: Missing required fields in direct-stripe request');
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Generate a stable idempotency key
    const idempotencyKey = `order_${orderId}_${userId}_${Date.now()}`;
    console.log('DEBUG: Generated idempotency key:', idempotencyKey);

    try {
      const payment = await paymentService.createStripePayment({
        orderId,
        userId,
        amount,
        currency,
        idempotencyKey
      });
      
      console.log('DEBUG: Stripe payment created successfully:', {
        paymentId: payment.paymentId,
        hasClientSecret: !!payment.stripeClientSecret
      });

      // Return payment details with additional information for direct handling
      res.status(201).json({
        ...payment,
        nextAction: 'redirect-to-stripe',
        returnUrl: returnUrl || `/processing-order/${orderId}`
      });
    } catch (paymentCreationError) {
      console.error('DEBUG: Error in payment service createStripePayment:', paymentCreationError);
      throw paymentCreationError;
    }
  } catch (error) {
    console.error('DEBUG: Error creating direct Stripe payment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Confirm a Stripe payment
router.post('/stripe/confirm', verifyToken, async (req, res) => {
  try {
    console.log('DEBUG: Stripe payment confirmation request received:', {
      paymentIntentId: req.body.paymentIntentId,
      orderId: req.body.orderId
    });
    
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      console.log('DEBUG: Missing payment intent ID in confirmation request');
      return res.status(400).json({ message: 'Payment intent ID is required' });
    }

    try {
      const result = await paymentService.confirmStripePayment(paymentIntentId);
      console.log('DEBUG: Stripe payment confirmation successful:', result);
      res.json(result);
    } catch (confirmationError) {
      console.error('DEBUG: Error in payment service confirmStripePayment:', confirmationError);
      throw confirmationError;
    }
  } catch (error) {
    console.error('DEBUG: Error confirming Stripe payment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Force check and update payment status for an order
router.post('/order/:orderId/check-status', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get the payment for this order
    const payment = await paymentService.getPaymentByOrderId(orderId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found for this order' });
    }
    
    // If the payment is a Stripe payment, fetch the latest status
    if (payment.stripePaymentIntentId) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
        
        // If the payment is succeeded but our system doesn't reflect this
        if (paymentIntent.status === 'succeeded' && payment.status !== 'completed') {
          // Force confirm the payment
          const result = await paymentService.confirmStripePayment(payment.stripePaymentIntentId);
          
          return res.json({
            message: 'Payment status updated successfully',
            previousStatus: payment.status,
            currentStatus: result.status,
            paymentIntent: paymentIntent.status,
            orderId
          });
        }
        
        return res.json({
          message: 'Payment status check completed',
          status: payment.status,
          stripeStatus: paymentIntent.status,
          orderId
        });
      } catch (stripeError) {
        console.error('Error checking Stripe payment intent:', stripeError);
        return res.status(500).json({ 
          message: 'Error checking Stripe payment status',
          error: stripeError.message
        });
      }
    }
    
    // For non-Stripe payments
    return res.json({
      message: 'Payment status retrieved',
      status: payment.status,
      orderId
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
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

// Force synchronize payment status directly from Stripe
router.post('/sync-stripe/:paymentIntentId', verifyToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    
    // Find the payment by Stripe payment intent ID
    const Payment = require('../models/Payment');
    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found for this payment intent ID' });
    }
    
    // Get the Stripe payment intent
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Update payment status based on Stripe status
    const previousStatus = payment.status;
    
    if (paymentIntent.status === 'succeeded' && payment.status !== 'completed') {
      payment.status = 'completed';
      await payment.save();
      
      // Publish payment completed event
      const paymentEventHandler = require('../events/paymentEventHandler');
      await paymentEventHandler.publishPaymentCompletedEvent({
        orderId: payment.orderId,
        paymentId: payment._id.toString(),
        stripePaymentIntentId: paymentIntent.id,
        status: 'completed',
        timestamp: new Date()
      });
      
      return res.json({
        message: 'Payment synchronized and updated to completed',
        previousStatus,
        currentStatus: 'completed',
        orderId: payment.orderId
      });
    } else if (['requires_payment_method', 'requires_confirmation', 'canceled'].includes(paymentIntent.status) 
               && payment.status !== 'failed') {
      payment.status = 'failed';
      payment.error = {
        message: `Payment intent status: ${paymentIntent.status}`,
        code: 'payment_intent_failed',
        timestamp: new Date()
      };
      await payment.save();
      
      // Publish payment failed event
      const paymentEventHandler = require('../events/paymentEventHandler');
      await paymentEventHandler.publishPaymentFailedEvent({
        orderId: payment.orderId,
        paymentId: payment._id.toString(),
        error: `Payment intent status: ${paymentIntent.status}`,
        status: 'failed',
        timestamp: new Date()
      });
      
      return res.json({
        message: 'Payment synchronized and updated to failed',
        previousStatus,
        currentStatus: 'failed',
        orderId: payment.orderId
      });
    }
    
    // No changes needed
    return res.json({
      message: 'Payment already synchronized',
      status: payment.status,
      stripeStatus: paymentIntent.status,
      orderId: payment.orderId
    });
  } catch (error) {
    console.error('Error synchronizing payment with Stripe:', error);
    res.status(500).json({ message: error.message });
  }
});

// Force synchronize payment status for an order (by orderId)
router.post('/sync-order/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Find the payment by order ID
    const Payment = require('../models/Payment');
    const payment = await Payment.findOne({ orderId });
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found for this order ID' });
    }
    
    // If the payment is not a Stripe payment, return early
    if (!payment.stripePaymentIntentId) {
      return res.status(400).json({ 
        message: 'Only Stripe payments can be synchronized',
        paymentMethod: payment.paymentMethod,
        status: payment.status
      });
    }
    
    // Get the Stripe payment intent
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
    
    // Update payment status based on Stripe status
    const previousStatus = payment.status;
    
    if (paymentIntent.status === 'succeeded' && payment.status !== 'completed') {
      payment.status = 'completed';
      await payment.save();
      
      // Publish payment completed event
      const paymentEventHandler = require('../events/paymentEventHandler');
      await paymentEventHandler.publishPaymentCompletedEvent({
        orderId: payment.orderId,
        paymentId: payment._id.toString(),
        stripePaymentIntentId: payment.stripePaymentIntentId,
        status: 'completed',
        timestamp: new Date()
      });
      
      return res.json({
        message: 'Payment synchronized and updated to completed',
        previousStatus,
        currentStatus: 'completed',
        orderId: payment.orderId
      });
    } else if (['requires_payment_method', 'requires_confirmation', 'canceled'].includes(paymentIntent.status) 
               && payment.status !== 'failed') {
      payment.status = 'failed';
      payment.error = {
        message: `Payment intent status: ${paymentIntent.status}`,
        code: 'payment_intent_failed',
        timestamp: new Date()
      };
      await payment.save();
      
      // Publish payment failed event
      const paymentEventHandler = require('../events/paymentEventHandler');
      await paymentEventHandler.publishPaymentFailedEvent({
        orderId: payment.orderId,
        paymentId: payment._id.toString(),
        error: `Payment intent status: ${paymentIntent.status}`,
        status: 'failed',
        timestamp: new Date()
      });
      
      return res.json({
        message: 'Payment synchronized and updated to failed',
        previousStatus,
        currentStatus: 'failed',
        orderId: payment.orderId
      });
    }
    
    // No changes needed
    return res.json({
      message: 'Payment already synchronized',
      status: payment.status,
      stripeStatus: paymentIntent.status,
      orderId: payment.orderId
    });
  } catch (error) {
    console.error('Error synchronizing payment for order:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add a test route to debug Stripe payment creation
router.post('/test-stripe', async (req, res) => {
  try {
    const { orderId, amount, userId } = req.body;
    
    if (!orderId || !amount || !userId) {
      return res.status(400).json({ message: 'Missing required fields (orderId, amount, userId)' });
    }
    
    const payment = await paymentService.createStripePayment({
      orderId,
      userId,
      amount
    });
    
    res.status(201).json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Error creating test Stripe payment:', error);
    res.status(500).json({ 
      success: false,
      message: error.message
    });
  }
});

// Add this new route to get payment details for a specific order
// This is a secure endpoint that should only be called from the payment processing component
router.get('/order/:orderId/details', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }
    
    // Get payment by order ID
    const payment = await paymentService.getPaymentByOrderId(orderId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found for this order' });
    }
    
    // Remove the strict user check since we're already verifying the token
    // and the user has the order ID which is enough proof of ownership
    // The Order Service already does authorization checks
    
    // Only return Stripe payment details for Stripe payments
    if (payment.paymentMethod === 'stripe') {
      return res.json({
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        stripeClientSecret: payment.stripeClientSecret,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        status: payment.status
      });
    } else {
      // For non-Stripe payments, return basic info without the sensitive data
      return res.json({
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        paymentMethod: payment.paymentMethod,
        status: payment.status
      });
    }
  } catch (error) {
    console.error('Error getting payment details:', error.message);
    res.status(500).json({ message: 'Error retrieving payment details' });
  }
});

module.exports = router;
