const { User, ImportHistory } = require('../models');
const { parseCSVFile, parseXLSXFile, validateFileType } = require('../utils/fileUtils');
const emailService = require('./emailService');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

/**
 * Parse uploaded file (CSV or XLSX) into user data array
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @returns {Promise<Array>} - Array of parsed user objects
 */
const parseFile = async (buffer, filename) => {
  const fileExt = path.extname(filename).toLowerCase().replace('.', '');

  if (!validateFileType(filename, ['csv', 'xlsx'])) {
    throw new Error('Invalid file type. Only CSV and XLSX files are supported.');
  }

  let rows;
  if (fileExt === 'csv') {
    rows = await parseCSVFile(buffer);
  } else if (fileExt === 'xlsx') {
    rows = parseXLSXFile(buffer);
  } else {
    throw new Error('Unsupported file format');
  }

  // Validate basic file structure
  if (!rows || rows.length === 0) {
    throw new Error('File appears to be empty or corrupted');
  }

  return rows;
};

/**
 * Validate user data against User model schema
 * @param {Array} rows - Array of user data objects
 * @returns {Object} - Validation results with valid/invalid rows
 */
const validateUserData = (rows) => {
  const validRows = [];
  const invalidRows = [];
  const maxRows = process.env.IMPORT_MAX_ROWS || 1000;

  if (rows.length > maxRows) {
    throw new Error(`File contains too many rows. Maximum allowed: ${maxRows}`);
  }

  // Within-file duplicate detection
  const seenEmails = new Set();
  const seenStudentIds = new Set();

  // Normalization helper to prevent crashes on non-string values
  const normalize = v => (v === undefined || v === null) ? '' : String(v).trim();

  // Required fields mapping
  const requiredFields = ['email', 'firstName', 'lastName', 'role'];
  const optionalFields = ['studentId', 'department', 'year', 'section'];

  rows.forEach((row, index) => {
    const errors = [];
    const userData = {};

    // Validate required fields
    requiredFields.forEach(field => {
      const value = row[field] ?? row[field.toLowerCase()] ?? '';
      const norm = normalize(value);
      if (!norm) {
        errors.push(`${field} is required`);
      } else {
        userData[field] = norm;
      }
    });

    // Validate optional fields
    optionalFields.forEach(field => {
      const optValue = row[field] ?? row[field.toLowerCase()] ?? '';
      const optNorm = normalize(optValue);
      if (optNorm) {
        userData[field] = optNorm;
      }
    });

    // Coerce year to number if it's a valid number string
    if (userData.year && /^\d+$/.test(userData.year)) {
      userData.year = parseInt(userData.year, 10);
    }

    // Within-file duplicate detection
    if (userData.email) {
      const key = userData.email.toLowerCase();
      if (seenEmails.has(key)) {
        errors.push('Duplicate email in file');
      } else {
        seenEmails.add(key);
      }
    }

    if (userData.studentId) {
      if (seenStudentIds.has(userData.studentId)) {
        errors.push('Duplicate studentId in file');
      } else {
        seenStudentIds.add(userData.studentId);
      }
    }

    // Email format validation
    if (userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push('Invalid email format');
    }

    // Role validation
    const validRoles = ['student', 'core_team']; // Exclude 'teacher' for security - only teachers can create teachers
    if (userData.role && !validRoles.includes(userData.role.toLowerCase())) {
      errors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    } else if (userData.role) {
      userData.role = userData.role.toLowerCase();
    }

    // Student ID validation for students
    if (userData.role === 'student' && !userData.studentId) {
      errors.push('Student ID is required for students');
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: index + 2, // +2 because of 0-index and header row
        data: row,
        errors: errors
      });
    } else {
      validRows.push({
        rowNumber: index + 2,
        data: userData
      });
    }
  });

  return { validRows, invalidRows };
};

/**
 * Check for existing users by email or studentId
 * @param {string[]} emails - Array of emails to check
 * @param {string[]} studentIds - Array of student IDs to check
 * @returns {Promise<Object>} - Object with existing users
 */
const checkExistingUsers = async (emails, studentIds) => {
  const existingUsers = {
    byEmail: new Set(),
    byStudentId: new Set()
  };

  // Check existing emails
  if (emails.length > 0) {
    const emailUsers = await User.findAll({
      where: { email: emails },
      attributes: ['email']
    });
    emailUsers.forEach(user => existingUsers.byEmail.add(user.email.toLowerCase()));
  }

  // Check existing student IDs
  if (studentIds.length > 0) {
    const studentIdUsers = await User.findAll({
      where: { studentId: studentIds },
      attributes: ['studentId']
    });
    studentIdUsers.forEach(user => existingUsers.byStudentId.add(user.studentId));
  }

  return existingUsers;
};

/**
 * Generate secure random password using crypto
 * @param {number} length - Password length
 * @returns {string} - Generated password
 */
const generatePassword = (length = parseInt(process.env.IMPORT_DEFAULT_PASSWORD_LENGTH || '12', 10)) =>
  crypto.randomBytes(length).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, length);

