const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const userService = require('../services/userService');
const sellerService = require('../services/sellerService');

// Get dashboard stats (admin only)
router.get('/admin/dashboard-stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    
    const stats = {
      totalUsers: users.length,
      totalSellers: users.filter(user => user.role === 'seller').length,
      pendingApprovals: users.filter(user => user.role === 'seller' && user.status === 'pending').length,
      newUsersToday: users.filter(user => {
        const today = new Date();
        const userCreatedDate = new Date(user.createdAt);
        return userCreatedDate.toDateString() === today.toDateString();
      }).length
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get seller store information (public route)
router.get('/seller/:id/store', async (req, res) => {
  try {
    const storeInfo = await sellerService.getSellerStoreInfo(req.params.id);
    res.json(storeInfo);
  } catch (error) {
    if (error.message === 'Seller not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

// Get multiple seller store information (public route)
router.get('/sellers/batch', async (req, res) => {
  try {
    console.log('Received request to fetch multiple seller store information with IDs:', req.query.ids);
    const sellerIds = req.query.ids ? req.query.ids.split(',') : [];
    if (!sellerIds.length) {
      return res.status(400).json({ message: 'No seller IDs provided' });
    }
    const storesInfo = await sellerService.getMultipleSellerStoreInfo(sellerIds);
    res.json(storesInfo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all users (admin only)
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a specific user
router.get('/:id', verifyToken, async (req, res) => {
  try {
    if (!userService.hasPermission(req.user, req.params.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

// Create a new user (admin only)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({
      message: 'User created successfully',
      user
    });
  } catch (error) {
    if (error.message === 'User already exists with this email') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update a user
router.put('/:id', verifyToken, async (req, res) => {
  try {
    console.log(req.user);
    if (!userService.hasPermission(req.user, req.params.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const user = await userService.updateUser(req.params.id, req.body, req.user.role === 'admin');
    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Only admins can change roles') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update user status (admin only)
router.put('/admin/update-status/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const user = await userService.updateUserStatus(req.params.id, status);
    res.json({
      message: 'User status updated successfully',
      user
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Invalid status') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete a user
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (!userService.hasPermission(req.user, req.params.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const result = await userService.deleteUser(req.params.id);
    res.json(result);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 