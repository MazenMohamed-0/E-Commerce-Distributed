const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const paymentRoutes = require('./routes/paymentRoutes');
const paymentEventHandler = require('./events/paymentEventHandler');
const path = require('path');
const paymentService = require('./services/paymentService');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI ;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Initialize RabbitMQ event handlers
const initEventHandlers = async () => {
  try {
    await paymentEventHandler.init();
    console.log('Payment event handlers initialized successfully');
  } catch (error) {
    console.error('Failed to initialize event handlers:', error);
    // Don't exit the process - the event handler has retry logic
  }
};

// Initialize the event handlers
initEventHandlers();

// Register payment routes
app.use('/payments', paymentRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Use PORT from environment variables with fallback
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Payment Service running on port ${PORT}`);
  console.log(`Stripe payment provider initialized and ready`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});
