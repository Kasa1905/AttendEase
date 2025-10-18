const { Strike, User } = require('../models');
const { Op } = require('sequelize');
const notificationService = require('./notificationService');
const emailService = require('./emailService');
const strikeUtils = require('../utils/strikeUtils');

async function createStrike(userId, reason, description, sessionId = null, logId = null) {
  try {
    // Prevent duplicate strikes for the same reason within a short time window
    const recentStrike = await Strike.findOne({
      where: {
        userId,
        reason,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        },
        isActive: true
      }
    });

    if (recentStrike) {
      console.log(`Duplicate strike prevented for user ${userId}, reason: ${reason}`);
      return null;
    }

    const strike = await Strike.create({
      userId,
      reason,
      description,
      sessionId,
      logId,
      isActive: true
    });

    // Update user's strike count
    const user = await User.findByPk(userId);
    if (user) {
      await user.incrementStrikeCount();
    }

    // Trigger escalation check
    await escalateStrikes(userId);

    return strike;
  } catch (error) {
    console.error('Error creating strike:', error);
    throw error;
  }
}

async function escalateStrikes(userId) {
  try {
    const activeStrikeCount = await countActiveStrikes(userId);

    // Use environment variables for escalation thresholds
    const suspensionThreshold = parseInt(process.env.STRIKE_SUSPENSION_THRESHOLD) || 5;
    const warningThreshold = parseInt(process.env.STRIKE_WARNING_THRESHOLD) || 3;
    const suspensionDays = parseInt(process.env.SUSPENSION_DAYS) || 7;

    if (activeStrikeCount >= suspensionThreshold) {
      // Suspend user for configured number of days
      await suspendUser(userId, suspensionDays);
      await sendSuspensionNotification(userId, activeStrikeCount);
    } else if (activeStrikeCount >= warningThreshold) {
      // Send warning email and notifications
      await sendStrikeWarningNotification(userId, activeStrikeCount);
    }
  } catch (error) {
    console.error('Error escalating strikes:', error);
    throw error;
  }
}

async function countActiveStrikes(userId) {
  return await Strike.count({
    where: {
      userId,
      isActive: true
    }
  });
}

async function resolveStrike(strikeId, resolvedBy) {
  try {
    const strike = await Strike.findByPk(strikeId);
    if (!strike || !strike.isActive) {
      throw new Error('Strike not found or already resolved');
    }

    strike.isActive = false;
    strike.resolvedBy = resolvedBy;
    strike.resolvedAt = new Date();
    await strike.save();

    // Update user's strike count
    const user = await User.findByPk(strike.userId);
    if (user && user.strikeCount > 0) {
      user.strikeCount -= 1;
      await user.save();
    }

    // Send resolution notification
    await notificationService.sendNotification(
      strike.userId,
      'strike_resolved',
      'Strike Resolved',
      `Your strike for ${strike.reason} has been resolved.`,
      { strikeId: strike.id }
    );

    return strike;
  } catch (error) {
    console.error('Error resolving strike:', error);
    throw error;
  }
}

async function checkAndCreateMissedLogStrikes(userId, sessionId) {
  try {
    const gaps = await strikeUtils.calculateMissedLogGaps(sessionId);
    const strikes = [];

    for (const gap of gaps) {
      const description = `Missed hourly log during duty session. Expected log at ${gap.expectedTime}, gap of ${gap.durationMinutes} minutes.`;
      const strike = await createStrike(userId, 'missed_hourly_log', description, sessionId);
      if (strike) strikes.push(strike);
    }

    return strikes;
  } catch (error) {
    console.error('Error checking missed log strikes:', error);
    throw error;
  }
}

async function createInsufficientDutyStrike(userId, sessionId, actualMinutes) {
  try {
    const requiredMinutes = 120; // 2 hours
    const description = `Insufficient duty hours: ${actualMinutes} minutes logged, ${requiredMinutes} minutes required.`;
    return await createStrike(userId, 'insufficient_duty_hours', description, sessionId);
  } catch (error) {
    console.error('Error creating insufficient duty strike:', error);
    throw error;
  }
}

async function createExcessiveBreakStrike(userId, logId, breakMinutes) {
  try {
    const maxBreakMinutes = 30; // 30 minutes max break
    const description = `Excessive break duration: ${breakMinutes} minutes taken, maximum allowed is ${maxBreakMinutes} minutes.`;
    return await createStrike(userId, 'excessive_break', description, null, logId);
  } catch (error) {
    console.error('Error creating excessive break strike:', error);
    throw error;
  }
}

