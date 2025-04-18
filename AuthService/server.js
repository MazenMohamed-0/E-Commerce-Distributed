require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('./services/passport');
const authRoutes = require('./routes/authRoutes');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
const cors = require('cors');
app.use(cors());

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

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/auth', authRoutes);

// OAuth success route
app.get('/auth/success', (req, res) => {
  const token = req.query.token;
  res.send(`
    <html>
      <body>
        <script>
          window.opener.postMessage({ token: '${token}' }, '*');
          window.close();
        </script>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));