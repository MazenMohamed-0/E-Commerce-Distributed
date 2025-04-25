const express = require('express');
const mongoose = require('mongoose');
const cartRoutes = require('./routes/cartRoutes');
const path = require('path');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

console.log('Product Service: Environment Variables Loaded');
console.log('Product Service: Mongo URI:', process.env.MONGO_URI);
console.log('Product Service: JWT Secret:', process.env.JWT_SECRET);


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Cart Service: Connected to MongoDB'))
  .catch((err) => console.error('Cart Service: MongoDB connection error:', err));

// Routes
app.use('/cart', cartRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Cart Service is up and running!' });
});

const PORT = 3003;
app.listen(PORT, () => console.log(`Cart Service running on port ${PORT}`));
