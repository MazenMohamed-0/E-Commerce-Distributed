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

// Connect to MongoDB
mongoose.connect('mongodb+srv://ramezfathi:RQVKiyEfmY69IG7D@cluster0.kamuf9s.mongodb.net/order?retryWrites=true&w=majority&appName=DistributedSystemsUserAuth', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Order Service: Connected to MongoDB'))
  .catch((err) => console.error('Order Service: MongoDB connection error:', err));

const PORT = 3004;
app.listen(PORT, () => console.log(`Order Service running on port ${PORT}`));