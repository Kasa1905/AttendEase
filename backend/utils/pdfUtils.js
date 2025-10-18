const jsPDF = require('jspdf');
require('jspdf-autotable');
const moment = require('moment');

/**
 * Generate attendance summary PDF
 * @param {Object} reportData - Report data from service
 * @param {Object} filters - Applied filters
 * @returns {Buffer} PDF buffer
 */
async function generateAttendancePDF(reportData, filters) {
  const doc = new jsPDF();

  // Add header
  addReportHeader(doc, 'Attendance Summary Report', filters);

  // Add summary statistics
  addSummarySection(doc, reportData.statistics);

  // Add attendance table
  const tableData = reportData.data.map(record => [
    moment(record.date).format('YYYY-MM-DD'),
    `${record.student.name}`,
    record.student.studentId || 'N/A',
    record.status.replace('_', ' '),
    record.isApproved === true ? 'Approved' : record.isApproved === false ? 'Rejected' : 'Pending',
    record.approvedAt ? moment(record.approvedAt).format('YYYY-MM-DD HH:mm') : 'N/A'
  ]);

  doc.autoTable({
    head: [['Date', 'Student', 'Student ID', 'Status', 'Approval', 'Approved At']],
    body: tableData,
    startY: 80,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  // Add footer
  addReportFooter(doc, 1, 1);

  return doc.output('nodebuffer');
}

/**
 * Generate duty log PDF
 * @param {Object} reportData - Report data from service
 * @param {Object} filters - Applied filters
 * @returns {Buffer} PDF buffer
 */
async function generateDutyLogPDF(reportData, filters) {
  const doc = new jsPDF();

  // Add header
  addReportHeader(doc, 'Duty Session Report', filters);

  // Add summary statistics
  addSummarySection(doc, reportData.statistics);

  // Add duty sessions table
  const tableData = reportData.data.map(session => [
    moment(session.startTime).format('YYYY-MM-DD HH:mm'),
    session.endTime ? moment(session.endTime).format('YYYY-MM-DD HH:mm') : 'Ongoing',
    `${session.student.name}`,
    session.student.studentId || 'N/A',
    session.totalDurationMinutes ? `${Math.floor(session.totalDurationMinutes / 60)}h ${session.totalDurationMinutes % 60}m` : 'N/A',
    session.breakDuration ? `${Math.floor(session.breakDuration / 60)}h ${session.breakDuration % 60}m` : '0m',
    session.isActive ? 'Active' : 'Completed'
  ]);

  doc.autoTable({
    head: [['Start Time', 'End Time', 'Student', 'Student ID', 'Duration', 'Break', 'Status']],
    body: tableData,
    startY: 80,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [46, 204, 113] },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  // Add footer
  addReportFooter(doc, 1, 1);

  return doc.output('nodebuffer');
}

/**
 * Generate penalty report PDF
 * @param {Object} reportData - Report data from service
 * @param {Object} filters - Applied filters
 * @returns {Buffer} PDF buffer
 */
async function generatePenaltyPDF(reportData, filters) {
  const doc = new jsPDF();

  // Add header
  addReportHeader(doc, 'Penalty Report', filters);

  // Add summary statistics
  addSummarySection(doc, reportData.statistics);

  // Add strikes table
  const tableData = reportData.data.map(strike => [
    moment(strike.date).format('YYYY-MM-DD'),
    `${strike.student.name}`,
    strike.student.studentId || 'N/A',
    strike.reason.replace('_', ' '),
    strike.severity,
    strike.strikeCountAtTime,
    strike.isActive ? 'Active' : 'Resolved'
  ]);

  doc.autoTable({
    head: [['Date', 'Student', 'Student ID', 'Reason', 'Severity', 'Strike Count', 'Status']],
    body: tableData,
    startY: 80,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [231, 76, 60] },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  // Add footer
  addReportFooter(doc, 1, 1);

  return doc.output('nodebuffer');
}

/**
 * Generate daily summary PDF for teachers
 * @param {Object} reportData - Report data from service
 * @param {Object} filters - Applied filters
 * @returns {Buffer} PDF buffer
 */
async function generateDailySummaryPDF(reportData, filters) {
  const doc = new jsPDF();

  // Add header
  addReportHeader(doc, `Daily Summary - ${moment(reportData.date).format('YYYY-MM-DD')}`, filters);

  let yPosition = 60;

  // Add statistics cards
  doc.setFontSize(12);
  doc.text('Summary Statistics:', 20, yPosition);
  yPosition += 10;

  const stats = reportData.statistics;
  const statLines = [
    `Total Attendance Records: ${stats.totalAttendance}`,
    `Present in Class: ${stats.presentCount}`,
    `On Club Duty: ${stats.dutyCount}`,
    `Absent: ${stats.absentCount}`,
    `Total Duty Sessions: ${stats.totalDutySessions}`,
    `Total Duty Hours: ${stats.totalDutyHours.toFixed(1)}`,
    `Pending Approvals: ${stats.pendingApprovals}`
  ];

  doc.setFontSize(10);
  statLines.forEach(line => {
    doc.text(line, 25, yPosition);
    yPosition += 8;
  });

  yPosition += 10;

  // Add attendance records table
  if (reportData.attendanceRecords.length > 0) {
    doc.setFontSize(12);
    doc.text('Attendance Records:', 20, yPosition);
    yPosition += 10;

    const attendanceTableData = reportData.attendanceRecords.slice(0, 20).map(record => [
      `${record.student.name}`,
      record.status.replace('_', ' '),
      record.isApproved === true ? 'Approved' : record.isApproved === false ? 'Rejected' : 'Pending'
    ]);

    doc.autoTable({
      head: [['Student', 'Status', 'Approval']],
      body: attendanceTableData,
      startY: yPosition,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [52, 152, 219] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    yPosition = doc.lastAutoTable.finalY + 20;
  }

  // Add footer
  addReportFooter(doc, 1, 1);

  return doc.output('nodebuffer');
}

/**
 * Add consistent report header
 * @param {jsPDF} doc - PDF document
 * @param {string} title - Report title
 * @param {Object} filters - Applied filters
 */
function addReportHeader(doc, title, filters) {
  // Club header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Club Attendance Manager', 20, 20);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 20, 35);

  // Date range
  doc.setFontSize(10);
  let dateText = 'All Dates';
  if (filters.dateFrom || filters.dateTo) {
    const fromDate = filters.dateFrom ? moment(filters.dateFrom).format('YYYY-MM-DD') : 'Start';
    const toDate = filters.dateTo ? moment(filters.dateTo).format('YYYY-MM-DD') : 'End';
    dateText = `${fromDate} to ${toDate}`;
  }
  doc.text(`Date Range: ${dateText}`, 20, 45);

  // Generation timestamp
  doc.text(`Generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`, 20, 52);
}

/**
 * Add summary statistics section
 * @param {jsPDF} doc - PDF document
 * @param {Object} statistics - Statistics object
 */
function addSummarySection(doc, statistics) {
  doc.setFontSize(12);
  doc.text('Summary Statistics:', 20, 70);

  let yPos = 80;
  doc.setFontSize(10);

  Object.entries(statistics).forEach(([key, value]) => {
    const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const displayValue = typeof value === 'number' && key.includes('Rate') ? `${value}%` :
                        typeof value === 'number' && key.includes('Hours') ? `${value.toFixed(1)}h` : value;
    doc.text(`${displayKey}: ${displayValue}`, 25, yPos);
    yPos += 8;
  });
}

/**
 * Add report footer
 * @param {jsPDF} doc - PDF document
 * @param {number} pageNumber - Current page number
 * @param {number} totalPages - Total pages
 */
function addReportFooter(doc, pageNumber, totalPages) {
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.text(`Page ${pageNumber} of ${totalPages}`, 20, pageHeight - 20);
  doc.text(`Generated by Club Attendance Manager`, 20, pageHeight - 10);
  doc.text(moment().format('YYYY-MM-DD HH:mm:ss'), doc.internal.pageSize.width - 60, pageHeight - 10);
}

module.exports = {
  generateAttendancePDF,
  generateDutyLogPDF,
  generatePenaltyPDF,
  generateDailySummaryPDF
};