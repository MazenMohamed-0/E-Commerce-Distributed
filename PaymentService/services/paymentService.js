const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');

// Initialize Stripe client

class PaymentService {
  // Get payment gateways config
  getPaymentGateways() {
    return {
      stripe: {
        public_key: process.env.STRIPE_PUBLIC_KEY
      }
    };
  }
  
  // Create a payment using Stripe
  async createStripePayment(orderData) {
    try {
      console.log('DEBUG: Starting createStripePayment', {
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency || 'USD'
      });
      
      // Create a new payment record
      const payment = new Payment({
        orderId: orderData.orderId,
        userId: orderData.userId,
        amount: orderData.amount,
        currency: orderData.currency || 'USD',
        paymentMethod: 'stripe'
      });
      
      // Create a payment intent with Stripe
      
      // Determine if the amount needs to be converted to cents
      // If amount is a whole number and >= 100, it's likely already in cents
      // Otherwise, convert from dollars to cents
      const isLikelyCents = Number.isInteger(payment.amount) && payment.amount >= 100;
      const stripeAmount = isLikelyCents ? payment.amount : Math.round(payment.amount * 100);
      
      console.log('DEBUG: Calculated stripe amount:', {
        originalAmount: payment.amount,
        isLikelyCents,
        stripeAmount
      });
      
      // Add idempotency key to prevent duplicate payments
      const idempotencyKey = orderData.idempotencyKey || `order_${payment.orderId}_${Date.now()}`;
      
      console.log('DEBUG: Creating Stripe payment intent with params:', {
        amount: stripeAmount,
        currency: payment.currency.toLowerCase(),
        orderId: payment.orderId,
        idempotencyKey
      });
      
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: stripeAmount, // Use the appropriate amount
          currency: payment.currency.toLowerCase(),
          metadata: {
            orderId: payment.orderId,
            userId: payment.userId
          },
          description: `Payment for order ${payment.orderId}`,
          automatic_payment_methods: {
            enabled: true
          }
        }, {
          idempotencyKey
        });
        
        console.log('DEBUG: Stripe payment intent created successfully:', {
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          hasClientSecret: !!paymentIntent.client_secret
        });
        
        // Update payment with Stripe data
        payment.stripePaymentIntentId = paymentIntent.id;
        payment.stripeClientSecret = paymentIntent.client_secret;
        payment.status = 'pending';
        
        console.log('DEBUG: Saving payment to database');
        await payment.save();
        console.log('DEBUG: Payment saved successfully with ID:', payment._id);
        
