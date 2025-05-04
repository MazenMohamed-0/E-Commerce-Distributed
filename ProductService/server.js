const express = require('express');
const mongoose = require('mongoose');
const productRoutes = require('./routes/productRoutes');
const path = require('path');
const redisClient = require('../shared/redis');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.CONNECTION_STRING ;

// Initialize Redis connection
async function initRedis() {
  try {
    await redisClient.connect();
    console.log('Redis client connected successfully');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Product Service: MongoDB connected successfully');
    // Once MongoDB is connected, initialize Redis
    initRedis();
  })
  .catch((err) => console.error('Product Service: MongoDB connection error:', err));

app.use('/products', productRoutes);

const PORT = 3002;
app.listen(PORT, () => console.log(`Product Service running on port ${PORT}`));