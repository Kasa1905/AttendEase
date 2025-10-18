const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, loginSchema, registerSchema, changePasswordSchema, refreshTokenSchema, profileUpdateSchema } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts, please try again later.' });

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);
router.post('/logout', requireAuth, authController.logout);
router.get('/profile', requireAuth, authController.getProfile);
router.put('/profile', requireAuth, validate(profileUpdateSchema), authController.updateProfile);
router.post('/change-password', requireAuth, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
