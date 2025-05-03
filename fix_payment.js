require('dotenv').config({ path: './PaymentService/.env' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mongoose = require('mongoose');
const Payment = require('./PaymentService/models/Payment');

// Order ID and Payment Intent from the frontend
const orderId = '6816319d2213079fe9bdfdf0';
const paymentIntentId = 'pi_3RKhgnPMNHEuOAn31UrmmdBC';

async function connectToMongo() {
  try {
    await mongoose.connect('mongodb://localhost:27017/payment-service', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

async function fixPayment() {
  try {
    await connectToMongo();
    
    // 1. Check the payment intent status
    console.log('Checking payment intent:', paymentIntentId);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log('Payment intent status:', paymentIntent.status);
    
    // 2. Find the payment in our database
    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
    if (!payment) {
      console.log('Payment not found in database');
      process.exit(1);
    }
    
    console.log('Found payment in database:', {
      id: payment._id,
      orderId: payment.orderId,
      status: payment.status
    });
    
    // 3. Update the payment status if needed
    if (paymentIntent.status === 'succeeded' && payment.status !== 'completed') {
      console.log('Fixing payment status...');
      payment.status = 'completed';
      await payment.save();
      
      // 4. Publish event to update order
      console.log('Manually publishing payment completed event');
      const rabbitmq = require('./shared/rabbitmq');
      await rabbitmq.connect();
      
      await rabbitmq.publish('payment-events', 'payment.result', {
        type: 'payment.result',
        data: {
          orderId: payment.orderId,
          paymentId: payment._id.toString(),
          stripePaymentIntentId: paymentIntent.id,
          status: 'completed',
          success: true,
          timestamp: new Date()
        }
      });
      
      console.log('Payment fixed and event published!');
    } else {
      console.log('No fix needed. Payment intent status:', paymentIntent.status, 'DB status:', payment.status);
    }
  } catch (error) {
    console.error('Error fixing payment:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
}

fixPayment(); 