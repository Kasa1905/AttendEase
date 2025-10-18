const { Notification } = require('../models');
const notificationService = require('../services/notificationService');

async function getUserNotifications(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize || '20', 10)));
    const offset = (page - 1) * pageSize;
    const { count, rows } = await Notification.findAndCountAll({ where: { userId }, order: [['createdAt','DESC']], limit: pageSize, offset });
    return res.json({ data: rows, page, pageSize, total: count });
  } catch (e) { console.error('getUserNotifications', e); return res.status(500).json({ error: 'Failed to fetch notifications' }); }
}

async function markAsRead(req, res) {
  try {
    const userId = req.user.id; const id = req.params.id;
    const n = await Notification.findOne({ where: { id, userId } });
    if (!n) return res.status(404).json({ error: 'Not found' });
    await n.markRead();
    return res.json({ success: true });
  } catch (e) { console.error('markAsRead', e); return res.status(500).json({ error: 'Failed' }); }
}

async function markAllAsRead(req, res) {
  try {
    const userId = req.user.id;
    await Notification.update({ isRead: true, readAt: new Date() }, { where: { userId, isRead: false } });
    return res.json({ success: true });
  } catch (e) { console.error('markAllAsRead', e); return res.status(500).json({ error: 'Failed' }); }
}

async function deleteNotification(req, res) {
  try {
    const userId = req.user.id; const id = req.params.id;
    const n = await Notification.findOne({ where: { id, userId } });
    if (!n) return res.status(404).json({ error: 'Not found' });
    await n.destroy();
    return res.json({ success: true });
  } catch (e) { console.error('deleteNotification', e); return res.status(500).json({ error: 'Failed' }); }
}

async function getUnreadCount(req, res) {
  try {
    const userId = req.user.id;
    const count = await Notification.count({ where: { userId, isRead: false } });
    return res.json({ unread: count });
  } catch (e) { console.error('getUnreadCount', e); return res.status(500).json({ error: 'Failed' }); }
}

async function getByType(req, res) {
  try {
    const userId = req.user.id; const type = req.params.type;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize || '20', 10)));
    const offset = (page - 1) * pageSize;
    const { count, rows } = await Notification.findAndCountAll({ where: { userId, type }, order: [['createdAt','DESC']], limit: pageSize, offset });
    return res.json({ data: rows, page, pageSize, total: count });
  } catch (e) { console.error('getByType', e); return res.status(500).json({ error: 'Failed' }); }
}

module.exports = { getUserNotifications, markAsRead, markAllAsRead, deleteNotification, getUnreadCount, getByType };
