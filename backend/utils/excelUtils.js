const XLSX = require('xlsx');
const moment = require('moment');

/**
 * Generate attendance summary Excel file
 * @param {Object} reportData - Report data from service
 * @param {Object} filters - Applied filters
 * @returns {Buffer} Excel buffer
 */
async function generateAttendanceExcel(reportData, filters) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Club Attendance Manager - Attendance Summary Report'],
    ['Generated', moment().format('YYYY-MM-DD HH:mm:ss')],
    ['Date Range', getDateRangeText(filters)],
    [''],
    ['Summary Statistics'],
    ['Total Records', reportData.statistics.total],
    ['Approved', reportData.statistics.approved],
    ['Rejected', reportData.statistics.rejected],
    ['Pending', reportData.statistics.pending],
    ['Approval Rate', `${reportData.statistics.approvalRate}%`],
    ['Duty Eligible', reportData.statistics.dutyEligible],
    [''],
    ['Status Breakdown'],
    ['Present in Class', reportData.statistics.statusCounts.present_in_class],
    ['On Club Duty', reportData.statistics.statusCounts.on_club_duty],
    ['Absent', reportData.statistics.statusCounts.absent]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Detailed records sheet
  const recordsData = [
    ['Date', 'Student Name', 'Student ID', 'Email', 'Status', 'Approval Status', 'Approved At', 'Approver', 'Notes']
  ];

  reportData.data.forEach(record => {
    recordsData.push([
      record.date,
      record.student.name,
      record.student.studentId || 'N/A',
      record.student.email,
      record.status.replace('_', ' '),
      record.isApproved === true ? 'Approved' : record.isApproved === false ? 'Rejected' : 'Pending',
      record.approvedAt ? moment(record.approvedAt).format('YYYY-MM-DD HH:mm') : 'N/A',
      record.approver || 'N/A',
      record.notes || ''
    ]);
  });

  const recordsSheet = XLSX.utils.aoa_to_sheet(recordsData);
  XLSX.utils.book_append_sheet(workbook, recordsSheet, 'Attendance Records');

  // Style the sheets
  styleExcelWorksheet(recordsSheet, { headerRows: 1 });

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate duty session Excel file
 * @param {Object} reportData - Report data from service
 * @param {Object} filters - Applied filters
 * @returns {Buffer} Excel buffer
 */
async function generateDutyLogExcel(reportData, filters) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Club Attendance Manager - Duty Session Report'],
    ['Generated', moment().format('YYYY-MM-DD HH:mm:ss')],
    ['Date Range', getDateRangeText(filters)],
    [''],
    ['Summary Statistics'],
    ['Total Sessions', reportData.statistics.total],
    ['Active Sessions', reportData.statistics.active],
    ['Completed Sessions', reportData.statistics.completed],
    ['Total Hours', reportData.statistics.totalHours],
    ['Average Hours per Session', reportData.statistics.averageHours],
    ['Total Break Hours', reportData.statistics.totalBreakHours],
    ['Average Break Hours', reportData.statistics.averageBreakHours]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Sessions sheet
  const sessionsData = [
    ['Start Time', 'End Time', 'Student Name', 'Student ID', 'Email', 'Duration (minutes)', 'Break (minutes)', 'Status', 'Event', 'Notes']
  ];

  reportData.data.forEach(session => {
    sessionsData.push([
      moment(session.startTime).format('YYYY-MM-DD HH:mm'),
      session.endTime ? moment(session.endTime).format('YYYY-MM-DD HH:mm') : 'Ongoing',
      session.student.name,
      session.student.studentId || 'N/A',
      session.student.email,
      session.totalDurationMinutes || 0,
      session.breakDuration || 0,
      session.isActive ? 'Active' : 'Completed',
      session.event ? session.event.name : 'N/A',
      session.notes || ''
    ]);
  });

  const sessionsSheet = XLSX.utils.aoa_to_sheet(sessionsData);
  XLSX.utils.book_append_sheet(workbook, sessionsSheet, 'Duty Sessions');

  // Hourly logs sheet (if available)
  const hourlyLogsData = [['Session Start', 'Student', 'Log Time', 'Duration', 'Notes']];

  reportData.data.forEach(session => {
    if (session.hourlyLogs && session.hourlyLogs.length > 0) {
      session.hourlyLogs.forEach(log => {
        hourlyLogsData.push([
          moment(session.startTime).format('YYYY-MM-DD HH:mm'),
          session.student.name,
          moment(log.startTime).format('YYYY-MM-DD HH:mm'),
          log.duration || 0,
          log.notes || ''
        ]);
      });
    }
  });

  if (hourlyLogsData.length > 1) {
    const hourlyLogsSheet = XLSX.utils.aoa_to_sheet(hourlyLogsData);
    XLSX.utils.book_append_sheet(workbook, hourlyLogsSheet, 'Hourly Logs');
    styleExcelWorksheet(hourlyLogsSheet, { headerRows: 1 });
  }

  // Style the sheets
  styleExcelWorksheet(sessionsSheet, { headerRows: 1 });

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate penalty report Excel file
 * @param {Object} reportData - Report data from service
 * @param {Object} filters - Applied filters
 * @returns {Buffer} Excel buffer
 */
