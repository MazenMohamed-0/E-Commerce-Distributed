const express = require('express');
const router = express.Router();
const passport = require('../services/passport');
const authService = require('../services/authService');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const User = require('../models/User');

// Public routes
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const result = await authService.register({ name, email, password, role });
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        res.json(result);
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
});

// Facebook Data Deletion Endpoint
router.post('/data-deletion', async (req, res) => {
    try {
        const signed_request = req.body.signed_request;
        const data = parseSignedRequest(signed_request, process.env.FACEBOOK_APP_SECRET);
        
        if (!data) {
            return res.status(400).json({
                message: "Invalid signed request",
                status: "error"
            });
        }

        // Delete user data associated with the Facebook user ID
        await User.deleteOne({ 
            oauthId: data.user_id,
            oauthProvider: 'facebook'
        });

        // Respond with confirmation URL
        res.json({
            url: `http://localhost:3001/auth/data-deletion/confirm?id=${data.user_id}`,
            confirmation_code: data.user_id
        });
    } catch (error) {
        console.error('Data deletion error:', error);
        res.status(500).json({
            message: "Error processing deletion request",
            status: "error"
        });
    }
});

// Confirmation endpoint for data deletion
router.get('/data-deletion/confirm', async (req, res) => {
    res.send('Your data has been deleted successfully.');
});

// Helper function to parse Facebook signed request
function parseSignedRequest(signed_request, secret) {
    try {
        const [encodedSig, payload] = signed_request.split('.');
        const sig = Buffer.from(encodedSig, 'base64').toString('hex');
        const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
        return data;
    } catch (error) {
        console.error('Error parsing signed request:', error);
        return null;
    }
}

// Google OAuth routes
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        const token = authService.generateToken(req.user);
        res.redirect(`/auth/success?token=${token}`);
    }
);

// Facebook OAuth routes
router.get('/facebook',
    passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
        const token = authService.generateToken(req.user);
        res.redirect(`/auth/success?token=${token}`);
    }
);

// Protected routes
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin routes
router.get('/users', verifyToken, isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Service-to-service route to get multiple users by IDs (for Product Service)
router.get('/users/batch', async (req, res) => {
    try {
        const { ids } = req.query;
        
        if (!ids) {
            return res.status(400).json({ message: 'User IDs are required' });
        }
        
        const userIds = ids.split(',');
        const users = await User.find({ _id: { $in: userIds } }).select('name email storeName role');
        
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Service-to-service route to get user by ID (for Product Service)
router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select('name email storeName role');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.patch('/users/:userId/role', verifyToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        
        if (!['admin', 'buyer', 'seller'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const updatedUser = await authService.changeUserRole(userId, role);
        res.json(updatedUser);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;