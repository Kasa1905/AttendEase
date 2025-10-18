export function formatDate(d){ try { return new Date(d).toLocaleString(); } catch(e){ return d; } }
export const ROLE_NAMES = { student: 'Student', core_team: 'Core Team', teacher: 'Teacher' };

export function getTodayDateString() { return new Date().toISOString().slice(0,10); }
export function isToday(dateString) { return dateString === getTodayDateString(); }
export function getAttendanceStatusColor(status) {
	if (status === 'on_club_duty') return 'text-yellow-600';
	if (status === 'present_in_class') return 'text-green-600';
	return 'text-gray-600';
}
export function getSessionStatusText(session) {
	if (!session) return 'No session';
	if (!session.endedAt && (session.startTime || session.startedAt)) return 'Active';
	return 'Ended';
}
export function formatWorkDescription(text, maxLength = 200) { if (!text) return ''; return text.length > maxLength ? text.slice(0,maxLength)+'...' : text; }
export function validateHourlyLogTiming(sessionStart, lastLog) {
	if (!sessionStart) return false;
	const expected = lastLog ? new Date(new Date(lastLog).getTime() + 60*60*1000) : new Date(new Date(sessionStart).getTime() + 60*60*1000);
	const now = new Date();
	const low = new Date(expected.getTime() - 15*60000);
	const high = new Date(expected.getTime() + 15*60000);
	return now >= low && now <= high;
}
export function generateLogReminder(nextDueTime) { if (!nextDueTime) return ''; return `Next log due at ${new Date(nextDueTime).toLocaleTimeString()}`; }
export function calculateAttendanceEligibility(session, logs=[]) { const total = session && (session.totalDurationMinutes || null); return { meets: total && total >= 120, total }; }

// Small toast helper (no dependency). type: 'info' | 'success' | 'error' | 'warn'
export function showToast(message, type = 'info', timeout = 4000) {
	try {
		const id = 'app-toast-root';
		let root = document.getElementById(id);
		if (!root) { root = document.createElement('div'); root.id = id; root.style.position = 'fixed'; root.style.right = '16px'; root.style.top = '16px'; root.style.zIndex = '9999'; document.body.appendChild(root); }
		const el = document.createElement('div');
		el.textContent = message;
		el.style.marginTop = '8px';
		el.style.padding = '10px 14px';
		el.style.borderRadius = '6px';
		el.style.color = '#fff';
		el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
		if (type === 'success') el.style.background = '#16a34a';
		else if (type === 'error') el.style.background = '#dc2626';
		else if (type === 'warn') el.style.background = '#f59e0b';
		else el.style.background = '#2563eb';
		root.appendChild(el);
		setTimeout(() => { try { root.removeChild(el); } catch(e) {} }, timeout);
	} catch (e) { /* ignore DOM errors */ }
}

export function getRequestStatusColor(status) {
	if (status === 'pending') return 'text-yellow-600';
	if (status === 'approved') return 'text-green-600';
	if (status === 'rejected') return 'text-red-600';
	return 'text-gray-600';
}

export function formatRequestType(type) { if (type === 'leave') return 'Leave'; if (type === 'club_duty') return 'Club Duty'; return type; }

export function isBeforeDeadline(submittedAt, requestDate) {
	const sub = new Date(submittedAt);
	const req = new Date(requestDate);
	const nine = new Date(req.getFullYear(), req.getMonth(), req.getDate(), 9, 0, 0);
	return sub.getTime() <= nine.getTime();
}

export function getDeadlineStatus(requestDate) {
	const req = new Date(requestDate);
	const nine = new Date(req.getFullYear(), req.getMonth(), req.getDate(), 9, 0, 0);
	const ms = nine.getTime() - Date.now();
	if (ms <= 0) return { status: 'passed', message: 'Deadline passed' };
	return { status: 'open', message: `${Math.ceil(ms/60000)} min until 9:00 AM` };
}

export function formatRequestReason(reason, maxLength=150) { if (!reason) return ''; return reason.length > maxLength ? reason.slice(0,maxLength)+'...' : reason; }

export function calculateDaysUntilRequest(requestDate) { const now = new Date(); const d = new Date(requestDate); const diff = Math.ceil((d.setHours(0,0,0,0) - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime())/86400000); return diff; }

