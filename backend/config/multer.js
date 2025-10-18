const multer = require('multer');
const path = require('path');

// Configure memory storage for temporary file handling during import process
const storage = multer.memoryStorage();

// File filter for CSV and XLSX files only
const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.IMPORT_ALLOWED_TYPES ?
    process.env.IMPORT_ALLOWED_TYPES.split(',') : ['csv', 'xlsx'];

  const fileExt = path.extname(file.originalname).toLowerCase().replace('.', '');
  const allowedMimes = {
    'csv': ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream'],
    'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  };

  // Allow CSV based on file extension if mimetype is ambiguous, or check MIME type
  const isCsvExt = fileExt === 'csv';
  const isCsvMime = allowedMimes.csv.includes(file.mimetype);
  const isXlsxExt = fileExt === 'xlsx';
  const isXlsxMime = allowedMimes.xlsx.includes(file.mimetype);

  if ((isCsvExt && allowedTypes.includes('csv')) ||
      (isXlsxExt && allowedTypes.includes('xlsx') && isXlsxMime) ||
      (!isCsvExt && !isXlsxExt && allowedMimes[fileExt]?.includes(file.mimetype))) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} files are allowed.`), false);
  }
};

// Configure multer with limits and filters
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: (process.env.IMPORT_MAX_FILE_SIZE || 10) * 1024 * 1024, // Default 10MB
    files: 1 // Only one file at a time
  }
});

// Sanitize filename for security
const sanitizeFileName = (filename) => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

// Export configured multer instance
module.exports = {
  upload,
  sanitizeFileName
};