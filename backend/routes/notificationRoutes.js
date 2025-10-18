const express = require('express');
const router = express.Router();
const controller = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth(), controller.getUserNotifications);
router.put('/:id/read', requireAuth(), controller.markAsRead);
router.put('/read-all', requireAuth(), controller.markAllAsRead);
router.delete('/:id', requireAuth(), controller.deleteNotification);
router.get('/unread-count', requireAuth(), controller.getUnreadCount);
router.get('/types/:type', requireAuth(), controller.getByType);

module.exports = router;