export function getUrgencyLevel(requestDate, submittedAt) { const days = calculateDaysUntilRequest(requestDate); if (days <= 0) return 'high'; if (days <= 3) return 'medium'; return 'low'; }

export function formatApprovalTime(approvedAt, submittedAt) { if (!approvedAt || !submittedAt) return null; const mins = Math.round((new Date(approvedAt)-new Date(submittedAt))/60000); return `${mins} min`; }

// Strike-related helper functions
export function getStrikeSeverity(count) {
  if (count >= 5) return { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Critical', icon: '🚨' };
  if (count >= 3) return { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Warning', icon: '⚠️' };
  return { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Minor', icon: 'ℹ️' };
}

export function getStrikeStatusColor(status) {
  if (status === 'active') return 'text-red-600';
  if (status === 'resolved') return 'text-green-600';
  return 'text-gray-600';
}

export function formatStrikeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

  if (diffInHours < 24) {
    return diffInHours === 0 ? 'Just now' : `${diffInHours}h ago`;
  } else if (diffInHours < 24 * 7) {
    return `${Math.floor(diffInHours / 24)}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

export function getSuspensionStatus(strikesCount) {
  if (strikesCount >= 5) return { suspended: true, message: 'Account suspended due to excessive strikes' };
  if (strikesCount >= 3) return { suspended: false, message: 'Warning: Close to suspension threshold' };
  return { suspended: false, message: null };
}

export function calculateStrikeProgress(currentStrikes, maxStrikes = 5) {
  const percentage = (currentStrikes / maxStrikes) * 100;
  let color = 'bg-green-500';
  if (currentStrikes >= 3) color = 'bg-orange-500';
  if (currentStrikes >= 5) color = 'bg-red-500';

  return { percentage: Math.min(percentage, 100), color };
}

// Additional strike utility functions
export function getStrikeReasonColor(reason) {
  const colors = {
    missed_hourly_log: 'bg-yellow-100 text-yellow-800',
    insufficient_duty_hours: 'bg-orange-100 text-orange-800',
    excessive_break: 'bg-red-100 text-red-800'
  };
  return colors[reason] || 'bg-gray-100 text-gray-800';
}

export function getStrikeSeverityColor(severity) {
  const colors = {
    minor: 'bg-yellow-100 text-yellow-800',
    warning: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  };
  return colors[severity] || 'bg-gray-100 text-gray-800';
}

export function formatStrikeReason(reason) {
  const labels = {
    missed_hourly_log: 'Missed Hourly Log',
    insufficient_duty_hours: 'Insufficient Duty Hours',
    excessive_break: 'Excessive Break'
  };
  return labels[reason] || reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function calculateStrikeRisk(strikes) {
  const activeStrikes = strikes.filter(s => s.status === 'active').length;
  if (activeStrikes >= 5) return 'suspended';
  if (activeStrikes >= 3) return 'high';
  if (activeStrikes >= 1) return 'medium';
  return 'low';
}

export function getEscalationWarning(strikesCount) {
  if (strikesCount >= 5) return 'Account will be suspended';
  if (strikesCount >= 3) return 'Email warning sent';
  return null;
}

export function groupStrikesByMonth(strikes) {
  return strikes.reduce((groups, strike) => {
    const date = new Date(strike.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(strike);
    return groups;
  }, {});
}

export function calculateStrikeStatistics(strikes) {
  const total = strikes.length;
  const active = strikes.filter(s => s.status === 'active').length;
  const resolved = strikes.filter(s => s.status === 'resolved').length;

  const byReason = strikes.reduce((acc, strike) => {
    acc[strike.reason] = (acc[strike.reason] || 0) + 1;
    return acc;
  }, {});

  return {
    totalStrikes: total,
    activeStrikes: active,
    resolvedStrikes: resolved,
    strikesByReason: byReason
  };
}

export function isStrikeResolvable(strike, userRole) {
  if (!strike || strike.status !== 'active') return false;
  return ['core_team', 'teacher'].includes(userRole);
}

// Teacher-specific utility functions

export function getTeacherAttendanceStatusColor(status) {
  switch (status) {
    case 'present_in_class': return 'bg-green-100 text-green-800';
    case 'on_club_duty': return 'bg-blue-100 text-blue-800';
    case 'absent': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function getTeacherApprovalStatusColor(isApproved) {
  if (isApproved === true) return 'bg-green-100 text-green-800';
  if (isApproved === false) return 'bg-red-100 text-red-800';
  return 'bg-yellow-100 text-yellow-800';
}

export function formatTeacherDuration(minutes) {
  if (!minutes || minutes === 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatTeacherDate(dateString, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };

  return new Date(dateString).toLocaleDateString('en-US', {
    ...defaultOptions,
    ...options
  });
}

export function getTeacherStatusBadgeText(status) {
  switch (status) {
    case 'present_in_class': return 'Present';
    case 'on_club_duty': return 'On Duty';
    case 'absent': return 'Absent';
    default: return status;
  }
}

export function getTeacherApprovalBadgeText(isApproved) {
  if (isApproved === true) return 'Approved';
  if (isApproved === false) return 'Rejected';
  return 'Pending';
}

export function calculateTeacherAttendanceStats(records) {
  const stats = {
    total: records.length,
    approved: 0,
    rejected: 0,
    pending: 0,
    present: 0,
    onDuty: 0,
    absent: 0
  };

  records.forEach(record => {
    // Approval stats
    if (record.isApproved === true) stats.approved++;
    else if (record.isApproved === false) stats.rejected++;
    else stats.pending++;

    // Status stats
    switch (record.status) {
      case 'present_in_class':
        stats.present++;
        break;
      case 'on_club_duty':
        stats.onDuty++;
        break;
      case 'absent':
        stats.absent++;
        break;
    }
  });

  return stats;
}

export function validateTeacherDateRange(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return true;

  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  return from <= to;
}

export function generateTeacherDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    dates.push(new Date(date).toISOString().slice(0, 10));
  }

  return dates;
}

export function sortTeacherRecords(records, sortBy, sortOrder = 'desc') {
  return [...records].sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case 'firstName':
        aValue = `${a.User?.firstName} ${a.User?.lastName}`.toLowerCase();
        bValue = `${b.User?.firstName} ${b.User?.lastName}`.toLowerCase();
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'updatedAt':
        aValue = new Date(a.updatedAt);
        bValue = new Date(b.updatedAt);
        break;
      case 'createdAt':
      default:
        aValue = new Date(a.createdAt);
        bValue = new Date(b.createdAt);
        break;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
}

export function filterTeacherRecords(records, filters) {
  return records.filter(record => {
    // Student name filter
    if (filters.studentName) {
      const fullName = `${record.User?.firstName} ${record.User?.lastName}`.toLowerCase();
      if (!fullName.includes(filters.studentName.toLowerCase())) return false;
    }

    // Status filter
    if (filters.status && record.status !== filters.status) return false;

    // Approval status filter
    if (filters.approvalStatus) {
      const approvalValue = filters.approvalStatus === 'approved' ? true :
                           filters.approvalStatus === 'rejected' ? false : null;
      if (record.isApproved !== approvalValue) return false;
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      if (new Date(record.createdAt) < fromDate) return false;
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (new Date(record.createdAt) > toDate) return false;
    }

    // Duty duration filter
    if (filters.minDutyDuration) {
      const minMinutes = parseInt(filters.minDutyDuration) * 60;
      if (!record.DutySession?.totalDurationMinutes || record.DutySession.totalDurationMinutes < minMinutes) {
        return false;
      }
    }

    return true;
  });
}

export function groupTeacherRecordsByDate(records) {
  const grouped = {};

  records.forEach(record => {
    const date = new Date(record.createdAt).toISOString().slice(0, 10);
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(record);
  });

  return grouped;
}

export function groupTeacherRecordsByStudent(records) {
  const grouped = {};

  records.forEach(record => {
    const studentId = record.userId;
    const studentName = `${record.User?.firstName} ${record.User?.lastName}`;

    if (!grouped[studentId]) {
      grouped[studentId] = {
        studentId,
        studentName,
        records: []
      };
    }
    grouped[studentId].records.push(record);
  });

  return Object.values(grouped);
}

export function exportTeacherDataToCSV(data, filename) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function debounceTeacher(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Report-specific utility functions
export function formatReportDate(date) {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return date;
  }
}

export function formatReportDateTime(date) {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return date;
  }
}

export function getReportStatusBadge(status, type = 'attendance') {
  const statusConfig = {
    attendance: {
      present: { color: 'bg-green-100 text-green-800', label: 'Present' },
      absent: { color: 'bg-red-100 text-red-800', label: 'Absent' },
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' }
    },
    approval: {
      approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' }
    },
    penalty: {
      active: { color: 'bg-red-100 text-red-800', label: 'Active' },
      resolved: { color: 'bg-green-100 text-green-800', label: 'Resolved' }
    },
    duty: {
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      completed: { color: 'bg-gray-100 text-gray-800', label: 'Completed' }
    }
  };

  const config = statusConfig[type]?.[status] || { color: 'bg-gray-100 text-gray-800', label: status };
  return { ...config, status };
}

export function calculateReportPercentage(value, total) {
  if (!total || total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function formatReportDuration(minutes) {
  if (!minutes) return '0h 0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function getReportExportFilename(reportType, format, customDate = null) {
  const date = customDate || new Date().toISOString().slice(0, 10);
  const extension = format === 'excel' ? 'xlsx' : format;
  return `club-${reportType}-report-${date}.${extension}`;
}

export function validateReportDateRange(startDate, endDate) {
  if (!startDate || !endDate) return { valid: false, error: 'Both start and end dates are required' };

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  if (start > end) {
    return { valid: false, error: 'Start date cannot be after end date' };
  }

  const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year
  if (end - start > maxRange) {
    return { valid: false, error: 'Date range cannot exceed 1 year' };
  }

  return { valid: true };
}

export function getReportTypeDisplayName(reportType) {
  const names = {
    attendance: 'Attendance Summary',
    duty: 'Duty Session Report',
    penalty: 'Penalty Report',
    member: 'Member Activity',
    daily: 'Daily Summary'
  };
  return names[reportType] || reportType;
}

export function getReportTypeDescription(reportType) {
  const descriptions = {
    attendance: 'Comprehensive attendance records with approval status and statistics',
    duty: 'Detailed duty session logs with hourly breakdowns and duration analysis',
    penalty: 'Strike and penalty records with resolution tracking',
    member: 'Comprehensive member engagement and activity analysis',
    daily: 'Teacher-specific daily attendance and duty session summaries'
  };
  return descriptions[reportType] || '';
}

export function formatReportNumber(value, decimals = 0) {
  if (value === null || value === undefined) return '0';

  if (typeof value === 'number') {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  return value.toString();
}

export function getReportTrendIndicator(current, previous) {
  if (!previous || previous === 0) return { direction: 'neutral', percentage: 0 };

  const change = ((current - previous) / previous) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';

  return {
    direction,
    percentage: Math.abs(Math.round(change)),
    value: change
  };
}

export function generateReportSummary(data, reportType) {
  if (!data || !Array.isArray(data)) {
    return { totalRecords: 0, summary: {} };
  }

  const summary = {
    totalRecords: data.length
  };

  switch (reportType) {
    case 'attendance':
      const present = data.filter(item => item.status === 'present').length;
      const absent = data.filter(item => item.status === 'absent').length;
      const approved = data.filter(item => item.approvalStatus === 'approved').length;

      summary.present = present;
      summary.absent = absent;
      summary.approved = approved;
      summary.approvalRate = calculateReportPercentage(approved, data.length);
      break;

    case 'duty':
      const active = data.filter(item => item.isActive).length;
      const totalHours = data.reduce((sum, item) => sum + (item.duration || 0), 0);

      summary.active = active;
      summary.completed = data.length - active;
      summary.totalHours = totalHours;
      summary.averageHours = totalHours / data.length;
      break;

    case 'penalty':
      const activePenalties = data.filter(item => item.isActive).length;

      summary.active = activePenalties;
      summary.resolved = data.length - activePenalties;
      break;

    default:
      break;
  }

  return summary;
}

// Import-specific helper functions

/**
 * Get color class for import status
 * @param {string} status - Import status
 * @returns {string} - Tailwind CSS color class
 */
export function getImportStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'success':
      return 'text-green-600 bg-green-100';
    case 'failed':
    case 'error':
      return 'text-red-600 bg-red-100';
    case 'processing':
    case 'in_progress':
      return 'text-blue-600 bg-blue-100';
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * Format import date for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatImportDate(date) {
  if (!date) return 'N/A';

  try {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now - d);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return d.toLocaleDateString();
    }
  } catch (e) {
    return 'Invalid date';
  }
}

/**
 * Get status badge text for import operations
 * @param {string} status - Import status
 * @returns {string} - Display text
 */
export function getImportStatusText(status) {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'processing':
      return 'Processing';
    case 'pending':
      return 'Pending';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

/**
 * Calculate import progress percentage
 * @param {number} processed - Number of processed items
 * @param {number} total - Total number of items
 * @returns {number} - Progress percentage (0-100)
 */
export function calculateImportProgress(processed, total) {
  if (!total || total === 0) return 0;
  return Math.min(Math.round((processed / total) * 100), 100);
}

/**
 * Format import duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
export function formatImportDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Get file type display name
 * @param {string} filename - File name
 * @returns {string} - Display name
 */
export function getFileTypeDisplayName(filename) {
  if (!filename) return 'Unknown';

  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'csv':
      return 'CSV File';
    case 'xlsx':
    case 'xls':
      return 'Excel File';
    default:
      return 'File';
  }
}

/**
 * Format import summary for notifications
 * @param {Object} summary - Import summary object
 * @returns {string} - Formatted summary text
 */
export function formatImportSummaryText(summary) {
  if (!summary) return 'Import completed';

  const { totalProcessed = 0, successful = 0, failed = 0 } = summary;

  if (failed === 0) {
    return `Successfully imported ${successful} members`;
  } else if (successful === 0) {
    return `Import failed for ${failed} members`;
  } else {
    return `Imported ${successful} of ${totalProcessed} members (${failed} failed)`;
  }
}

/**
 * Check if import can be retried
 * @param {string} status - Current import status
 * @returns {boolean} - Whether retry is allowed
 */
export function canRetryImport(status) {
  const retryableStatuses = ['failed', 'error', 'cancelled'];
  return retryableStatuses.includes(status?.toLowerCase());
}

/**
 * Get import error severity level
 * @param {Array} errors - Array of error messages
 * @returns {string} - Severity level ('low', 'medium', 'high')
 */
export function getImportErrorSeverity(errors) {
  if (!errors || errors.length === 0) return 'none';

  const criticalErrors = errors.filter(error =>
    error.toLowerCase().includes('duplicate') ||
    error.toLowerCase().includes('invalid email') ||
    error.toLowerCase().includes('missing required')
  );

  if (criticalErrors.length > errors.length * 0.5) {
    return 'high';
  } else if (criticalErrors.length > 0) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Format validation error messages
 * @param {Array} errors - Array of error strings
 * @returns {string} - Formatted error message
 */
export function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) return '';

  if (errors.length === 1) return errors[0];

  return `${errors[0]} (+${errors.length - 1} more)`;
}

/**
 * Get color class for error severity
 * @param {string} severity - Error severity level
 * @returns {string} - Tailwind CSS color class
 */
export function getErrorSeverityColor(severity) {
  switch (severity) {
    case 'high':
      return 'text-red-600';
    case 'medium':
      return 'text-yellow-600';
    case 'low':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Check if file is valid for import
 * @param {File} file - File object
 * @returns {Object} - Validation result
 */
export function validateImportFile(file) {
  const allowedTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  const allowedExtensions = ['.csv', '.xlsx'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: 'Invalid file type. Please select a CSV or Excel file.'
      };
    }
  }

  // Check file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size exceeds ${(maxSize / (1024 * 1024)).toFixed(1)}MB limit.`
    };
  }

  return { isValid: true, error: null };
}

/**
 * Generate import batch ID
 * @returns {string} - Unique batch ID
 */
export function generateImportBatchId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `import_${timestamp}_${random}`;
}

