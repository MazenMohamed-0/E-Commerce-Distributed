const express = require('express');
const mongoose = require('mongoose');
const productRoutes = require('./routes/productRoutes');
const path = require('path');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.CONNECTION_STRING ;


// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .catch((err) => console.error('Product Service: MongoDB connection error:', err));

app.use('/products', productRoutes);

const PORT = 3002;
app.listen(PORT, () => console.log(`Product Service running on port ${PORT}`));