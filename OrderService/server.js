const express = require('express');
const mongoose = require('mongoose');
const orderRoutes = require('./routes/orderRoutes');
require('dotenv').config();
const emailService = require('./services/emailService');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());
app.use('/orders', orderRoutes);

const MONGODB_URI = process.env.CONNECTION_STRING ;
// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {})
  .catch((err) => {});

const PORT = 3004;
app.listen(PORT, () => {});