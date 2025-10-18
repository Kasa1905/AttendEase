const { Strike, User } = require('../models');
const { Op } = require('sequelize');
const strikeService = require('../services/strikeService');
const strikeUtils = require('../utils/strikeUtils');

// Helper function to transform strike data for frontend compatibility
function transformStrikeData(strike) {
  const plainStrike = strike.toJSON ? strike.toJSON() : strike;
  return {
    ...plainStrike,
    status: plainStrike.isActive ? 'active' : 'resolved',
    resolution: plainStrike.resolutionNotes || null
  };
}

async function getUserStrikes(req, res) {
  try {
    const { userId } = req.params;
    const { status, reason, fromDate, toDate, page = 1, pageSize = 20 } = req.query;

    const where = { userId };

    if (status === 'active') where.isActive = true;
    else if (status === 'resolved') where.isActive = false;

    if (reason) where.reason = reason;

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt[Op.gte] = new Date(fromDate);
      if (toDate) where.createdAt[Op.lte] = new Date(toDate);
    }

    const offset = (page - 1) * pageSize;
    const { count, rows } = await Strike.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'resolver', attributes: ['id', 'firstName', 'lastName'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset
    });

    res.json({ data: rows.map(transformStrikeData), page: parseInt(page), pageSize: parseInt(pageSize), total: count });
  } catch (error) {
    console.error('getUserStrikes error:', error);
    res.status(500).json({ error: 'Failed to fetch user strikes' });
  }
}

async function getMyStrikes(req, res) {
  try {
    const userId = req.user.id;
    const { status, reason, fromDate, toDate, page = 1, pageSize = 20 } = req.query;

    const where = { userId };

    if (status === 'active') where.isActive = true;
    else if (status === 'resolved') where.isActive = false;

    if (reason) where.reason = reason;

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt[Op.gte] = new Date(fromDate);
      if (toDate) where.createdAt[Op.lte] = new Date(toDate);
    }

    const offset = (page - 1) * pageSize;
    const { count, rows } = await Strike.findAndCountAll({
      where,
      include: [
        { model: User, as: 'resolver', attributes: ['id', 'firstName', 'lastName'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset
    });

    res.json({ data: rows.map(transformStrikeData), page: parseInt(page), pageSize: parseInt(pageSize), total: count });
  } catch (error) {
    console.error('getMyStrikes error:', error);
    res.status(500).json({ error: 'Failed to fetch strikes' });
  }
}

async function getActiveStrikeCount(req, res) {
  try {
    const { userId } = req.params;
    const count = await strikeService.countActiveStrikes(userId);
    res.json({ count });
  } catch (error) {
    console.error('getActiveStrikeCount error:', error);
    res.status(500).json({ error: 'Failed to get active strike count' });
  }
}

async function getMyActiveStrikeCount(req, res) {
  try {
    const userId = req.user.id;
    const count = await strikeService.countActiveStrikes(userId);
    res.json({ count });
  } catch (error) {
    console.error('getMyActiveStrikeCount error:', error);
    res.status(500).json({ error: 'Failed to get active strike count' });
  }
}

async function resolveStrike(req, res) {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    const resolvedBy = req.user.id;

    const strike = await strikeService.resolveStrike(id, resolvedBy);

    // Update resolution notes if provided
    if (resolutionNotes) {
      strike.resolutionNotes = resolutionNotes;
      await strike.save();
    }

    res.json({ data: transformStrikeData(strike) });
  } catch (error) {
    console.error('resolveStrike error:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to resolve strike' });
    }
  }
}