/**
 * Format import progress for display
 * @param {Object} progress - Progress object
 * @returns {string} - Formatted progress text
 */
export function formatImportProgressText(progress) {
  if (!progress) return 'Initializing...';

  const { processed = 0, total = 0, percentage = 0 } = progress;

  if (percentage === 100) {
    return 'Import completed successfully!';
  }

  if (total > 0) {
    return `Processing ${processed} of ${total} members (${percentage}%)`;
  }

  return 'Processing...';
}

/**
 * Get import operation status icon
 * @param {string} status - Import status
 * @returns {string} - Emoji icon
 */
export function getImportStatusIcon(status) {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'success':
      return '✅';
    case 'failed':
    case 'error':
      return '❌';
    case 'processing':
    case 'in_progress':
      return '⏳';
    case 'pending':
      return '⏸️';
    case 'cancelled':
      return '🚫';
    default:
      return '❓';
  }
}

// Offline-specific helper functions

/**
 * Get color class for online/offline status indicators
 * @param {boolean} isOnline - Whether the app is online
 * @returns {string} - Tailwind CSS color class
 */
export function getOfflineStatusColor(isOnline) {
  return isOnline ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
}

/**
 * Format sync status for user-friendly display
 * @param {string} status - Sync status ('idle', 'syncing', 'completed', 'error')
 * @returns {string} - Formatted status text
 */
