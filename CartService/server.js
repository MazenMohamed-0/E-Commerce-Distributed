const express = require('express');
const mongoose = require('mongoose');
const cartRoutes = require('./routes/cartRoutes');
const path = require('path');
const rabbitmq = require('../shared/rabbitmq');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

// Default MongoDB URI if not set in .env
const MONGODB_URI = 'mongodb+srv://ramezfathi:RQVKiyEfmY69IG7D@cluster0.kamuf9s.mongodb.net/cart?retryWrites=true&w=majority';
const PORT = 3003;

console.log('Cart Service: Environment Variables Loaded');
console.log('Cart Service: Mongo URI:', MONGODB_URI);
console.log('Product Service: JWT Secret:', process.env.JWT_SECRET);

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

app.listen(PORT, () => console.log(`Cart Service running on port ${PORT}`));
