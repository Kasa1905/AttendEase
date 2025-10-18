// Teacher dashboard utility functions

export const formatDate = (dateString, options = {}) => {
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
};

export const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'present_in_class': return 'bg-green-100 text-green-800';
    case 'on_club_duty': return 'bg-blue-100 text-blue-800';
    case 'absent': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getApprovalColor = (isApproved) => {
  if (isApproved === true) return 'bg-green-100 text-green-800';
  if (isApproved === false) return 'bg-red-100 text-red-800';
  return 'bg-yellow-100 text-yellow-800';
};

export const getStatusBadgeText = (status) => {
  switch (status) {
    case 'present_in_class': return 'Present';
    case 'on_club_duty': return 'On Duty';
    case 'absent': return 'Absent';
    default: return status;
  }
};

export const getApprovalBadgeText = (isApproved) => {
  if (isApproved === true) return 'Approved';
  if (isApproved === false) return 'Rejected';
  return 'Pending';
};

export const calculateAttendanceStats = (records) => {
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
};

export const groupRecordsByDate = (records) => {
  const grouped = {};

  records.forEach(record => {
    const date = new Date(record.createdAt).toISOString().slice(0, 10);
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(record);
  });

  return grouped;
};

export const groupRecordsByStudent = (records) => {
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
};

export const validateDateRange = (dateFrom, dateTo) => {
  if (!dateFrom || !dateTo) return true;

  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  return from <= to;
};

export const generateDateRange = (startDate, endDate) => {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    dates.push(new Date(date).toISOString().slice(0, 10));
  }

  return dates;
};

export const exportToCSV = (data, filename) => {
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
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const sortRecords = (records, sortBy, sortOrder = 'desc') => {
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
};

export const filterRecords = (records, filters) => {
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
};