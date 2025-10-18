const express = require('express');
const router = express.Router();

const userRoutes = require('./userRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const authRoutes = require('./authRoutes');
const dutySessionRoutes = require('./dutySessionRoutes');
const hourlyLogRoutes = require('./hourlyLogRoutes');
const leaveRequestRoutes = require('./leaveRequestRoutes');
const notificationRoutes = require('./notificationRoutes');
const strikeRoutes = require('./strikeRoutes');
const reportRoutes = require('./reportRoutes');
const eventRoutes = require('./eventRoutes');
const healthRoutes = require('./healthRoutes');

router.use('/v1/auth', authRoutes);
router.use('/v1/users', userRoutes);
router.use('/v1/attendance', attendanceRoutes);
router.use('/v1/duty-sessions', dutySessionRoutes);
router.use('/v1/hourly-logs', hourlyLogRoutes);
router.use('/v1/leave-requests', leaveRequestRoutes);
router.use('/v1/notifications', notificationRoutes);
router.use('/v1/strikes', strikeRoutes);
router.use('/v1/reports', reportRoutes);
router.use('/v1/events', eventRoutes);
router.use('/v1/health', healthRoutes);

// Mount health routes at root level for easy access by monitoring tools
router.use('/health', healthRoutes);

module.exports = router;
