const express = require('express');
const mongoose = require('mongoose');
const orderRoutes = require('./routes/orderRoutes');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors)
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Order Service: Connected to MongoDB'))
  .catch((err) => console.error('Order Service: MongoDB connection error:', err));

app.use('/orders', orderRoutes);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Order Service running on port ${PORT}`)); 