async function suspendUser(userId, days) {
  try {
    const suspensionEndDate = strikeUtils.calculateSuspensionEndDate(new Date(), days);
    const user = await User.findByPk(userId);
    if (user) {
      user.suspendedUntil = suspensionEndDate;
      await user.save();
    }
    return user;
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
}

async function checkSuspensionExpiry(userId) {
  try {
    const user = await User.findByPk(userId);
    if (user && user.isSuspended() === false && user.suspendedUntil) {
      // Suspension has expired, clear it
      user.suspendedUntil = null;
      await user.save();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking suspension expiry:', error);
    throw error;
  }
}

async function sendStrikeWarningNotification(userId, strikeCount) {
  try {
    const user = await User.findByPk(userId);
    if (!user) return;

    // Send notification to student
    await notificationService.sendNotification(
      userId,
      'strike_warning',
      'Strike Warning',
      `You have ${strikeCount} active strikes. Further violations may result in suspension.`,
      { strikeCount }
    );

    // Send notifications to core team and teachers
    await notificationService.sendRoleNotification(
      'core_team',
      'strike_warning',
      'Student Strike Warning',
      `${user.firstName} ${user.lastName} has ${strikeCount} active strikes.`,
      { userId, strikeCount }
    );

    await notificationService.sendRoleNotification(
      'teacher',
      'strike_warning',
      'Student Strike Warning',
      `${user.firstName} ${user.lastName} has ${strikeCount} active strikes.`,
      { userId, strikeCount }
    );

    // Send email if enabled
    if (process.env.STRIKE_ESCALATION_EMAIL_ENABLED !== 'false') {
      await emailService.sendStrikeWarningEmail(user.email, `${user.firstName} ${user.lastName}`, strikeCount);
      await emailService.sendStrikeNotificationToTeachers(`${user.firstName} ${user.lastName}`, 'Multiple strikes', strikeCount);
      await emailService.sendStrikeNotificationToCoreTeam(`${user.firstName} ${user.lastName}`, 'Multiple strikes', strikeCount);
    }
  } catch (error) {
    console.error('Error sending strike warning notification:', error);
  }
}

async function sendSuspensionNotification(userId, strikeCount) {
  try {
    const user = await User.findByPk(userId);
    if (!user) return;

    const suspensionDays = parseInt(process.env.SUSPENSION_DAYS) || 7;

    // Send notification to student
    await notificationService.sendNotification(
      userId,
      'suspension',
      'Account Suspended',
      `Your account has been suspended for ${suspensionDays} days due to ${strikeCount} active strikes.`,
      { strikeCount, suspensionDays, suspendedUntil: user.suspendedUntil }
    );

    // Send notifications to core team and teachers
    await notificationService.sendRoleNotification(
      'core_team',
      'suspension',
      'Student Suspended',
      `${user.firstName} ${user.lastName} has been suspended for ${suspensionDays} days.`,
      { userId, strikeCount, suspensionDays }
    );

    await notificationService.sendRoleNotification(
      'teacher',
      'suspension',
      'Student Suspended',
      `${user.firstName} ${user.lastName} has been suspended for ${suspensionDays} days.`,
      { userId, strikeCount, suspensionDays }
    );

    // Send email if enabled
    if (process.env.STRIKE_ESCALATION_EMAIL_ENABLED !== 'false') {
      await emailService.sendSuspensionEmail(user.email, `${user.firstName} ${user.lastName}`, user.suspendedUntil);
      await emailService.sendStrikeNotificationToTeachers(`${user.firstName} ${user.lastName}`, 'Account suspended', strikeCount);
      await emailService.sendStrikeNotificationToCoreTeam(`${user.firstName} ${user.lastName}`, 'Account suspended', strikeCount);
    }
  } catch (error) {
    console.error('Error sending suspension notification:', error);
  }
}

module.exports = {
  createStrike,
  escalateStrikes,
  countActiveStrikes,
  resolveStrike,
  checkAndCreateMissedLogStrikes,
  createInsufficientDutyStrike,
  createExcessiveBreakStrike,
  suspendUser,
  checkSuspensionExpiry
};