const express = require('express');
const router = express.Router();
const passport = require('../services/passport');
const authService = require('../services/authService');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Seller = require('../models/Seller');
const Buyer = require('../models/Buyer');

// Public routes
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, storeInfo } = req.body;
        
        // Validate required fields
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Validate seller-specific fields if role is seller
        if (role === 'seller') {
            if (!storeInfo?.storeName || !storeInfo?.taxNumber) {
                return res.status(400).json({ 
                    message: 'Store name and tax number are required for sellers' 
                });
            }
        }

        const result = await authService.register(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message || 'Registration failed' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await authService.login(email, password);
        res.json(result);
    } catch (error) {
        res.status(401).json({ message: error.message || 'Login failed' });
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
    passport.authenticate('google', { failureRedirect: 'http://localhost:5173/login' }),
    async (req, res) => {
        try {
            const token = authService.generateToken(req.user);
            
            res.send(`
                <html>
                <script>
                    window.opener.postMessage({
                        token: '${token}',
                        error: null
                    }, 'http://localhost:5173');
                    window.close();
                </script>
                <body>
                    Authentication successful. You can close this window.
                </body>
                </html>
            `);
        } catch (error) {
            res.send(`
                <html>
                <script>
                    window.opener.postMessage({
                        error: '${error.message || 'OAuth login failed'}'
                    }, 'http://localhost:5173');
                    window.close();
                </script>
                <body>
                    Authentication failed. You can close this window.
                </body>
                </html>
            `);
        }
    }
);

// Facebook OAuth routes
router.get('/facebook',
    passport.authenticate('facebook', { scope: ['email', 'public_profile'] })
);

router.get('/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: 'http://localhost:5173/login' }),
    async (req, res) => {
        try {
            console.log('Facebook OAuth callback received:', req.user);
            
            // Check if user is a pending seller
            if (req.user.role === 'seller' && req.user.sellerStatus === 'pending') {
                return res.redirect('http://localhost:5173/login?error=' + 
                    encodeURIComponent('Your seller account is pending approval. Please wait for admin verification.'));
            }

            // Check if user is a rejected seller
            if (req.user.role === 'seller' && req.user.sellerStatus === 'rejected') {
                return res.redirect('http://localhost:5173/login?error=' + 
                    encodeURIComponent('Your seller account has been rejected. Please contact support for more information.'));
            }

            // Check if user is a suspended seller
            if (req.user.role === 'seller' && req.user.sellerStatus === 'suspended') {
                return res.redirect('http://localhost:5173/login?error=' + 
                    encodeURIComponent('Your seller account has been suspended. Please contact support for more information.'));
            }

            const token = authService.generateToken(req.user);
            res.redirect(`http://localhost:5173/oauth-callback?token=${token}`);
        } catch (error) {
            console.error('Facebook OAuth callback error:', error);
            res.redirect('http://localhost:5173/login?error=' + encodeURIComponent(error.message));
        }
    }
);

// Token verification endpoint
router.get('/verify-token', verifyToken, (req, res) => {
    try {
        // If verifyToken middleware passed, token is valid
        res.json({ 
            valid: true,
            userId: req.user.userId
        });
    } catch (error) {
        res.status(401).json({ 
            valid: false,
            message: error.message || 'Token verification failed'
        });
    }
});

// Protected routes
router.use(verifyToken);

