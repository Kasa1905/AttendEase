const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate } = require('../middleware/auth');

// Search events (requires authentication)
router.get('/', authenticate, eventController.searchEvents);

module.exports = router;