export function formatSyncStatus(status) {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'syncing':
      return 'Synchronizing...';
    case 'completed':
      return 'All synced';
    case 'error':
      return 'Sync failed';
    default:
      return 'Unknown';
  }
}

/**
 * Generate human-readable data freshness text
 * @param {number} timestamp - Data timestamp
 * @returns {string} - Freshness text (e.g., '2 minutes ago', 'Last synced 1 hour ago')
 */
export function getDataFreshnessText(timestamp) {
  if (!timestamp) return 'Never';

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format pending action count for display
 * @param {number} count - Number of pending actions
 * @returns {string} - Formatted count text
 */
export function formatOfflineQueueCount(count) {
  if (count === 0) return 'No pending actions';
  if (count === 1) return '1 pending action';
  return `${count} pending actions`;
}

/**
 * Generate descriptive sync progress text with operation details
 * @param {Object} progress - Progress object with operation details
 * @returns {string} - Descriptive progress text
 */
export function getSyncProgressText(progress) {
  if (!progress) return 'Preparing sync...';

  const { operation, processed = 0, total = 0, percentage = 0 } = progress;

  if (percentage === 100) return 'Sync completed successfully!';

  const operationText = operation ? `${operation.replace('_', ' ')}: ` : '';
  return `${operationText}${processed}/${total} (${percentage}%)`;
}

/**
 * Validate offline data timestamps for integrity
 * @param {number} timestamp - Timestamp to validate
 * @returns {boolean} - Whether timestamp is valid
 */
export function validateOfflineTimestamp(timestamp) {
  if (!timestamp || typeof timestamp !== 'number') return false;

  const now = Date.now();
  const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
  const oneHourFromNow = now + (60 * 60 * 1000);

  // Timestamp should be within reasonable bounds
  return timestamp > oneYearAgo && timestamp < oneHourFromNow;
}

/**
 * Format storage usage for display with percentages and units
 * @param {number} used - Used storage in bytes
 * @param {number} total - Total storage in bytes
 * @returns {string} - Formatted storage usage text
 */
export function formatStorageUsage(used, total) {
  const usedMB = (used / (1024 * 1024)).toFixed(1);
  const totalMB = (total / (1024 * 1024)).toFixed(1);
  const percentage = Math.round((used / total) * 100);

  return `${usedMB}MB / ${totalMB}MB (${percentage}%)`;
}

/**
 * Generate user-friendly conflict resolution descriptions
 * @param {Object} conflict - Conflict object with local and server data
 * @returns {string} - Conflict description
 */
export function getConflictResolutionText(conflict) {
  if (!conflict) return 'No conflicts detected';

  const { type, localValue, serverValue } = conflict;

  switch (type) {
    case 'timestamp':
      return `Data modified ${getDataFreshnessText(localValue)} locally vs ${getDataFreshnessText(serverValue)} on server`;
    case 'value':
      return `Local value: ${localValue}, Server value: ${serverValue}`;
    default:
      return 'Data conflict detected';
  }
}

/**
 * Format offline-specific errors for user display
 * @param {Object} error - Error object
 * @returns {string} - User-friendly error message
 */
export function formatOfflineError(error) {
  if (!error) return 'Unknown error occurred';

  const { type, message, code } = error;

  switch (type) {
    case 'network':
      return 'Network connection lost. Data will sync when connection is restored.';
    case 'storage':
      return 'Storage quota exceeded. Please clear some data or free up space.';
    case 'sync':
      return `Sync failed: ${message || 'Please try again later.'}`;
    case 'validation':
      return `Data validation error: ${message || 'Please check your input.'}`;
    default:
      return message || 'An offline operation failed. Please try again.';
  }
}

/**
 * Calculate duration for offline sessions
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp (optional, defaults to now)
 * @returns {string} - Formatted duration
 */
export function calculateOfflineDuration(startTime, endTime = Date.now()) {
  if (!startTime) return '0m';

  const duration = endTime - startTime;
  const minutes = Math.floor(duration / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}