// Get user profile
router.get('/profile', async (req, res) => {
    try {
        const user = await authService.getUserProfile(req.user.userId);
        res.json(user);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// Update user profile
router.put('/profile', async (req, res) => {
    try {
        const updatedUser = await authService.updateUserProfile(req.user.userId, req.body);
        res.json(updatedUser);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update user role (for OAuth users)
router.post('/update-role', async (req, res) => {
    try {
        console.log('Update role request received:', req.body);
        const { role, storeName, taxNumber, storeDescription, contactNumber } = req.body;
        const userId = req.user.userId; // Get userId from verified token

        if (!role) {
            console.log('No role provided');
            return res.status(400).json({ error: 'Role is required' });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found with ID:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('Found user:', user);

        // Delete the old document
        await User.findByIdAndDelete(userId);
        console.log('Old user document deleted');

        let newUser;
        if (role === 'seller') {
            if (!storeName || !taxNumber) {
                console.log('Missing required seller fields');
                return res.status(400).json({ error: 'Store name and tax number are required for sellers' });
            }
            // Create new seller document
            newUser = new Seller({
                _id: userId,
                name: user.name,
                email: user.email,
                oauthProvider: user.oauthProvider,
                oauthId: user.oauthId,
                storeName,
                taxNumber,
                storeDescription,
                contactNumber,
                status: 'pending'
            });
        } else if (role === 'buyer') {
            // Create new buyer document
            newUser = new Buyer({
                _id: userId,
                name: user.name,
                email: user.email,
                oauthProvider: user.oauthProvider,
                oauthId: user.oauthId
            });
        }

        console.log('Saving new user document:', newUser);
        await newUser.save();
        console.log('New user document saved successfully');

        // Return updated user data
        const userData = {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            oauthProvider: newUser.oauthProvider,
            createdAt: newUser.createdAt
        };

        // Only include seller-specific fields if role is seller
        if (newUser.role === 'seller') {
            userData.storeName = newUser.storeName;
            userData.taxNumber = newUser.taxNumber;
            userData.storeDescription = newUser.storeDescription;
            userData.contactNumber = newUser.contactNumber;
            userData.status = newUser.status;
        }

        // Generate a new token with updated role information
        const newToken = jwt.sign(
            { 
                userId: newUser._id,
                role: newUser.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        console.log('Sending response with new token');
        return res.status(200).json({
            ...userData,
            token: newToken
        });
    } catch (error) {
        console.error('Role update error:', error);
        return res.status(500).json({ error: 'Failed to update role' });
    }
});

// Admin routes
router.use(isAdmin);

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await authService.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update user status (admin only)
router.patch('/users/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedUser = await authService.updateUserStatus(req.params.id, status);
        res.json(updatedUser);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// OAuth user creation
router.post('/oauth-user', async (req, res) => {
    try {
        console.log('Creating OAuth user...');
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);

        // Check if user already exists
        const existingUser = await User.findOne({ email: decoded.email });
        if (existingUser) {
            console.log('User already exists:', existingUser);
            return res.json({ user: existingUser });
        }

        // Create new user
        const user = new User({
            name: decoded.name,
            email: decoded.email,
            role: null, // No role set yet
            oauthProvider: decoded.provider,
            oauthId: decoded.sub
        });

        await user.save();
        console.log('New OAuth user created:', user);

        res.json({ user });
    } catch (error) {
        console.error('OAuth user creation error:', error);
        res.status(400).json({ message: error.message });
    }
});

// Create Admin Route - Protected with secret key
router.post('/create-admin', async (req, res) => {
    try {
        const { name, email, password, secretKey } = req.body;

        // Verify secret key
        if (!secretKey || secretKey !== process.env.ADMIN_SECRET_KEY) {
            return res.status(401).json({ 
                status: 'error',
                message: 'Invalid secret key. Admin creation not authorized.' 
            });
        }

        // Check if admin email already exists
        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({
                status: 'error',
                message: 'An account with this email already exists'
            });
        }

        // Create admin user
        const admin = new User({
            name,
            email,
            password,
            role: 'admin',
            status: 'approved' // Admins are automatically approved
        });

        await admin.save();

        // Remove password from response
        const adminResponse = admin.toObject();
        delete adminResponse.password;

        res.status(201).json({
            status: 'success',
            message: 'Admin account created successfully',
            admin: adminResponse
        });

    } catch (error) {
        console.error('Admin creation error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to create admin account'
        });
    }
});

module.exports = router;