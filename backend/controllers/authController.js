const { User } = require('../models');
const { createTokenPair } = require('../utils/jwt');
const Joi = require('joi');

async function register(req, res, next) {
  try {
    const { email, password, firstName, lastName } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already in use' });
    // Force self-registration to student role only
    const user = await User.create({ email, password, firstName, lastName, role: 'student' });
    const tokens = createTokenPair(user);
    res.status(201).json({ data: { user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }, tokens } });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    user.lastLogin = new Date();
    await user.save();
    const tokens = createTokenPair(user);
    res.json({ data: { user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }, tokens } });
  } catch (err) { next(err); }
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    // For simplicity, we will verify and re-issue; a production app should maintain a refresh token store
    const { verifyRefreshToken, createTokenPair } = require('../utils/jwt');
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findByPk(payload.id);
    if (!user) return res.status(401).json({ error: 'Invalid refresh token' });
    const tokens = createTokenPair(user);
    res.json({ data: tokens });
  } catch (err) { return res.status(401).json({ error: 'Invalid refresh token' }); }
}

async function logout(req, res, next) {
  // Stateless JWT: logout is client-side; return success. For revocation, maintain token blacklist.
  res.json({ data: true });
}

async function getProfile(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ data: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } });
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { firstName, lastName, department, year, section } = req.body;
    await user.update({ firstName, lastName, department, year, section });
    res.json({ data: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } });
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body;
    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ data: true });
  } catch (err) { next(err); }
}

module.exports = { register, login, refreshToken, logout, getProfile, updateProfile, changePassword };