async function generatePenaltyExcel(reportData, filters) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Club Attendance Manager - Penalty Report'],
    ['Generated', moment().format('YYYY-MM-DD HH:mm:ss')],
    ['Date Range', getDateRangeText(filters)],
    [''],
    ['Summary Statistics'],
    ['Total Strikes', reportData.statistics.total],
    ['Active Strikes', reportData.statistics.active],
    ['Resolved Strikes', reportData.statistics.resolved],
    [''],
    ['Reason Breakdown']
  ];

  // Add reason counts
  Object.entries(reportData.statistics.reasonCounts).forEach(([reason, count]) => {
    summaryData.push([reason.replace('_', ' '), count]);
  });

  summaryData.push([''], ['Severity Breakdown']);
  Object.entries(reportData.statistics.severityCounts).forEach(([severity, count]) => {
    summaryData.push([severity, count]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Strikes sheet
  const strikesData = [
    ['Date', 'Student Name', 'Student ID', 'Email', 'Reason', 'Description', 'Severity', 'Strike Count', 'Status', 'Resolved At', 'Resolver', 'Resolution Notes']
  ];

  reportData.data.forEach(strike => {
    strikesData.push([
      strike.date,
      strike.student.name,
      strike.student.studentId || 'N/A',
      strike.student.email,
      strike.reason.replace('_', ' '),
      strike.description || '',
      strike.severity,
      strike.strikeCountAtTime,
      strike.isActive ? 'Active' : 'Resolved',
      strike.resolvedAt ? moment(strike.resolvedAt).format('YYYY-MM-DD HH:mm') : 'N/A',
      strike.resolver ? `${strike.resolver.firstName} ${strike.resolver.lastName}` : 'N/A',
      strike.resolutionNotes || ''
    ]);
  });

  const strikesSheet = XLSX.utils.aoa_to_sheet(strikesData);
  XLSX.utils.book_append_sheet(workbook, strikesSheet, 'Strikes');

  // Style the sheets
  styleExcelWorksheet(strikesSheet, { headerRows: 1 });

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate daily summary Excel file
 * @param {Object} reportData - Report data from service
 * @param {Object} filters - Applied filters
 * @returns {Buffer} Excel buffer
 */
async function generateDailySummaryExcel(reportData, filters) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Club Attendance Manager - Daily Summary'],
    ['Date', moment(reportData.date).format('YYYY-MM-DD')],
    ['Generated', moment().format('YYYY-MM-DD HH:mm:ss')],
    [''],
    ['Daily Statistics'],
    ['Total Attendance Records', reportData.statistics.totalAttendance],
    ['Present in Class', reportData.statistics.presentCount],
    ['On Club Duty', reportData.statistics.dutyCount],
    ['Absent', reportData.statistics.absentCount],
    ['Total Duty Sessions', reportData.statistics.totalDutySessions],
    ['Total Duty Hours', reportData.statistics.totalDutyHours],
    ['Pending Approvals', reportData.statistics.pendingApprovals]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Daily Summary');

  // Attendance records sheet
  const attendanceData = [
    ['Date', 'Student Name', 'Student ID', 'Email', 'Status', 'Approval Status', 'Notes']
  ];

  reportData.attendanceRecords.forEach(record => {
    attendanceData.push([
      record.date,
      record.student.name,
      record.student.studentId || 'N/A',
      record.student.email,
      record.status.replace('_', ' '),
      record.isApproved === true ? 'Approved' : record.isApproved === false ? 'Rejected' : 'Pending',
      record.notes || ''
    ]);
  });

  const attendanceSheet = XLSX.utils.aoa_to_sheet(attendanceData);
  XLSX.utils.book_append_sheet(workbook, attendanceSheet, 'Attendance Records');

  // Duty sessions sheet
  const dutyData = [
    ['Start Time', 'End Time', 'Student Name', 'Student ID', 'Duration (minutes)', 'Break (minutes)', 'Status', 'Notes']
  ];

  reportData.dutySessions.forEach(session => {
    dutyData.push([
      moment(session.startTime).format('YYYY-MM-DD HH:mm'),
      session.endTime ? moment(session.endTime).format('YYYY-MM-DD HH:mm') : 'Ongoing',
      session.student.name,
      session.student.studentId || 'N/A',
      session.totalDurationMinutes || 0,
      session.breakDuration || 0,
      session.isActive ? 'Active' : 'Completed',
      session.notes || ''
    ]);
  });

  const dutySheet = XLSX.utils.aoa_to_sheet(dutyData);
  XLSX.utils.book_append_sheet(workbook, dutySheet, 'Duty Sessions');

  // Style the sheets
  styleExcelWorksheet(attendanceSheet, { headerRows: 1 });
  styleExcelWorksheet(dutySheet, { headerRows: 1 });

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Create a worksheet with proper formatting
 * @param {Array} data - Data array
 * @param {string} sheetName - Sheet name
 * @param {Array} columns - Column definitions
 * @returns {Object} Worksheet object
 */
function createWorksheet(data, sheetName, columns) {
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  if (columns) {
    worksheet['!cols'] = columns.map(col => ({ wch: col.width || 15 }));
  }

  return worksheet;
}

/**
 * Add summary sheet to workbook
 * @param {Object} workbook - XLSX workbook
 * @param {Object} statistics - Statistics object
 * @param {string} reportType - Type of report
 */
function addSummarySheet(workbook, statistics, reportType) {
  const summaryData = [
    ['Report Summary'],
    ['Generated', moment().format('YYYY-MM-DD HH:mm:ss')],
    ['Report Type', reportType],
    ['']
  ];

  Object.entries(statistics).forEach(([key, value]) => {
    const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    summaryData.push([displayKey, value]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
}

/**
 * Format data for Excel display
 * @param {Array} data - Raw data
 * @param {string} dataType - Type of data
 * @returns {Array} Formatted data
 */
function formatExcelData(data, dataType) {
  // Apply data type specific formatting
  return data.map(item => {
    const formatted = { ...item };

    // Format dates
    if (formatted.date) {
      formatted.date = moment(formatted.date).format('YYYY-MM-DD');
    }

    // Format status values
    if (formatted.status) {
      formatted.status = formatted.status.replace('_', ' ');
    }

    // Format approval status
    if (formatted.isApproved !== undefined) {
      formatted.approvalStatus = formatted.isApproved === true ? 'Approved' :
                                formatted.isApproved === false ? 'Rejected' : 'Pending';
      delete formatted.isApproved;
    }

    return formatted;
  });
}

/**
 * Apply styling to Excel worksheet
 * @param {Object} worksheet - XLSX worksheet
 * @param {Object} options - Styling options
 */
function styleExcelWorksheet(worksheet, options = {}) {
  const { headerRows = 1 } = options;

  // Set header row styling
  for (let col = 0; col < 26; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'FFD3D3D3' } }
      };
    }
  }

  // Set column widths
  worksheet['!cols'] = worksheet['!cols'] || [];
  const colCount = XLSX.utils.decode_range(worksheet['!ref']).e.c + 1;

  for (let i = 0; i < colCount; i++) {
    worksheet['!cols'][i] = { wch: 15 };
  }
}

/**
 * Add metadata to Excel workbook
 * @param {Object} workbook - XLSX workbook
 * @param {string} reportType - Type of report
 * @param {Object} filters - Applied filters
 */
function addExcelMetadata(workbook, reportType, filters) {
  workbook.Props = {
    Title: `Club Attendance - ${reportType} Report`,
    Subject: `${reportType} Report`,
    Author: 'Club Attendance Manager',
    CreatedDate: new Date(),
    Keywords: `attendance,club,${reportType},report`
  };

  if (filters.dateFrom || filters.dateTo) {
    workbook.Props.Comments = `Date range: ${getDateRangeText(filters)}`;
  }
}

/**
 * Get formatted date range text
 * @param {Object} filters - Applied filters
 * @returns {string} Formatted date range
 */
function getDateRangeText(filters) {
  if (filters.dateFrom && filters.dateTo) {
    return `${moment(filters.dateFrom).format('YYYY-MM-DD')} to ${moment(filters.dateTo).format('YYYY-MM-DD')}`;
  } else if (filters.dateFrom) {
    return `From ${moment(filters.dateFrom).format('YYYY-MM-DD')}`;
  } else if (filters.dateTo) {
    return `Until ${moment(filters.dateTo).format('YYYY-MM-DD')}`;
  }
  return 'All Dates';
}

module.exports = {
  generateAttendanceExcel,
  generateDutyLogExcel,
  generatePenaltyExcel,
  generateDailySummaryExcel,
  createWorksheet,
  addSummarySheet,
  formatExcelData,
  styleExcelWorksheet,
  addExcelMetadata
};