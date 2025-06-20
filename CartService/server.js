const express = require('express');
const mongoose = require('mongoose');
const cartRoutes = require('./routes/cartRoutes');
const path = require('path');
const rabbitmq = require('./shared/rabbitmq');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Default MongoDB URI if not set in .env
const MONGODB_URI = process.env.CONNECTION_STRING;
const PORT = 3003;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Cart Service: Connected to MongoDB'))
  .catch((err) => console.error('Cart Service: MongoDB connection error:', err));

// Connect to RabbitMQ
rabbitmq.connect()
  .then(() => console.log('Cart Service: Connected to RabbitMQ'))
  .catch((err) => console.error('Cart Service: RabbitMQ connection error:', err));

// Routes
app.use('/cart', cartRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Cart Service is up and running!' });
});

app.listen(PORT, () => {});