async function getAllStrikes(req, res) {
  try {
    const { userId, status, reason, fromDate, toDate, page = 1, pageSize = 20 } = req.query;

    const where = {};

    if (userId) where.userId = userId;
    if (status === 'active') where.isActive = true;
    else if (status === 'resolved') where.isActive = false;
    if (reason) where.reason = reason;

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt[Op.gte] = new Date(fromDate);
      if (toDate) where.createdAt[Op.lte] = new Date(toDate);
    }

    const offset = (page - 1) * pageSize;
    const { count, rows } = await Strike.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'studentId'] },
        { model: User, as: 'resolver', attributes: ['id', 'firstName', 'lastName'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset
    });

    res.json({ data: rows.map(transformStrikeData), page: parseInt(page), pageSize: parseInt(pageSize), total: count });
  } catch (error) {
    console.error('getAllStrikes error:', error);
    res.status(500).json({ error: 'Failed to fetch strikes' });
  }
}

async function getStrikeStatistics(req, res) {
  try {
    const { userId, fromDate, toDate } = req.query;

    const dateRange = fromDate && toDate ? { start: new Date(fromDate), end: new Date(toDate) } : null;

    if (userId) {
      const stats = await strikeUtils.calculateStrikeStatistics(userId, dateRange);
      res.json({ data: stats });
    } else {
      // Get statistics for all users and compute aggregate counters
      const users = await User.findAll({ where: { role: 'student' } });
      let totalStrikes = 0;
      let activeStrikes = 0;
      let resolvedStrikes = 0;
      let usersWithStrikes = 0;

      for (const user of users) {
        const userStats = await strikeUtils.calculateStrikeStatistics(user.id, dateRange);
        totalStrikes += userStats.totalStrikes;
        activeStrikes += userStats.activeStrikes;
        resolvedStrikes += userStats.resolvedStrikes;
        if (userStats.totalStrikes > 0) {
          usersWithStrikes++;
        }
      }

      res.json({ data: { totalStrikes, activeStrikes, resolvedStrikes, usersWithStrikes } });
    }
  } catch (error) {
    console.error('getStrikeStatistics error:', error);
    res.status(500).json({ error: 'Failed to calculate strike statistics' });
  }
}

async function bulkResolveStrikes(req, res) {
  try {
    const { strikeIds, resolutionNotes } = req.body;
    const resolvedBy = req.user.id;

    if (!Array.isArray(strikeIds) || strikeIds.length === 0) {
      return res.status(400).json({ error: 'strikeIds must be a non-empty array' });
    }

    const resolvedStrikes = [];
    const errors = [];

    for (const strikeId of strikeIds) {
      try {
        const strike = await strikeService.resolveStrike(strikeId, resolvedBy);
        if (resolutionNotes) {
          strike.resolutionNotes = resolutionNotes;
          await strike.save();
        }
        resolvedStrikes.push(strike);
      } catch (error) {
        errors.push({ strikeId, error: error.message });
      }
    }

    res.json({
      data: {
        resolvedCount: resolvedStrikes.length,
        resolvedStrikes: resolvedStrikes.map(transformStrikeData),
        errors
      }
    });
  } catch (error) {
    console.error('bulkResolveStrikes error:', error);
    res.status(500).json({ error: 'Failed to bulk resolve strikes' });
  }
}

async function getStrikeHistory(req, res) {
  try {
    const { userId, page = 1, pageSize = 50 } = req.query;

    const where = {};
    if (userId) where.userId = userId;

    const offset = (page - 1) * pageSize;
    const { count, rows } = await Strike.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'studentId'] },
        { model: User, as: 'resolver', attributes: ['id', 'firstName', 'lastName'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset
    });

    res.json({ data: rows.map(transformStrikeData), page: parseInt(page), pageSize: parseInt(pageSize), total: count });
  } catch (error) {
    console.error('getStrikeHistory error:', error);
    res.status(500).json({ error: 'Failed to fetch strike history' });
  }
}

module.exports = {
  getUserStrikes,
  getMyStrikes,
  getActiveStrikeCount,
  getMyActiveStrikeCount,
  resolveStrike,
  getAllStrikes,
  getStrikeStatistics,
  bulkResolveStrikes,
  getStrikeHistory
};