/**
 * Execute bulk user creation with transaction support
 * @param {Array} validRows - Array of validated user data
 * @param {Object} options - Import options
 * @param {Object} io - Socket.io instance for progress updates
 * @param {string} batchId - Import batch ID
 * @param {string} userId - ID of user requesting the import
 * @param {string} fileName - Original file name
 * @param {string} format - File format (csv/xlsx)
 * @returns {Promise<Object>} - Import results
 */
const bulkCreateUsers = async (validRows, options = {}, io = null, batchId = null, userId = null, fileName = null, format = null) => {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
    createdUsers: []
  };

  const startedAt = new Date();

  // Create import history record
  let importHistory = null;
  if (userId && batchId && fileName && format) {
    try {
      importHistory = await ImportHistory.create({
        batchId,
        requestedBy: userId,
        fileName,
        format,
        totalRows: validRows.length,
        startedAt,
        status: 'processing'
      });
    } catch (error) {
      console.error('Failed to create import history record:', error);
      // Continue with import even if history creation fails
    }
  }

  const transaction = await User.sequelize.transaction();

  try {
    const batchSize = 10; // Process in batches for better performance
    let processedCount = 0;

    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);

      for (const row of batch) {
        try {
          const userData = { ...row.data };

          // Generate password for new users
          const password = generatePassword();
          userData.password = await bcrypt.hash(password, BCRYPT_ROUNDS);

          // Create user
          const newUser = await User.create(userData, { transaction });

          results.createdUsers.push({
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            password: password // Include for email sending
          });

          results.success++;

          // Emit progress update
          processedCount++;
          if (io && batchId) {
            const progress = Math.round((processedCount / validRows.length) * 100);
            io.to(batchId).emit('import-progress', {
              batchId,
              progress,
              processed: processedCount,
              total: validRows.length,
              currentOperation: `Creating user: ${newUser.email}`
            });
          }

        } catch (error) {
          results.failed++;
          results.errors.push({
            rowNumber: row.rowNumber,
            email: row.data.email,
            error: error.message
          });

          // Still count as processed for progress
          processedCount++;
          if (io && batchId) {
            const progress = Math.round((processedCount / validRows.length) * 100);
            io.to(batchId).emit('import-progress', {
              batchId,
              progress,
              processed: processedCount,
              total: validRows.length,
              currentOperation: `Failed: ${row.data.email} - ${error.message}`
            });
          }
        }
      }
    }

    await transaction.commit();

    // now send emails without transaction
    if (process.env.ENABLE_IMPORT_EMAIL_NOTIFICATIONS !== 'false' && results.createdUsers.length > 0) {
      for (const user of results.createdUsers) {
        try {
          await emailService.sendWelcomeEmail(user.email, {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            password: user.password
          });
        } catch (emailError) {
          console.error(`Failed to send welcome email to ${user.email}:`, emailError);
          // Don't fail the import for email errors
        }
      }

      if (io && batchId) {
        io.to(batchId).emit('import-progress', {
          batchId,
          progress: 100,
          processed: validRows.length,
          total: validRows.length,
          currentOperation: 'Sending welcome emails...'
        });
      }
    }

    // Emit a final progress update after emails
    if (io && batchId) {
      io.to(batchId).emit('import-completed', {
        batchId,
        results: generateImportSummary(results)
      });
    }

    // Update import history on success
    if (importHistory) {
      const finishedAt = new Date();
      const duration = finishedAt - startedAt;
      await importHistory.update({
        successful: results.success,
        failed: results.failed,
        errorCount: results.errors.length,
        finishedAt,
        duration,
        status: 'completed',
        sampleErrors: results.errors.slice(0, 5).map(err => ({
          rowNumber: err.rowNumber,
          email: err.email,
          error: err.error
        }))
      });
    }

  } catch (error) {
    await transaction.rollback();

    // Update import history on failure
    if (importHistory) {
      const finishedAt = new Date();
      const duration = finishedAt - startedAt;
      await importHistory.update({
        successful: results.success,
        failed: results.failed,
        errorCount: results.errors.length,
        finishedAt,
        duration,
        status: 'failed',
        errorSummary: error.message,
        sampleErrors: results.errors.slice(0, 5).map(err => ({
          rowNumber: err.rowNumber,
          email: err.email,
          error: err.error
        }))
      });
    }

    if (io && batchId) {
      io.to(batchId).emit('import-error', {
        batchId,
        error: error.message
      });
    }

    throw error;
  }

  return results;
};

/**
 * Generate comprehensive import summary
 * @param {Object} results - Import results
 * @returns {Object} - Formatted summary
 */
const generateImportSummary = (results) => {
  return {
    totalProcessed: results.success + results.failed,
    successful: results.success,
    failed: results.failed,
    successRate: results.success / (results.success + results.failed) * 100,
    errors: results.errors.slice(0, 10), // Limit error details
    hasMoreErrors: results.errors.length > 10
  };
};

/**
 * Clean up temporary files and preview data
 * @param {string} batchId - Import batch ID
 */
const cleanupTempFiles = (batchId) => {
  // Implementation for cleanup if needed
  // For now, this is a placeholder as we're using memory storage
  console.log(`Cleanup completed for batch: ${batchId}`);
};

module.exports = {
  parseFile,
  validateUserData,
  checkExistingUsers,
  bulkCreateUsers,
  generateImportSummary,
  cleanupTempFiles
};