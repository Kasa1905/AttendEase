const { extractTokenFromHeader, verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models');

async function authenticateToken(req, res, next) {
  try {
    const token = extractTokenFromHeader(req.headers.authorization || req.headers.Authorization);
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const payload = verifyAccessToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid token' });
    const user = await User.findByPk(payload.id);
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAuth(req, res, next) {
  authenticateToken(req, res, async () => {
    // Check suspension for students after authentication
    if (req.user && req.user.role === 'student') {
      await blockIfSuspended(req, res, next);
    } else {
      next();
    }
  });
}

async function blockIfSuspended(req, res, next) {
  try {
    if (!req.user) return next();
    const user = await User.findByPk(req.user.id);
    if (user && user.isSuspended()) {
      return res.status(403).json({
        error: 'Account suspended',
        suspendedUntil: user.suspendedUntil,
        message: `Your account is suspended until ${user.suspendedUntil.toISOString().split('T')[0]}`
      });
    }
    next();
  } catch (error) {
    console.error('Suspension check error:', error);
    next();
  }
}

async function optionalAuth(req, res, next) {
  try {
    const token = extractTokenFromHeader(req.headers.authorization || req.headers.Authorization);
    if (!token) return next();
    const payload = verifyAccessToken(token);
    if (!payload) return next();
    const user = await User.findByPk(payload.id);
    if (!user || !user.isActive) return next();
    req.user = user;
    return next();
  } catch (err) {
    return next();
  }
}

module.exports = { authenticateToken, requireAuth, blockIfSuspended, optionalAuth };
