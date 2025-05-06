const express = require('express');
const mongoose = require('mongoose');
const orderRoutes = require('./routes/orderRoutes');
require('dotenv').config();
const emailService = require('./services/emailService');
const app = express();
const cors = require('cors');
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/orders', orderRoutes);

const MONGODB_URI = process.env.CONNECTION_STRING ;
// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {})
  .catch((err) => {});

const PORT = 3004;
app.listen(PORT, () => {});