require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const paymentRoutes = require('./routes/paymentRoutes');
const paymentEventHandler = require('./events/paymentEventHandler');
const path = require('path');
const paymentService = require('./services/paymentService');

// Use environment variables without hardcoding them
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Connect to MongoDB
const MONGODB_URI = process.env.CONNECTION_STRING ;

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
const PORT = process.env.PAYMENT_PORT || 3005;
app.listen(PORT, () => {});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});
