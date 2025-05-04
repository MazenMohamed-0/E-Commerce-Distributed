require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('./services/passport');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/user');
const path = require('path');
const redisClient = require('../shared/redis');

const app = express();

// Middleware
app.use(express.json());
const cors = require('cors');
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

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
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    // Once MongoDB is connected, initialize Redis
    initRedis();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Initialize event handlers
const authEventHandler = require('./events/authEventHandler');
authEventHandler.initializeEventHandlers()
  .then(() => {})
  .catch((err) => console.error('Error initializing auth event handlers:', err));

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: process.env.NODE_ENV === 'development' ? err.message : 'Something broke!' });
});

const PORT = process.env.AUTH_PORT || 3001;
app.listen(PORT, () => {});