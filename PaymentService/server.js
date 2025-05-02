const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const paymentRoutes = require('./routes/paymentRoutes');
const paymentEventHandler = require('./events/paymentEventHandler');
require('dotenv').config({ path: './config.env' });

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Connect to MongoDB
mongoose.connect('mongodb+srv://ramezfathi:RQVKiyEfmY69IG7D@cluster0.kamuf9s.mongodb.net/payment?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection error:', err));

// Initialize RabbitMQ event handlers
paymentEventHandler.init();

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

// Explicitly use port 3005 instead of relying on process.env.PORT
const PORT = 3005;
app.listen(PORT, () => console.log(`Payment Service running on port ${PORT}`));