        return {
          paymentId: payment._id,
          orderId: payment.orderId,
          stripePaymentIntentId: paymentIntent.id,
          stripeClientSecret: paymentIntent.client_secret,
          status: 'created',
          success: true
        };
      } catch (stripeError) {
        console.error('DEBUG: Stripe payment intent creation failed:', stripeError);
        throw new Error(`Stripe payment intent creation failed: ${stripeError.message}`);
      }
    } catch (error) {
      console.error('DEBUG: Error in createStripePayment:', error);
      throw error;
    }
  }
  
  // Create payment - automatically choose between Stripe and cash
  async createPayment(orderData) {
    const paymentMethod = orderData.paymentMethod || 'stripe';
    
    if (paymentMethod === 'stripe') {
      return this.createStripePayment(orderData);
    } else if (paymentMethod === 'cash') {
      return this.createCashPayment(orderData);
    } else {
      throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }
  }
  
  // Create cash payment record
  async createCashPayment(orderData) {
    try {
      // Create payment record
      const payment = new Payment({
        orderId: orderData.orderId,
        userId: orderData.userId,
        amount: orderData.amount,
        currency: orderData.currency || 'USD',
        paymentMethod: 'cash',
        status: 'pending'
      });
      
      await payment.save();
      
      return {
        paymentId: payment._id,
        orderId: payment.orderId,
        status: 'pending'
      };
    } catch (error) {
      throw new Error(`Failed to create cash payment: ${error.message}`);
    }
  }

  // Confirm Stripe payment
  async confirmStripePayment(paymentIntentId) {
    try {
      console.log('DEBUG: Starting confirmStripePayment for payment intent:', paymentIntentId);
      
      const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
      if (!payment) {
        console.log('DEBUG: Payment not found for payment intent ID:', paymentIntentId);
        throw new Error('Payment not found');
      }
      
      console.log('DEBUG: Found payment record:', {
        paymentId: payment._id,
        orderId: payment.orderId,
        status: payment.status
      });

      // Retrieve payment intent from Stripe
      console.log('DEBUG: Retrieving payment intent from Stripe');
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log('DEBUG: Retrieved payment intent with status:', paymentIntent.status);
      
      // Check if the payment intent was successful
      if (paymentIntent.status === 'succeeded') {
        console.log('DEBUG: Payment intent status is succeeded, updating payment');
        // Update payment status
        payment.status = 'completed';
        await payment.save();
        console.log('DEBUG: Payment status updated to completed');

        // Publish payment completed event to update order status
        console.log('DEBUG: Publishing payment completed event');
        const paymentEventHandler = require('../events/paymentEventHandler');
        await paymentEventHandler.publishPaymentCompletedEvent({
          orderId: payment.orderId,
          paymentId: payment._id,
          stripePaymentIntentId: paymentIntent.id,
          status: 'completed',
          timestamp: new Date()
        });
        console.log('DEBUG: Payment completed event published');

        return {
          paymentId: payment._id,
          orderId: payment.orderId,
          status: payment.status
        };
      } else {
        console.log('DEBUG: Payment intent status is not succeeded:', paymentIntent.status);
        payment.status = 'failed';
        payment.error = {
          message: `Payment intent status: ${paymentIntent.status}`,
          code: 'payment_intent_not_succeeded',
          timestamp: new Date()
        };
        await payment.save();
        console.log('DEBUG: Payment status updated to failed');
        
        // Publish payment failed event
        console.log('DEBUG: Publishing payment failed event');
        const paymentEventHandler = require('../events/paymentEventHandler');
        await paymentEventHandler.publishPaymentFailedEvent({
          orderId: payment.orderId,
          paymentId: payment._id,
          error: `Payment intent status: ${paymentIntent.status}`,
          status: 'failed',
          timestamp: new Date()
        });
        console.log('DEBUG: Payment failed event published');
        
        throw new Error(`Payment intent not succeeded. Status: ${paymentIntent.status}`);
      }
    } catch (error) {
      console.error('DEBUG: Error in confirmStripePayment:', error);
      throw new Error(`Failed to confirm payment: ${error.message}`);
    }
  }

  async getPaymentStatus(paymentId) {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      // If Stripe payment, check latest status
      if (payment.stripePaymentIntentId && payment.status !== 'completed') {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
          
          // Update payment status based on payment intent
          if (paymentIntent.status === 'succeeded' && payment.status !== 'completed') {
            payment.status = 'completed';
            await payment.save();
            
            // Publish payment completed event to update order status
            const paymentEventHandler = require('../events/paymentEventHandler');
            await paymentEventHandler.publishPaymentCompletedEvent({
              orderId: payment.orderId,
              paymentId: payment._id,
              stripePaymentIntentId: payment.stripePaymentIntentId,
              status: 'completed',
              timestamp: new Date()
            });
          } else if (['canceled', 'requires_payment_method'].includes(paymentIntent.status) && payment.status !== 'failed') {
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
              paymentId: payment._id,
              error: `Payment intent status: ${paymentIntent.status}`,
              status: 'failed',
              timestamp: new Date()
            });
          }
        } catch (stripeError) {
        }
      }

      return {
        paymentId: payment._id,
        orderId: payment.orderId,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        stripeClientSecret: payment.stripeClientSecret,
        error: payment.error
      };
    } catch (error) {
      throw new Error('Failed to get payment status');
    }
  }

  async getPaymentByOrderId(orderId) {
    try {
      const payment = await Payment.findOne({ orderId });
      if (!payment) {
        return null;
      }

      return {
        paymentId: payment._id,
        orderId: payment.orderId,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        stripeClientSecret: payment.stripeClientSecret
      };
    } catch (error) {
      throw new Error('Failed to get payment by order ID');
    }
  }

  async cancelPayment(paymentId) {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Only pending payments can be cancelled
      if (payment.status !== 'pending') {
        throw new Error(`Cannot cancel payment in ${payment.status} status`);
      }
      
      // If Stripe payment, cancel the payment intent
      if (payment.paymentMethod === 'stripe' && payment.stripePaymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
        } catch (stripeError) {
          // Continue with the cancellation in our system even if Stripe fails
        }
      }

      payment.status = 'cancelled';
      await payment.save();

      return {
        paymentId: payment._id,
        orderId: payment.orderId,
        status: payment.status
      };
    } catch (error) {
      throw new Error('Failed to cancel payment');
    }
  }
}

module.exports = new PaymentService();
