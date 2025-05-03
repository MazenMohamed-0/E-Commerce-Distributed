const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');

// Initialize Stripe client
console.log('Stripe client initialized successfully');

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
      console.log('Creating Stripe payment for order:', orderData.orderId, 'amount:', orderData.amount);
      
      // Create a new payment record
      const payment = new Payment({
        orderId: orderData.orderId,
        userId: orderData.userId,
        amount: orderData.amount,
        currency: orderData.currency || 'USD',
        paymentMethod: 'stripe'
      });
      
      // Create a payment intent with Stripe
      console.log('Creating Stripe payment intent...');
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(payment.amount * 100), // Convert to cents
        currency: payment.currency.toLowerCase(),
        metadata: {
          orderId: payment.orderId,
          userId: payment.userId
        },
        description: `Payment for order ${payment.orderId}`,
        automatic_payment_methods: {
          enabled: true
        }
      });
      
      console.log('Stripe payment intent created successfully:', paymentIntent.id);
      
      // Update payment with Stripe data
      payment.stripePaymentIntentId = paymentIntent.id;
      payment.stripeClientSecret = paymentIntent.client_secret;
      await payment.save();
      
      console.log('Stripe payment record saved:', {
        paymentId: payment._id,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret.substring(0, 10) + '...'
      });
      
      return {
        paymentId: payment._id,
        orderId: payment.orderId,
        stripePaymentIntentId: paymentIntent.id,
        stripeClientSecret: paymentIntent.client_secret,
        status: 'created'
      };
    } catch (error) {
      console.error('Error creating Stripe payment:', error);
      throw new Error(`Failed to create Stripe payment: ${error.message}`);
    }
  }
  
  // Create payment - automatically choose between Stripe and cash
  async createPayment(orderData) {
    const paymentMethod = orderData.paymentMethod || 'stripe';
    console.log('Creating payment with method:', paymentMethod);
    
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
      console.error('Error creating cash payment:', error);
      throw new Error(`Failed to create cash payment: ${error.message}`);
    }
  }

  // Confirm Stripe payment
  async confirmStripePayment(paymentIntentId) {
    try {
      const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      // Check if the payment intent was successful
      if (paymentIntent.status === 'succeeded') {
        // Update payment status
        payment.status = 'completed';
        await payment.save();

        // Publish payment completed event to update order status
        const paymentEventHandler = require('../events/paymentEventHandler');
        await paymentEventHandler.publishPaymentCompletedEvent({
          orderId: payment.orderId,
          paymentId: payment._id,
          stripePaymentIntentId: paymentIntent.id,
          status: 'completed',
          timestamp: new Date()
        });

        return {
          paymentId: payment._id,
          orderId: payment.orderId,
          status: payment.status
        };
      } else {
        payment.status = 'failed';
        payment.error = {
          message: `Payment intent status: ${paymentIntent.status}`,
          code: 'payment_intent_not_succeeded',
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
        
        throw new Error(`Payment intent not succeeded. Status: ${paymentIntent.status}`);
      }
    } catch (error) {
      console.error('Error confirming Stripe payment:', error);
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
          console.error('Error checking Stripe payment status:', stripeError);
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
      console.error('Error getting payment status:', error);
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
      console.error('Error getting payment by order ID:', error);
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
          console.error('Error cancelling Stripe payment intent:', stripeError);
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
      console.error('Error cancelling payment:', error);
      throw new Error('Failed to cancel payment');
    }
  }
}

module.exports = new PaymentService();
