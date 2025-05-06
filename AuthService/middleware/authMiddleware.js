const jwt = require('jsonwebtoken');
const redisClient = require('../shared/redis');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'auth-middleware.log' })
  ]
});

const verifyToken = async (req, res, next) => {
    try {
    const token = req.headers.authorization?.split(' ')[1];
        
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
            // Check if token verification result is cached
            const cacheKey = `token:verify:${token}`;
            const cachedUser = await redisClient.get(cacheKey);
            
            if (cachedUser) {
                logger.info('Token verification cache hit');
                // Ensure the user object is properly formatted
                req.user = cachedUser;
                return next();
            }
            
            // If not in cache, verify with JWT
            logger.info('Token verification cache miss');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Ensure we have a proper plain object
            const decodedObj = typeof decoded === 'object' ? decoded : { ...decoded };
            
            // Cache the result for future requests (short TTL for security)
            await redisClient.set(cacheKey, decodedObj, 300); // 5 minutes
            
            req.user = decodedObj;
        next();
        } catch (error) {
            logger.error('Token verification error:', error);
            return res.status(401).json({ message: 'Invalid token' });
        }
    } catch (error) {
        logger.error('Middleware error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
};

// Middleware to check if user is seller
const isSeller = (req, res, next) => {
    if (req.user.role !== 'seller') {
        return res.status(403).json({ message: 'Access denied. Seller only.' });
    }
    next();
};

// Middleware to check if user is either admin or the same user
const isAuthorized = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.userId !== req.params.id) {
        return res.status(403).json({ message: 'Access denied. Unauthorized.' });
    }
    next();
};

module.exports = { verifyToken, isAdmin, isSeller, isAuthorized };