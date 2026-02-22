const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            full_name: decoded.full_name
        };
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}

module.exports = { authenticate, authorize };
