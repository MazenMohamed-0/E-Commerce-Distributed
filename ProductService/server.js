const express = require('express');
const mongoose = require('mongoose');
const productRoutes = require('./routes/productRoutes');
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
mongoose.connect('mongodb+srv://ramezfathi:RQVKiyEfmY69IG7D@cluster0.kamuf9s.mongodb.net/product?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Product Service: Connected to MongoDB'))
  .catch((err) => console.error('Product Service: MongoDB connection error:', err));

app.use('/products', productRoutes);

const PORT = 3002;
app.listen(PORT, () => console.log(`Product Service running on port ${PORT}`));