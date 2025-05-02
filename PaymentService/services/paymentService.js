const Payment = require('../models/Payment');
const paypal = require('paypal-rest-sdk');
const winston = require('winston');

// Set up logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'payment-service.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Configure PayPal SDK (sandbox)
paypal.configure({
  mode: 'sandbox', // or 'live'
  client_id: process.env.PAYPAL_CLIENT_ID || 'YOUR_SANDBOX_CLIENT_ID',
  client_secret: process.env.PAYPAL_CLIENT_SECRET || 'YOUR_SANDBOX_CLIENT_SECRET'
});

class PaymentService {
  async createPayment({ orderId, userId, amount, currency = 'USD', idempotencyKey = null }) {
    try {
      // Check if we already have a payment with this idempotency key or orderId
      if (idempotencyKey) {
        const existingPayment = await Payment.findOne({ idempotencyKey });
        if (existingPayment) {
          logger.info(`Found existing payment with idempotency key ${idempotencyKey}`, { 
            paymentId: existingPayment.paypalPaymentId,
            orderId 
          });
          
          // If we already have a PayPal ID, return the existing payment
          if (existingPayment.paypalPaymentId) {
            // Get the payment from PayPal to get the links
            const payment = await this.getPayPalPayment(existingPayment.paypalPaymentId);
            return { payment, newPayment: existingPayment };
          }
        }
      }
      
      // Also check by orderId as a fallback idempotency mechanism
      const existingOrderPayment = await Payment.findOne({ orderId });
      if (existingOrderPayment) {
        logger.info(`Found existing payment for order ${orderId}`, { 
          paymentId: existingOrderPayment.paypalPaymentId 
        });
        
        if (existingOrderPayment.paypalPaymentId) {
          // Get the payment from PayPal to get the links
          const payment = await this.getPayPalPayment(existingOrderPayment.paypalPaymentId);
          return { payment, newPayment: existingOrderPayment };
        }
      }
      
      // Create a payment in PayPal
      const paymentData = {
        intent: 'sale',
        payer: { payment_method: 'paypal' },
        transactions: [{
          amount: { total: amount.toFixed(2), currency },
          description: `Order #${orderId}`
        }],
        redirect_urls: {
          return_url: `${process.env.PAYPAL_RETURN_URL || 'http://localhost:5173/payment/success'}?orderId=${orderId}`,
          cancel_url: `${process.env.PAYPAL_CANCEL_URL || 'http://localhost:5173/payment/cancel'}?orderId=${orderId}`
        }
      };
      
      // Use Promise to handle the PayPal callback pattern
      return new Promise((resolve, reject) => {
        paypal.payment.create(paymentData, async (err, payment) => {
          if (err) {
            logger.error('PayPal payment creation error', { error: err.message, orderId });
            return reject(err);
          }
          
          try {
            // Save to DB
            const newPayment = new Payment({
              orderId,
              userId,
              amount,
              currency,
              status: 'created',
              paypalPaymentId: payment.id,
              idempotencyKey
            });
            
            await newPayment.save();
            logger.info('Payment created successfully', { 
              paymentId: payment.id, 
              orderId 
            });
            
            resolve({ 
              payment, 
              newPayment,
              // Include order reference for saga orchestrator
              orderReference: {
                orderId,
                paymentId: payment.id,
                status: 'created'
              }
            });
          } catch (dbErr) {
            logger.error('Database error saving payment', { error: dbErr.message, orderId });
            reject(dbErr);
          }
        });
      });
    } catch (error) {
      logger.error('Error in createPayment', { error: error.message, orderId });
      throw error;
    }
  }

  async executePayment(paymentId, payerId) {
    try {
      // First find our internal payment record to get the orderId
      const internalPayment = await Payment.findOne({ paypalPaymentId: paymentId });
      if (!internalPayment) {
        logger.error('No internal payment record found', { paymentId });
        throw new Error('Payment record not found');
      }
      
      const orderId = internalPayment.orderId;
      
      // Check if we already have executed this payment
      if (internalPayment && internalPayment.status === 'completed') {
        logger.info(`Payment ${paymentId} already executed`, { 
          status: internalPayment.status,
          orderId 
        });
        
        // Get current state from PayPal
        const payment = await this.getPayPalPayment(paymentId);
        return { 
          payment, 
          updated: internalPayment,
          orderReference: {
            orderId,
            status: 'completed',
            paymentId: paymentId
          }
        };
      }
      
      // Execute payment with PayPal
      return new Promise((resolve, reject) => {
        paypal.payment.execute(paymentId, { payer_id: payerId }, async (err, payment) => {
          if (err) {
            logger.error('PayPal payment execution error', { 
              paymentId, 
              error: err.message,
              orderId 
            });
            
            // Update DB with failed status
            try {
              const updated = await Payment.findOneAndUpdate(
                { paypalPaymentId: paymentId },
                { 
                  status: 'failed',
                  error: err.message,
                  updatedAt: new Date()
                },
                { new: true }
              );
              
              // Include order reference even in failure case
              reject({
                error: err,
                orderReference: {
                  orderId,
                  status: 'failed',
                  error: err.message,
                  paymentId
                }
              });
            } catch (dbErr) {
              logger.error('Database error updating failed payment', { error: dbErr.message, orderId });
              reject(err); // Still return the original PayPal error
            }
            
            return;
          }
          
          try {
            // Update DB with success
            const updated = await Payment.findOneAndUpdate(
              { paypalPaymentId: paymentId },
              { 
                status: payment.state === 'approved' ? 'completed' : 'failed',
                payer: payment.payer,
                transactions: payment.transactions,
                updatedAt: new Date()
              },
              { new: true }
            );
            
            logger.info('Payment executed successfully', { 
              paymentId, 
              status: payment.state,
              orderId 
            });
            
            resolve({ 
              payment, 
              updated,
              orderReference: {
                orderId,
                status: payment.state === 'approved' ? 'completed' : 'failed',
                paymentId
              }
            });
          } catch (dbErr) {
            logger.error('Database error updating executed payment', { error: dbErr.message, orderId });
            reject(dbErr);
          }
        });
      });
    } catch (error) {
      logger.error('Error in executePayment', { error: error.message });
      throw error;
    }
  }

  async getPaymentStatus(paymentId) {
    try {
      // Try to find payment in our database
      const payment = await Payment.findOne({ paypalPaymentId: paymentId });
      if (!payment) {
        logger.error('Payment not found', { paymentId });
        throw new Error('Payment not found');
      }
      
      // If payment is still pending, check with PayPal for latest status
      if (payment.status === 'created') {
        try {
          const paypalPayment = await this.getPayPalPayment(paymentId);
          
          // Update our record if PayPal status has changed
          if (paypalPayment.state !== 'created') {
            payment.status = paypalPayment.state === 'approved' ? 'completed' : 'failed';
            await payment.save();
          }
        } catch (paypalErr) {
          logger.warn('Error checking PayPal payment status', { 
            paymentId, 
            error: paypalErr.message 
          });
          // Continue with our stored status if PayPal check fails
        }
      }
      
      return payment;
    } catch (error) {
      logger.error('Error in getPaymentStatus', { error: error.message });
      throw error;
    }
  }
  
  // Helper to get a payment from PayPal
  async getPayPalPayment(paymentId) {
    return new Promise((resolve, reject) => {
      paypal.payment.get(paymentId, (err, payment) => {
        if (err) {
          logger.error('Error getting payment from PayPal', { 
            paymentId, 
            error: err.message 
          });
          return reject(err);
        }
        resolve(payment);
      });
    });
  }
}

module.exports = new PaymentService(); 