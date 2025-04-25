const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Middleware to check if user is admin
const isAuthorized = (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'seller') {
        return next();
    }
    else{
        return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action' });
    }
};

module.exports = { verifyToken, isAuthorized }; 