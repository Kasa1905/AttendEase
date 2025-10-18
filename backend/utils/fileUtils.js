const XLSX = require('xlsx');
const csv = require('csv-parser');
const crypto = require('crypto');
const path = require('path');
const { Transform } = require('stream');

/**
 * Validate uploaded file extensions and MIME types
 * @param {string} filename - Original filename
 * @param {string[]} allowedTypes - Array of allowed file extensions
 * @returns {boolean} - True if file type is valid
 */
const validateFileType = (filename, allowedTypes = ['csv', 'xlsx']) => {
  const fileExt = path.extname(filename).toLowerCase().replace('.', '');
  return allowedTypes.includes(fileExt);
};

/**
 * Parse CSV file buffer into array of objects
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<Array>} - Array of parsed rows
 */
const parseCSVFile = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const bufferStream = new Transform({
      transform(chunk, encoding, callback) {
        this.push(chunk);
        callback();
      }
    });

    bufferStream.end(buffer);

    bufferStream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

/**
 * Parse XLSX file buffer into array of objects
 * @param {Buffer} buffer - File buffer
 * @returns {Array} - Array of parsed rows
 */
const parseXLSXFile = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

/**
 * Generate CSV template file with headers and sample data
 * @param {string[]} headers - Column headers
 * @param {Array} sampleData - Sample data rows
 * @returns {string} - CSV content
 */
const generateCSVTemplate = (headers, sampleData = []) => {
  let csvContent = headers.join(',') + '\n';

  sampleData.forEach(row => {
    const values = headers.map(header => row[header] || '');
    csvContent += values.map(val => `"${val}"`).join(',') + '\n';
  });

  return csvContent;
};

/**
 * Generate XLSX template file with headers and sample data
 * @param {string[]} headers - Column headers
 * @param {Array} sampleData - Sample data rows
 * @returns {Buffer} - XLSX file buffer
 */
const generateXLSXTemplate = (headers, sampleData = []) => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Sanitize uploaded file names for security
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFileName = (filename) => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

/**
 * Generate file hash for duplicate detection
 * @param {Buffer} buffer - File buffer
 * @returns {string} - SHA256 hash
 */
const calculateFileHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * Validate file size against configured limits
 * @param {number} size - File size in bytes
 * @param {number} maxSize - Maximum size in bytes
 * @returns {boolean} - True if size is valid
 */
const validateFileSize = (size, maxSize = 10 * 1024 * 1024) => {
  return size <= maxSize;
};

/**
 * Detect file encoding (basic implementation)
 * @param {Buffer} buffer - File buffer
 * @returns {string} - Detected encoding
 */
const detectFileEncoding = (buffer) => {
  // Simple encoding detection - can be enhanced
  const str = buffer.toString();
  if (str.includes('�')) {
    return 'utf8';
  }
  return 'utf8'; // Default to UTF-8
};

module.exports = {
  validateFileType,
  parseCSVFile,
  parseXLSXFile,
  generateCSVTemplate,
  generateXLSXTemplate,
  sanitizeFileName,
  calculateFileHash,
  validateFileSize,
  detectFileEncoding
};