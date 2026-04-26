import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authVerify = (req, res, next) => {
    const token = req.headers["authorization"];
    try {
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
        };
        const decoded = jwt.verify(token, JWT_SECRET);
        req.adminId = decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
    }
};