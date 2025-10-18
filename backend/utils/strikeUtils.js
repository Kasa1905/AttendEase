const { HourlyLog, Strike } = require('../models');
const { Op } = require('sequelize');

async function calculateMissedLogGaps(sessionId) {
  try {
    const logs = await HourlyLog.findAll({
      where: { dutySessionId: sessionId },
      order: [['createdAt', 'ASC']]
    });

    if (logs.length === 0) return [];

    const gaps = [];
    const sessionStart = logs[0].createdAt;
    const sessionEnd = logs[logs.length - 1].createdAt;

    // Check for gaps between logs (assuming 1-hour intervals)
    for (let i = 0; i < logs.length - 1; i++) {
      const current = logs[i];
      const next = logs[i + 1];

      const gapMinutes = (next.createdAt - current.createdAt) / (1000 * 60);

      if (gapMinutes > 60) { // More than 1 hour gap
        gaps.push({
          expectedTime: new Date(current.createdAt.getTime() + 60 * 60 * 1000), // 1 hour after current log
          durationMinutes: gapMinutes,
          startTime: current.createdAt,
          endTime: next.createdAt
        });
      }
    }

    return gaps;
  } catch (error) {
    console.error('Error calculating missed log gaps:', error);
    throw error;
  }
}

function validateStrikeEligibility(userId, reason, date) {
  // Check if a strike for this reason already exists for today
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return Strike.findOne({
    where: {
      userId,
      reason,
      createdAt: {
        [Op.between]: [startOfDay, endOfDay]
      },
      isActive: true
    }
  }).then(existingStrike => !existingStrike);
}

function formatStrikeDescription(reason, metadata = {}) {
  const templates = {
    missed_hourly_log: 'Missed hourly log during duty session',
    insufficient_duty_hours: `Insufficient duty hours: ${metadata.actualMinutes || 0} minutes logged, 120 minutes required`,
    excessive_break: `Excessive break duration: ${metadata.breakMinutes || 0} minutes taken, maximum 30 minutes allowed`
  };

  return templates[reason] || `Strike for ${reason}`;
}

function calculateSuspensionEndDate(startDate, days) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);
  return endDate;
}

function getStrikeEscalationLevel(strikeCount) {
  if (strikeCount >= 5) return 'suspension';
  if (strikeCount >= 3) return 'warning';
  return 'none';
}

function groupStrikesByReason(strikes) {
  return strikes.reduce((groups, strike) => {
    const reason = strike.reason;
    if (!groups[reason]) {
      groups[reason] = [];
    }
    groups[reason].push(strike);
    return groups;
  }, {});
}

async function calculateStrikeStatistics(userId, dateRange = null) {
  try {
    const whereClause = { userId };
    if (dateRange) {
      whereClause.createdAt = {
        [Op.between]: [dateRange.start, dateRange.end]
      };
    }

    const strikes = await Strike.findAll({ where: whereClause });

    const stats = {
      totalStrikes: strikes.length,
      activeStrikes: strikes.filter(s => s.isActive).length,
      resolvedStrikes: strikes.filter(s => !s.isActive).length,
      byReason: groupStrikesByReason(strikes),
      escalationLevel: getStrikeEscalationLevel(strikes.filter(s => s.isActive).length)
    };

    return stats;
  } catch (error) {
    console.error('Error calculating strike statistics:', error);
    throw error;
  }
}

function isStrikeResolvable(strike, userRole) {
  if (!strike.isActive) return false;

  // Core team and teachers can resolve strikes
  return ['core_team', 'teacher'].includes(userRole);
}

module.exports = {
  calculateMissedLogGaps,
  validateStrikeEligibility,
  formatStrikeDescription,
  calculateSuspensionEndDate,
  getStrikeEscalationLevel,
  groupStrikesByReason,
  calculateStrikeStatistics,
  isStrikeResolvable
};