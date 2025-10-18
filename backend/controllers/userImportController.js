const importService = require('../services/importService');
const { generateCSVTemplate, generateXLSXTemplate } = require('../utils/fileUtils');
const { User, ImportHistory } = require('../models');
const crypto = require('crypto');

/**
 * Handle file upload and return import preview with validation results
 */
const uploadAndPreview = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, originalname } = req.file;

    // Parse file
    const rows = await importService.parseFile(buffer, originalname);

    // Validate data
    const { validRows, invalidRows } = importService.validateUserData(rows);

    // Check for existing users
    const emails = validRows.map(row => row.data.email.toLowerCase());
    const studentIds = validRows
      .filter(row => row.data.studentId)
      .map(row => row.data.studentId);

    const existingUsers = await importService.checkExistingUsers(emails, studentIds);

    // Mark duplicates
    const finalValidRows = [];
    const duplicates = [];

    validRows.forEach(row => {
      const email = row.data.email.toLowerCase();
      const studentId = row.data.studentId;

      if (existingUsers.byEmail.has(email)) {
        duplicates.push({
          rowNumber: row.rowNumber,
          data: row.data,
          errors: ['Email already exists']
        });
      } else if (studentId && existingUsers.byStudentId.has(studentId)) {
        duplicates.push({
          rowNumber: row.rowNumber,
          data: row.data,
          errors: ['Student ID already exists']
        });
      } else {
        finalValidRows.push(row);
      }
    });

    const batchId = crypto.randomUUID();

    res.json({
      batchId,
      summary: {
        totalRows: rows.length,
        validRows: finalValidRows.length,
        invalidRows: invalidRows.length + duplicates.length,
        duplicateRows: duplicates.length
      },
      validRows: finalValidRows,
      invalidRows: [...invalidRows, ...duplicates]
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Execute confirmed import operation
 */
const confirmImport = async (req, res, next) => {
  try {
    const { batchId, validRows, fileName, format } = req.body;

    if (!batchId || !validRows || !Array.isArray(validRows)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // Server-side revalidation: Extract and re-validate data
    const rows = validRows.map(v => v.data);
    const { validRows: revalidatedRows, invalidRows: revalidationErrors } = importService.validateUserData(rows);

    // Assert no invalid rows from revalidation
    if (revalidationErrors.length > 0) {
      return res.status(400).json({
        error: 'Data validation failed during import confirmation',
        details: revalidationErrors.slice(0, 5) // Limit error details
      });
    }

    // Re-check for existing users that might have been created since preview
    const emails = revalidatedRows.map(row => row.data.email.toLowerCase());
    const studentIds = revalidatedRows
      .filter(row => row.data.studentId)
      .map(row => row.data.studentId);

    const existingUsers = await importService.checkExistingUsers(emails, studentIds);

    // Filter out any rows that became duplicates
    const finalValidRows = [];
    const duplicates = [];

    revalidatedRows.forEach(row => {
      const email = row.data.email.toLowerCase();
      const studentId = row.data.studentId;

      if (existingUsers.byEmail.has(email)) {
        duplicates.push({
          rowNumber: row.rowNumber,
          data: row.data,
          errors: ['Email already exists']
        });
      } else if (studentId && existingUsers.byStudentId.has(studentId)) {
        duplicates.push({
          rowNumber: row.rowNumber,
          data: row.data,
          errors: ['Student ID already exists']
        });
      } else {
        finalValidRows.push(row);
      }
    });

    // If all rows became duplicates, return error
    if (finalValidRows.length === 0) {
      return res.status(400).json({
        error: 'All selected users are duplicates or already exist',
        duplicates: duplicates.slice(0, 10) // Limit details
      });
    }

    // Get socket.io instance from app
    const io = req.app.get('io');

    // Execute bulk import with history tracking using sanitized data
    const results = await importService.bulkCreateUsers(
      finalValidRows,
      {},
      io,
      batchId,
      req.user.id,
      fileName,
      format
    );

    res.json({
      batchId,
      results: importService.generateImportSummary(results)
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Download CSV or XLSX template file
 */
const downloadTemplate = async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;

    const headers = ['email', 'firstName', 'lastName', 'role', 'studentId', 'department', 'year', 'section'];

    const sampleData = [
      {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student',
        studentId: 'STU001',
        department: 'Computer Science',
        year: '3',
        section: 'A'
      },
      {
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'core_team',
        studentId: '',
        department: 'Information Technology',
        year: '',
        section: ''
      }
    ];

    if (format === 'xlsx') {
      const buffer = generateXLSXTemplate(headers, sampleData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="member_import_template.xlsx"');
      res.send(buffer);
    } else {
      const csvContent = generateCSVTemplate(headers, sampleData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="member_import_template.csv"');
      res.send(csvContent);
    }

  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve import operation history with statistics
 */
const getImportHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, sortBy = 'startedAt', sortOrder = 'DESC' } = req.query;

    // Validate query parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }

    const where = {};
    if (status && ['processing', 'completed', 'failed', 'cancelled'].includes(status)) {
      where.status = status;
    }

    // Only show imports requested by the current user (unless admin)
    if (req.user.role !== 'teacher') {
      where.requestedBy = req.user.id;
    }

    const offset = (pageNum - 1) * limitNum;

    const { count, rows } = await ImportHistory.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'requester',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: limitNum,
      offset,
      attributes: [
        'id', 'batchId', 'fileName', 'format', 'totalRows', 'successful', 'failed',
        'errorCount', 'startedAt', 'finishedAt', 'duration', 'status', 'sampleErrors', 'errorSummary'
      ]
    });

    const totalPages = Math.ceil(count / limitNum);

    res.json({
      imports: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadAndPreview,
  confirmImport,
  downloadTemplate,
  getImportHistory
};