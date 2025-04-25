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
const isBuyer = (req, res, next) => {
    if (req.user.role !== 'buyer' ){
        return res.status(401).json({message: 'Buyer role only can do this action'});
    }
    next();
}
module.exports = { verifyToken, isBuyer };
