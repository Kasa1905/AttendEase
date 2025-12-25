// Client-side report generation utilities
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// PDF Generation Utilities
export const generateClientPDF = (data, reportType, title) => {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(20);
  doc.text(title, 20, 20);

  // Add timestamp
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);

  // Add data table
  if (data && data.length > 0) {
    const headers = Object.keys(data[0]);
    const rows = data.map(item => headers.map(header => item[header] || ''));

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 40,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });
  }

  // Save the PDF
  const filename = `${reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);

  return filename;
};

// Excel Generation Utilities
export const generateClientExcel = async (data, reportType, title) => {
  if (!data || data.length === 0) {
    throw new Error('No data available for Excel generation');
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title || 'Report');

  const headers = Object.keys(data[0]);
  worksheet.columns = headers.map(header => ({ header, key: header }));
  data.forEach(row => {
    const normalizedRow = headers.reduce((acc, header) => {
      acc[header] = row[header] ?? '';
      return acc;
    }, {});
    worksheet.addRow(normalizedRow);
  });

  // Generate filename
  const filename = `${reportType}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

  // Save the file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  saveAs(blob, filename);

  return filename;
};

// CSV Generation Utilities
export const generateClientCSV = (data, reportType) => {
  if (!data || data.length === 0) {
    throw new Error('No data available for CSV generation');
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`;

  saveAs(blob, filename);

  return filename;
};

// Data formatting utilities
export const formatReportData = (rawData, reportType) => {
  if (!rawData || !Array.isArray(rawData)) {
    return [];
  }

  switch (reportType) {
    case 'attendance':
      return rawData.map(item => ({
        'Student Name': item.User?.name || 'N/A',
        'Event': item.Event?.name || 'N/A',
        'Date': new Date(item.createdAt).toLocaleDateString(),
        'Status': item.status,
        'Approval Status': item.approvalStatus,
        'Duty Eligible': item.dutyEligible ? 'Yes' : 'No'
      }));

    case 'duty':
      return rawData.map(item => ({
        'Student Name': item.User?.name || 'N/A',
        'Date': new Date(item.date).toLocaleDateString(),
        'Start Time': item.startTime,
        'End Time': item.endTime || 'Ongoing',
        'Duration (hours)': item.duration || 'N/A',
        'Status': item.isActive ? 'Active' : 'Completed'
      }));

    case 'penalty':
      return rawData.map(item => ({
        'Student Name': item.User?.name || 'N/A',
        'Reason': item.reason,
        'Severity': item.severity,
        'Date': new Date(item.createdAt).toLocaleDateString(),
        'Status': item.isActive ? 'Active' : 'Resolved'
      }));

    case 'member':
      return rawData.map(item => ({
        'Name': item.name,
        'Role': item.role,
        'Attendance Rate (%)': item.attendanceRate,
        'Total Duty Hours': item.totalDutyHours,
        'Active Strikes': item.activeStrikes
      }));

    case 'daily':
      return rawData.map(item => ({
        'Type': item.type,
        'Count': item.count,
        'Details': item.details
      }));

    default:
      return rawData;
  }
};

// Report validation utilities
export const validateReportFilters = (filters, reportType) => {
  const errors = [];

  // Date validation
  if (filters.dateFrom && filters.dateTo) {
    const fromDate = new Date(filters.dateFrom);
    const toDate = new Date(filters.dateTo);

    if (fromDate > toDate) {
      errors.push('Start date cannot be after end date');
    }

    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year
    if (toDate - fromDate > maxRange) {
      errors.push('Date range cannot exceed 1 year');
    }
  }

  // Report type specific validations
  switch (reportType) {
    case 'attendance':
      if (filters.status && !['present_in_class', 'on_club_duty', 'absent'].includes(filters.status)) {
        errors.push('Invalid attendance status');
      }
      if (filters.approvalStatus && !['pending', 'approved', 'rejected'].includes(filters.approvalStatus)) {
        errors.push('Invalid approval status');
      }
      break;

    case 'penalty':
      if (filters.severity && !['low', 'medium', 'high'].includes(filters.severity)) {
        errors.push('Invalid penalty severity');
      }
      break;

    default:
      break;
  }

  return errors;
};

// Export format utilities
export const getSupportedFormats = () => {
  return ['pdf', 'excel', 'csv'];
};

export const getFormatDisplayName = (format) => {
  switch (format) {
    case 'pdf':
      return 'PDF Document';
    case 'excel':
      return 'Excel Spreadsheet';
    case 'csv':
      return 'CSV File';
    default:
      return format.toUpperCase();
  }
};

export const getFormatMimeType = (format) => {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv';
    default:
      return 'application/octet-stream';
  }
};