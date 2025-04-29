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
        console.log('Register request received:', req.body);
        const { name, email, password, role, storeInfo } = req.body;
        
        // Validate required fields
        if (!name || !email || !password || !role) {
            console.log('Missing required fields:', { name, email, password, role });
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
        console.log('Registration successful:', {
            user: result.user,
            hasToken: !!result.token
        });

        // Return JSON response for manual registration
        res.status(201).json(result);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ message: error.message || 'Registration failed' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt for email:', email);
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                status: 'error',
                message: 'The email or password you entered is incorrect. Please try again.' 
            });
        }

        // Verify password first
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ 
                status: 'error',
                message: 'The email or password you entered is incorrect. Please try again.' 
            });
        }

        // Check if user is a pending seller
        if (user.role === 'seller' && user.status === 'pending') {
            return res.status(403).json({ 
                status: 'error',
                message: 'Your seller account is awaiting approval. Our team will review your application within 24-48 hours. You will receive an email notification once approved.',
                pendingSeller: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    storeName: user.storeName,
                    taxNumber: user.taxNumber,
                    storeDescription: user.storeDescription,
                    contactNumber: user.contactNumber
                }
            });
        }

        // Check if user is a rejected seller
        if (user.role === 'seller' && user.status === 'rejected') {
            return res.status(403).json({ 
                status: 'error',
                message: 'Your seller account application has been declined. Please contact our support team for more information at support@example.com.' 
            });
        }

        // Check if user is a suspended seller
        if (user.role === 'seller' && user.status === 'suspended') {
            return res.status(403).json({ 
                status: 'error',
                message: 'Your seller account has been temporarily suspended. Please contact our support team at support@example.com for assistance.' 
            });
        }

        // Generate token
        const token = authService.generateToken(user);
        
        // Send JSON response for successful login
        res.json({
            status: 'success',
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                ...(user.role === 'seller' && {
                    storeName: user.storeName,
                    taxNumber: user.taxNumber,
                    storeDescription: user.storeDescription,
                    contactNumber: user.contactNumber
                })
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'An unexpected error occurred. Please try again later. If the problem persists, contact support.' 
        });
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
            console.log('Google OAuth callback received:', req.user);
            
            // Check if user is a pending seller
            if (req.user.role === 'seller' && req.user.status === 'pending') {
                return res.send(`
                    <html>
                    <script>
                        window.opener.postMessage({
                            error: 'Your seller account is pending approval. Please wait for admin verification.'
                        }, 'http://localhost:5173');
                        window.close();
                    </script>
                    </html>
                `);
            }

            const token = authService.generateToken(req.user);
            
            // Send token through postMessage and close window
            res.send(`
                <html>
                <script>
                    try {
                        window.opener.postMessage({
                            token: '${token}',
                            error: null
                        }, 'http://localhost:5173');
                    } catch (e) {
                        console.error('PostMessage error:', e);
                    }
                    window.close();
                </script>
                <body>
                    Authentication successful. You can close this window.
                </body>
                </html>
            `);
        } catch (error) {
            console.error('Google OAuth callback error:', error);
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

// Protected routes
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        console.log(user);
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

// Update user role (for OAuth users)
router.post('/update-role', async (req, res) => {
    try {
        console.log('Update role request received:', req.body);
        const { role, storeName, taxNumber, storeDescription, contactNumber } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ error: 'No token provided' });
        }

        if (!role) {
            console.log('No role provided');
            return res.status(400).json({ error: 'Role is required' });
        }

        // Verify token and get user ID
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token verified, decoded:', decoded);
        } catch (err) {
            console.log('Token verification failed:', err);
            return res.status(401).json({ error: 'Invalid token' });
        }

        const userId = decoded.userId;

        if (!userId) {
            console.log('No userId in token');
            return res.status(401).json({ error: 'Invalid token: No userId' });
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