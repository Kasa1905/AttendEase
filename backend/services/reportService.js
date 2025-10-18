const { AttendanceRecord, DutySession, Strike, User, HourlyLog, Event } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');

class ReportService {
  /**
   * Generate attendance summary data with filtering
   * @param {Object} filters - Filter parameters
   * @returns {Object} Formatted attendance data and statistics
   */
  async generateAttendanceSummaryData(filters = {}) {
    const whereClause = this.buildAttendanceWhereClause(filters);

    const records = await AttendanceRecord.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'studentId']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['firstName', 'lastName']
        }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']]
    });

    const statistics = this.calculateAttendanceStatistics(records);
    const formattedData = this.formatAttendanceData(records);

    return {
      data: formattedData,
      statistics,
      totalRecords: records.length,
      filters: filters
    };
  }

  /**
   * Generate duty log data with associated hourly logs
   * @param {Object} filters - Filter parameters
   * @returns {Object} Formatted duty session data and statistics
   */
  async generateDutyLogData(filters = {}) {
    const whereClause = this.buildDutySessionWhereClause(filters);

    const sessions = await DutySession.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'studentId']
        },
        {
          model: Event,
          attributes: ['id', 'name', 'date']
        },
        {
          model: HourlyLog,
          as: 'HourlyLogs',
          attributes: ['id', 'startTime', 'endTime', 'duration', 'notes']
        }
      ],
      order: [['startTime', 'DESC']]
    });

    const statistics = this.calculateDutyStatistics(sessions);
    const formattedData = this.formatDutyData(sessions);

    return {
      data: formattedData,
      statistics,
      totalRecords: sessions.length,
      filters: filters
    };
  }

  /**
   * Generate penalty report data
   * @param {Object} filters - Filter parameters
   * @returns {Object} Formatted strike data and statistics
   */
  async generatePenaltyReportData(filters = {}) {
    const whereClause = this.buildStrikeWhereClause(filters);

    const strikes = await Strike.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'studentId']
        },
        {
          model: User,
          as: 'resolver',
          attributes: ['firstName', 'lastName']
        }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']]
    });

    const statistics = this.calculateStrikeStatistics(strikes);
    const formattedData = this.formatStrikeData(strikes);

    return {
      data: formattedData,
      statistics,
      totalRecords: strikes.length,
      filters: filters
    };
  }

  /**
   * Generate daily summary data for teacher review
   * @param {string} date - Date for the summary
   * @param {Object} filters - Additional filters
   * @returns {Object} Comprehensive daily summary
   */
  async generateDailySummaryData(date, filters = {}) {
    const targetDate = date || moment().format('YYYY-MM-DD');

    // Get attendance records for the date
    const attendanceWhere = this.buildAttendanceWhereClause({ ...filters, dateFrom: targetDate, dateTo: targetDate });
    const attendanceRecords = await AttendanceRecord.findAll({
      where: attendanceWhere,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'studentId']
        }
      ]
    });

    // Get duty sessions for the date
    const dutyWhere = this.buildDutySessionWhereClause({ ...filters, dateFrom: targetDate, dateTo: targetDate });
    const dutySessions = await DutySession.findAll({
      where: dutyWhere,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'studentId']
        },
        {
          model: HourlyLog,
          as: 'HourlyLogs'
        }
      ]
    });

    const statistics = {
      totalAttendance: attendanceRecords.length,
      presentCount: attendanceRecords.filter(r => r.status === 'present_in_class').length,
      dutyCount: attendanceRecords.filter(r => r.status === 'on_club_duty').length,
      absentCount: attendanceRecords.filter(r => r.status === 'absent').length,
      totalDutySessions: dutySessions.length,
      totalDutyHours: dutySessions.reduce((sum, session) => sum + (session.totalDurationMinutes || 0), 0) / 60,
      pendingApprovals: attendanceRecords.filter(r => r.isApproved === null).length
    };

    return {
      date: targetDate,
      attendanceRecords: this.formatAttendanceData(attendanceRecords),
      dutySessions: this.formatDutyData(dutySessions),
      statistics,
      filters: { ...filters, date: targetDate }
    };
  }

  /**
   * Generate member activity report data
   * @param {Object} filters - Filter parameters
   * @returns {Object} Member activity data and statistics
   */
  async generateMemberActivityData(filters = {}) {
    const dateFrom = filters.dateFrom || moment().subtract(30, 'days').format('YYYY-MM-DD');
    const dateTo = filters.dateTo || moment().format('YYYY-MM-DD');

    // Get all users with their activity data
    const users = await User.findAll({
      where: filters.role ? { role: filters.role } : {},
      attributes: ['id', 'firstName', 'lastName', 'email', 'studentId', 'role']
    });

    const memberData = [];

    for (const user of users) {
      const attendanceRecords = await AttendanceRecord.findAll({
        where: {
          userId: user.id,
          date: { [Op.between]: [dateFrom, dateTo] }
        }
      });

      const dutySessions = await DutySession.findAll({
        where: {
          userId: user.id,
          startTime: { [Op.between]: [dateFrom + ' 00:00:00', dateTo + ' 23:59:59'] }
        }
      });

      const strikes = await Strike.findAll({
        where: {
          userId: user.id,
          date: { [Op.between]: [dateFrom, dateTo] }
        }
      });

      const totalDutyHours = dutySessions.reduce((sum, session) => sum + (session.totalDurationMinutes || 0), 0) / 60;
      const attendanceRate = attendanceRecords.length > 0 ?
        (attendanceRecords.filter(r => r.status !== 'absent').length / attendanceRecords.length) * 100 : 0;

      memberData.push({
        user: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          studentId: user.studentId,
          role: user.role
        },
        attendance: {
          totalRecords: attendanceRecords.length,
          presentCount: attendanceRecords.filter(r => r.status === 'present_in_class').length,
          dutyCount: attendanceRecords.filter(r => r.status === 'on_club_duty').length,
          absentCount: attendanceRecords.filter(r => r.status === 'absent').length,
          attendanceRate: Math.round(attendanceRate)
        },
        duty: {
          totalSessions: dutySessions.length,
          totalHours: Math.round(totalDutyHours * 100) / 100
        },
        penalties: {
          totalStrikes: strikes.length,
          activeStrikes: strikes.filter(s => s.isActive).length
        }
      });
    }

    const statistics = {
      totalMembers: memberData.length,
      averageAttendanceRate: memberData.length > 0 ?
        Math.round(memberData.reduce((sum, m) => sum + m.attendance.attendanceRate, 0) / memberData.length) : 0,
      totalDutyHours: memberData.reduce((sum, m) => sum + m.duty.totalHours, 0),
      totalStrikes: memberData.reduce((sum, m) => sum + m.penalties.totalStrikes, 0)
    };

    return {
      data: memberData,
      statistics,
      dateRange: { from: dateFrom, to: dateTo },
      filters: filters
    };
  }

  /**
   * Format report data for different export types
   * @param {Array} data - Raw data
   * @param {string} reportType - Type of report
   * @returns {Array} Formatted data
   */
  formatReportData(data, reportType) {
    switch (reportType) {
      case 'attendance':
        return this.formatAttendanceData(data);
      case 'duty':
        return this.formatDutyData(data);
      case 'penalty':
        return this.formatStrikeData(data);
      default:
        return data;
    }
  }

  /**
   * Calculate report statistics
   * @param {Array} data - Data array
   * @param {string} reportType - Type of report
   * @returns {Object} Statistics object
   */
  calculateReportStatistics(data, reportType) {
    switch (reportType) {
      case 'attendance':
        return this.calculateAttendanceStatistics(data);
      case 'duty':
        return this.calculateDutyStatistics(data);
      case 'penalty':
        return this.calculateStrikeStatistics(data);
      default:
        return {};
    }
  }

  /**
   * Validate report filters
   * @param {Object} filters - Filter parameters
   * @returns {Object} Validation result
   */
  validateReportFilters(filters) {
    const errors = [];

    if (filters.dateFrom && filters.dateTo) {
      const fromDate = moment(filters.dateFrom);
      const toDate = moment(filters.dateTo);

      if (fromDate.isAfter(toDate)) {
        errors.push('Start date cannot be after end date');
      }

      const diffDays = toDate.diff(fromDate, 'days');
      if (diffDays > 365) {
        errors.push('Date range cannot exceed 365 days');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Helper methods for building where clauses
  buildAttendanceWhereClause(filters) {
    const where = {};

    if (filters.dateFrom && filters.dateTo) {
      where.date = { [Op.between]: [filters.dateFrom, filters.dateTo] };
    } else if (filters.dateFrom) {
      where.date = { [Op.gte]: filters.dateFrom };
    } else if (filters.dateTo) {
      where.date = { [Op.lte]: filters.dateTo };
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.status && Array.isArray(filters.status)) {
      where.status = { [Op.in]: filters.status };
    } else if (filters.status) {
      where.status = filters.status;
    }

    if (filters.approvalStatus) {
      if (filters.approvalStatus === 'approved') {
        where.isApproved = true;
      } else if (filters.approvalStatus === 'rejected') {
        where.isApproved = false;
      } else if (filters.approvalStatus === 'pending') {
        where.isApproved = null;
      }
    }

    return where;
  }

  buildDutySessionWhereClause(filters) {
    const where = {};

    if (filters.dateFrom && filters.dateTo) {
      where.startTime = { [Op.between]: [filters.dateFrom + ' 00:00:00', filters.dateTo + ' 23:59:59'] };
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.eventId) {
      where.eventId = filters.eventId;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return where;
  }

  buildStrikeWhereClause(filters) {
    const where = {};

    if (filters.dateFrom && filters.dateTo) {
      where.date = { [Op.between]: [filters.dateFrom, filters.dateTo] };
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.reason && Array.isArray(filters.reason)) {
      where.reason = { [Op.in]: filters.reason };
    } else if (filters.reason) {
      where.reason = filters.reason;
    }

    if (filters.severity && Array.isArray(filters.severity)) {
      where.severity = { [Op.in]: filters.severity };
    } else if (filters.severity) {
      where.severity = filters.severity;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return where;
  }

  // Helper methods for formatting data
  formatAttendanceData(records) {
    return records.map(record => ({
      id: record.id,
      date: record.date,
      status: record.status,
      isApproved: record.isApproved,
      dutyEligible: record.dutyEligible,
      approvedAt: record.approvedAt,
      notes: record.notes,
      student: {
        id: record.User?.id,
        name: `${record.User?.firstName} ${record.User?.lastName}`,
        email: record.User?.email,
        studentId: record.User?.studentId
      },
      approver: record.approver ? `${record.approver.firstName} ${record.approver.lastName}` : null
    }));
  }

  formatDutyData(sessions) {
    return sessions.map(session => ({
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      totalDurationMinutes: session.totalDurationMinutes,
      breakDuration: session.breakDuration,
      isActive: session.isActive,
      notes: session.notes,
      student: {
        id: session.User?.id,
        name: `${session.User?.firstName} ${session.User?.lastName}`,
        email: session.User?.email,
        studentId: session.User?.studentId
      },
      event: session.Event ? {
        id: session.Event.id,
        name: session.Event.name,
        date: session.Event.date
      } : null,
      hourlyLogs: session.HourlyLogs?.map(log => ({
        id: log.id,
        startTime: log.startTime,
        endTime: log.endTime,
        duration: log.duration,
        notes: log.notes
      })) || []
    }));
  }

  formatStrikeData(strikes) {
    return strikes.map(strike => ({
      id: strike.id,
      reason: strike.reason,
      description: strike.description,
      date: strike.date,
      isActive: strike.isActive,
      strikeCountAtTime: strike.strikeCountAtTime,
      severity: strike.severity,
      resolutionNotes: strike.resolutionNotes,
      resolvedAt: strike.resolvedAt,
      student: {
        id: strike.user?.id,
        name: `${strike.user?.firstName} ${strike.user?.lastName}`,
        email: strike.user?.email,
        studentId: strike.user?.studentId
      },
      resolver: strike.resolver ? `${strike.resolver.firstName} ${strike.resolver.lastName}` : null
    }));
  }

  // Helper methods for calculating statistics
  calculateAttendanceStatistics(records) {
    const total = records.length;
    const approved = records.filter(r => r.isApproved === true).length;
    const rejected = records.filter(r => r.isApproved === false).length;
    const pending = records.filter(r => r.isApproved === null).length;

    const statusCounts = {
      present_in_class: records.filter(r => r.status === 'present_in_class').length,
      on_club_duty: records.filter(r => r.status === 'on_club_duty').length,
      absent: records.filter(r => r.status === 'absent').length
    };

    const dutyEligible = records.filter(r => r.dutyEligible === true).length;

    return {
      total,
      approved,
      rejected,
      pending,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
      statusCounts,
      dutyEligible
    };
  }

  calculateDutyStatistics(sessions) {
    const total = sessions.length;
    const active = sessions.filter(s => s.isActive).length;
    const completed = sessions.filter(s => !s.isActive && s.endTime).length;

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.totalDurationMinutes || 0), 0);
    const averageMinutes = total > 0 ? Math.round(totalMinutes / total) : 0;

    const breakMinutes = sessions.reduce((sum, s) => sum + (s.breakDuration || 0), 0);
    const averageBreakMinutes = total > 0 ? Math.round(breakMinutes / total) : 0;

    return {
      total,
      active,
      completed,
      totalHours: Math.round(totalMinutes / 60 * 100) / 100,
      averageHours: Math.round(averageMinutes / 60 * 100) / 100,
      totalBreakHours: Math.round(breakMinutes / 60 * 100) / 100,
      averageBreakHours: Math.round(averageBreakMinutes / 60 * 100) / 100
    };
  }

  calculateStrikeStatistics(strikes) {
    const total = strikes.length;
    const active = strikes.filter(s => s.isActive).length;
    const resolved = strikes.filter(s => !s.isActive).length;

    const reasonCounts = {};
    strikes.forEach(strike => {
      reasonCounts[strike.reason] = (reasonCounts[strike.reason] || 0) + 1;
    });

    const severityCounts = {
      warning: strikes.filter(s => s.severity === 'warning').length,
      minor: strikes.filter(s => s.severity === 'minor').length,
      major: strikes.filter(s => s.severity === 'major').length
    };

    return {
      total,
      active,
      resolved,
      reasonCounts,
      severityCounts
    };
  }
}

module.exports = new ReportService();