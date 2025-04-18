const express = require('express');
const mongoose = require('mongoose');
const productRoutes = require('./routes/productRoutes');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors)
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Product Service: Connected to MongoDB'))
  .catch((err) => console.error('Product Service: MongoDB connection error:', err));

app.use('/products', productRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Product Service running on port ${PORT}`)); 