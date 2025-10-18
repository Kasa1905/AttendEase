/**
 * Validate import file on the client side
 * @param {File} file - File to validate
 * @returns {Object} - Validation result with isValid and error message
 */
export const validateImportFile = (file) => {
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
};

/**
 * Parse and format preview data from API response
 * @param {Object} response - API response data
 * @returns {Object} - Formatted preview data
 */
export const parsePreviewData = (response) => {
  return {
    batchId: response.batchId,
    summary: response.summary || {},
    validRows: response.validRows || [],
    invalidRows: response.invalidRows || [],
    allRows: [
      ...(response.validRows || []),
      ...(response.invalidRows || [])
    ].sort((a, b) => a.rowNumber - b.rowNumber)
  };
};

/**
 * Format validation errors for user-friendly display
 * @param {Array} errors - Array of error strings
 * @returns {string} - Formatted error message
 */
export const formatImportErrors = (errors) => {
  if (!errors || errors.length === 0) return 'No errors';

  if (errors.length === 1) return errors[0];

  return `${errors[0]} (+${errors.length - 1} more)`;
};

/**
 * Generate downloadable error report in CSV format
 * @param {Array} invalidRows - Array of invalid row objects
 * @returns {string} - CSV content
 */
export const generateErrorReport = (invalidRows) => {
  if (!invalidRows || invalidRows.length === 0) {
    return 'Row Number,Email,Errors\nNo errors found';
  }

  let csv = 'Row Number,Email,First Name,Last Name,Role,Errors\n';

  invalidRows.forEach(row => {
    const errors = row.errors ? row.errors.join('; ') : 'Unknown error';
    csv += `${row.rowNumber},"${row.data?.email || ''}","${row.data?.firstName || ''}","${row.data?.lastName || ''}","${row.data?.role || ''}","${errors}"\n`;
  });

  return csv;
};

/**
 * Calculate import statistics and success rates
 * @param {Object} data - Import data object
 * @returns {Object} - Statistics object
 */
export const calculateImportStatistics = (data) => {
  const total = data.allRows?.length || 0;
  const valid = data.validRows?.length || 0;
  const invalid = data.invalidRows?.length || 0;
  const successRate = total > 0 ? Math.round((valid / total) * 100) : 0;

  return {
    total,
    valid,
    invalid,
    successRate,
    hasErrors: invalid > 0,
    canProceed: valid > 0
  };
};

/**
 * Format progress data for display components
 * @param {Object} progress - Progress data from socket
 * @returns {Object} - Formatted progress data
 */
export const formatImportProgress = (progress) => {
  return {
    percentage: progress.progress || 0,
    processed: progress.processed || 0,
    total: progress.total || 0,
    currentOperation: progress.currentOperation || 'Processing...',
    isComplete: progress.progress === 100,
    hasErrors: progress.error
  };
};

/**
 * Client-side validation for individual user rows
 * @param {Object} row - User data row
 * @returns {Object} - Validation result
 */
