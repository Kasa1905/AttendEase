const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET || 'supersecret') + '_refresh';
const ACCESS_EXP = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXP = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function generateAccessToken(user) {
  const payload = { id: user.id, role: user.role, email: user.email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXP });
}

function generateRefreshToken(user) {
  const payload = { id: user.id };
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

function extractTokenFromHeader(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') return parts[1];
  return null;
}

function createTokenPair(user) {
  return { accessToken: generateAccessToken(user), refreshToken: generateRefreshToken(user) };
}

function isTokenExpired(token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) return true;
    const exp = decoded.payload.exp;
    return Date.now() >= exp * 1000;
  } catch (err) {
    return true;
  }
}

module.exports = { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken, extractTokenFromHeader, createTokenPair, isTokenExpired };
