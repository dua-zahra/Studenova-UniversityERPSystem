const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "*&()*()*KLJ:JSDWALKDE(**)";

module.exports = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Invalid token' });
    }
};