export const validateUserRow = (row) => {
  const errors = [];

  // Required fields
  if (!row.email || !row.email.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push('Invalid email format');
  }

  if (!row.firstName || !row.firstName.trim()) {
    errors.push('First name is required');
  }

  if (!row.lastName || !row.lastName.trim()) {
    errors.push('Last name is required');
  }

  if (!row.role || !row.role.trim()) {
    errors.push('Role is required');
  } else {
    const validRoles = ['student', 'core_team', 'teacher'];
    if (!validRoles.includes(row.role.toLowerCase())) {
      errors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
  }

  // Student ID validation for students
  if (row.role && row.role.toLowerCase() === 'student' && !row.studentId) {
    errors.push('Student ID is required for students');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Handle template file downloads
 * @param {string} format - Template format (csv or xlsx)
 * @returns {Promise<boolean>} - Success status
 */
export const downloadTemplate = async (format = 'csv') => {
  try {
    const response = await fetch(`/api/users/import/template?format=${format}`);
    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `member_import_template.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Template download failed:', error);
    return false;
  }
};

/**
 * Format file sizes for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generate human-readable import summaries
 * @param {Object} results - Import results from API
 * @returns {Object} - Formatted summary
 */
export const formatImportSummary = (results) => {
  const total = results.totalProcessed || 0;
  const successful = results.successful || 0;
  const failed = results.failed || 0;
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

  return {
    total,
    successful,
    failed,
    successRate,
    message: successRate === 100
      ? `All ${total} users imported successfully!`
      : `${successful} of ${total} users imported successfully (${successRate}% success rate)`,
    hasErrors: failed > 0,
    hasPartialSuccess: successful > 0 && failed > 0
  };
};

/**
 * Format file type icons for display
 * @param {string} filename - File name
 * @returns {string} - Icon emoji
 */
export const getFileTypeIcon = (filename) => {
  if (!filename) return '📄';

  const extension = filename.split('.').pop().toLowerCase();
  switch (extension) {
    case 'csv':
      return '📊';
    case 'xlsx':
    case 'xls':
      return '📈';
    default:
      return '📄';
  }
};

/**
 * Client-side email validation
 * @param {string} email - Email to validate
 * @returns {boolean} - Is valid email
 */
export const validateEmailFormat = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Format role values for display
 * @param {string} role - Role value
 * @returns {string} - Formatted role
 */
export const formatUserRole = (role) => {
  if (!role) return 'N/A';

  switch (role.toLowerCase()) {
    case 'student':
      return 'Student';
    case 'core_team':
      return 'Core Team';
    case 'teacher':
      return 'Teacher';
    default:
      return role;
  }
};

/**
 * Generate consistent file names for downloads
 * @param {string} type - File type
 * @param {Date} timestamp - Timestamp
 * @returns {string} - Generated filename
 */
export const generateImportFileName = (type, timestamp = new Date()) => {
  const dateStr = timestamp.toISOString().slice(0, 10);
  const timeStr = timestamp.toISOString().slice(11, 19).replace(/:/g, '-');
  return `import_${type}_${dateStr}_${timeStr}`;
};

/**
 * Safely truncate long file names for display
 * @param {string} filename - Original filename
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated filename
 */
export const truncateFileName = (filename, maxLength = 30) => {
  if (!filename || filename.length <= maxLength) return filename;

  const extension = filename.split('.').pop();
  const nameWithoutExt = filename.slice(0, -(extension.length + 1));

  if (nameWithoutExt.length <= maxLength - 3) return filename;

  return nameWithoutExt.slice(0, maxLength - 6) + '...' + '.' + extension;
};

/**
 * Generate descriptive progress text
 * @param {Object} progress - Progress data
 * @returns {string} - Progress text
 */
export const getImportProgressText = (progress) => {
  if (!progress) return 'Initializing...';

  if (progress.isComplete) {
    return 'Import completed successfully!';
  }

  if (progress.hasErrors) {
    return 'Import encountered errors';
  }

  if (progress.processed && progress.total) {
    return `Processing ${progress.processed} of ${progress.total} users...`;
  }

  return progress.currentOperation || 'Processing...';
};

/**
 * Format row numbers for error reporting
 * @param {number} index - Row index
 * @returns {string} - Formatted row number
 */
export const formatRowNumber = (index) => {
  return `#${(index + 1).toString().padStart(3, '0')}`;
};

/**
 * Validate required fields in import data
 * @param {Object} row - Data row
 * @param {Array} requiredFields - Required field names
 * @returns {Object} - Validation result
 */
export const validateRequiredFields = (row, requiredFields = ['email', 'firstName', 'lastName', 'role']) => {
  const missing = requiredFields.filter(field => !row[field] || !row[field].trim());
  return {
    isValid: missing.length === 0,
    missingFields: missing
  };
};