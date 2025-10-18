const path = require('path');
const fs = require('fs');

/**
 * File Upload Helper utilities for E2E tests
 * Provides methods to handle file uploads, validations, and CSV operations
 */
class FileUploadHelpers {
  /**
   * Upload a file using Playwright's file upload functionality
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} selector - CSS selector for the file input
   * @param {string} filePath - Path to the file to upload (absolute or relative to test directory)
   * @returns {Promise<void>}
   */
  static async uploadFile(page, selector, filePath) {
    // Resolve file path relative to test directory if not absolute
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(__dirname, '..', 'fixtures', filePath);
    
    // Verify file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    
    // Upload the file
    await page.setInputFiles(selector, absolutePath);
  }

  /**
   * Create and upload a CSV file with test data
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} selector - CSS selector for the file input
   * @param {Array<Object>} data - Array of objects representing CSV rows
   * @param {Array<string>} headers - Array of column headers
   * @returns {Promise<string>} - Path to the created CSV file
   */
  static async uploadCSV(page, selector, data, headers) {
    const csvContent = this.arrayToCSV(data, headers);
    const tempFilePath = path.join(__dirname, '..', 'temp', `test-${Date.now()}.csv`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Write CSV file
    fs.writeFileSync(tempFilePath, csvContent);
    
    // Upload the file
    await this.uploadFile(page, selector, tempFilePath);
    
    return tempFilePath;
  }

  /**
   * Validate file upload success by checking UI feedback
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} expectedMessage - Expected success message
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>}
   */
  static async validateUploadSuccess(page, expectedMessage = 'Upload successful', timeout = 10000) {
    try {
      await page.waitForSelector(`text=${expectedMessage}`, { timeout });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle upload errors and extract error messages
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<string|null>} - Error message or null if no error
   */
  static async getUploadError(page, timeout = 5000) {
    try {
      const errorElement = await page.waitForSelector('[data-testid="upload-error"], .error-message', { timeout });
      return await errorElement.textContent();
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert array of objects to CSV format
   * @param {Array<Object>} data - Data to convert
   * @param {Array<string>} headers - Column headers
   * @returns {string} - CSV string
   */
  static arrayToCSV(data, headers) {
    if (!data || data.length === 0) {
      return headers.join(',') + '\n';
    }
    
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escape values that contain commas or quotes
        return typeof value === 'string' && (value.includes(',') || value.includes('"'))
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * Create sample user data for CSV uploads
   * @param {number} count - Number of users to generate
   * @returns {Array<Object>} - Array of user objects
   */
  static generateSampleUsers(count = 10) {
    const users = [];
    for (let i = 1; i <= count; i++) {
      users.push({
        name: `Test User ${i}`,
        email: `user${i}@test.com`,
        studentId: `STU${String(i).padStart(4, '0')}`,
        role: 'member',
        joinDate: new Date().toISOString().split('T')[0]
      });
    }
    return users;
  }

  /**
   * Clean up temporary files created during tests
   * @param {string} filePath - Path to the file to clean up
   * @returns {Promise<void>}
   */
  static async cleanup(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn('Failed to cleanup file:', error.message);
    }
  }

  /**
   * Wait for file processing to complete
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  static async waitForProcessing(page, timeout = 30000) {
    // Wait for processing indicator to appear and then disappear
    try {
      await page.waitForSelector('[data-testid="processing-indicator"], .processing', { timeout: 5000 });
      await page.waitForSelector('[data-testid="processing-indicator"], .processing', { state: 'hidden', timeout });
    } catch (error) {
      // Processing indicator might not appear for fast operations
      console.log('No processing indicator found or operation completed quickly');
    }
  }
}

module.exports = FileUploadHelpers;