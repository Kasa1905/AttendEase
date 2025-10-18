const { test, expect } = require('@playwright/test');
const { AuthFixtures, FileUploadHelpers, APIHelpers } = require('../utils/testUtils');
const fs = require('fs').promises;
const path = require('path');

/**
 * File Upload and Import E2E Tests
 * Tests CSV/XLSX upload, file validation, error handling, and bulk operations
 */

test.describe('File Upload and Import', () => {
  let authFixtures;
  let fileUploadHelpers;
  let apiHelpers;
  
  // Test file paths
  const testFilesDir = path.join(__dirname, '../fixtures/files');
  
  test.beforeAll(async () => {
    // Ensure test files directory exists
    await fs.mkdir(testFilesDir, { recursive: true });
    
    // Create test CSV files
    await createTestFiles();
  });

  test.beforeEach(async ({ page, context }) => {
    authFixtures = new AuthFixtures();
    fileUploadHelpers = new FileUploadHelpers(page);
    apiHelpers = new APIHelpers();
  });

  async function createTestFiles() {
    // Valid user CSV
    const validUserCsv = `name,email,role,phone,studentId
John Doe,john.doe@example.com,student,1234567890,ST001
Jane Smith,jane.smith@example.com,student,2345678901,ST002
Bob Johnson,bob.johnson@example.com,coreTeam,3456789012,CT001`;
    
    await fs.writeFile(path.join(testFilesDir, 'valid-users.csv'), validUserCsv);

    // Invalid user CSV (missing required fields)
    const invalidUserCsv = `name,email
John Invalid,john.invalid@example.com
Jane Invalid,jane.invalid@example.com`;
    
    await fs.writeFile(path.join(testFilesDir, 'invalid-users.csv'), invalidUserCsv);

    // Large user CSV (for performance testing)
    let largeUserCsv = 'name,email,role,phone,studentId\n';
    for (let i = 1; i <= 1000; i++) {
      largeUserCsv += `User ${i},user${i}@example.com,student,${1000000000 + i},ST${i.toString().padStart(3, '0')}\n`;
    }
    await fs.writeFile(path.join(testFilesDir, 'large-users.csv'), largeUserCsv);

    // Duplicate entries CSV
    const duplicateUserCsv = `name,email,role,phone,studentId
John Doe,john.doe@example.com,student,1234567890,ST001
John Doe,john.doe@example.com,student,1234567890,ST001
Jane Smith,jane.smith@example.com,student,2345678901,ST002`;
    
    await fs.writeFile(path.join(testFilesDir, 'duplicate-users.csv'), duplicateUserCsv);

    // Invalid format file (not CSV/XLSX)
    await fs.writeFile(path.join(testFilesDir, 'invalid-format.txt'), 'This is not a CSV file');

    // Valid attendance records CSV
    const validAttendanceCsv = `studentId,date,status,notes
ST001,2024-01-15,present,Regular attendance
ST002,2024-01-15,absent,Medical leave
ST001,2024-01-16,present,On time`;
    
    await fs.writeFile(path.join(testFilesDir, 'valid-attendance.csv'), validAttendanceCsv);
  }

  test.describe('User Import Functionality', () => {
    test('should successfully import valid user CSV', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      
      // Select user import tab
      await page.click('[data-testid="import-users-tab"]');
      
      // Upload valid CSV file
      const filePath = path.join(testFilesDir, 'valid-users.csv');
      await fileUploadHelpers.uploadFile('[data-testid="file-upload"]', filePath);
      
      // Verify file upload success
      await expect(page.locator('[data-testid="file-name"]')).toContainText('valid-users.csv');
      await expect(page.locator('[data-testid="file-size"]')).toBeVisible();
      
      // Preview should show data
      await page.click('[data-testid="preview-data"]');
      await expect(page.locator('[data-testid="preview-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="preview-row"]')).toHaveCount(3);
      
      // Verify column mapping
      await expect(page.locator('[data-testid="column-name"]')).toContainText('name');
      await expect(page.locator('[data-testid="column-email"]')).toContainText('email');
      await expect(page.locator('[data-testid="column-role"]')).toContainText('role');
      
      // Start import process
      await page.click('[data-testid="start-import"]');
      
      // Should show import progress
      await expect(page.locator('[data-testid="import-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
      
      // Wait for import completion
      await page.waitForSelector('[data-testid="import-success"]', { timeout: 30000 });
      
      // Verify success message
      await expect(page.locator('[data-testid="import-success"]')).toContainText('3 users imported successfully');
      
      // Verify import history
      await expect(page.locator('[data-testid="import-history"]')).toBeVisible();
      await expect(page.locator('[data-testid="latest-import"]')).toContainText('valid-users.csv');
    });

    test('should handle CSV file with validation errors', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-users-tab"]');
      
      // Upload invalid CSV
      const filePath = path.join(testFilesDir, 'invalid-users.csv');
      await fileUploadHelpers.uploadFile('[data-testid="file-upload"]', filePath);
      
      // Preview should show validation errors
      await page.click('[data-testid="preview-data"]');
      
      await expect(page.locator('[data-testid="validation-errors"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-list"]')).toContainText('Missing required field: role');
      await expect(page.locator('[data-testid="error-list"]')).toContainText('Missing required field: phone');
      
      // Import button should be disabled
      await expect(page.locator('[data-testid="start-import"]')).toBeDisabled();
      
      // Error summary should be shown
      await expect(page.locator('[data-testid="error-summary"]')).toContainText('2 rows have validation errors');
    });

    test('should detect and handle duplicate entries', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-users-tab"]');
      
      // Upload CSV with duplicates
      const filePath = path.join(testFilesDir, 'duplicate-users.csv');
      await fileUploadHelpers.uploadFile('[data-testid="file-upload"]', filePath);
      
      await page.click('[data-testid="preview-data"]');
      
      // Should show duplicate warnings
      await expect(page.locator('[data-testid="duplicate-warnings"]')).toBeVisible();
      await expect(page.locator('[data-testid="duplicate-count"]')).toContainText('1 duplicate entries found');
      
      // Should offer duplicate handling options
      await expect(page.locator('[data-testid="duplicate-options"]')).toBeVisible();
      await expect(page.locator('[data-testid="skip-duplicates"]')).toBeVisible();
      await expect(page.locator('[data-testid="update-duplicates"]')).toBeVisible();
      await expect(page.locator('[data-testid="cancel-import"]')).toBeVisible();
      
      // Select skip duplicates option
      await page.click('[data-testid="skip-duplicates"]');
      await page.click('[data-testid="start-import"]');
      
      await page.waitForSelector('[data-testid="import-success"]', { timeout: 30000 });
      
      // Should import only unique entries
      await expect(page.locator('[data-testid="import-success"]')).toContainText('2 users imported');
      await expect(page.locator('[data-testid="skipped-count"]')).toContainText('1 duplicates skipped');
    });

    test('should handle large file imports with progress tracking', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-users-tab"]');
      
      // Upload large CSV file
      const filePath = path.join(testFilesDir, 'large-users.csv');
      await fileUploadHelpers.uploadFile('[data-testid="file-upload"]', filePath);
      
      // Should show file size warning for large files
      await expect(page.locator('[data-testid="large-file-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-size"]')).toContainText('KB');
      
      await page.click('[data-testid="preview-data"]');
      
      // Preview should be limited
      await expect(page.locator('[data-testid="preview-limited"]')).toContainText('Showing first 50 rows');
      
      // Start import
      await page.click('[data-testid="start-import"]');
      
      // Progress tracking
      await expect(page.locator('[data-testid="import-progress"]')).toBeVisible();
      
      // Should show detailed progress
      const progressText = page.locator('[data-testid="progress-text"]');
      await expect(progressText).toContainText('Processing...');
      
      // Progress bar should update
      await page.waitForFunction(() => {
        const progressBar = document.querySelector('[data-testid="progress-bar"]');
        return progressBar && parseInt(progressBar.style.width) > 0;
      });
      
      // Should show ETA
      await expect(page.locator('[data-testid="estimated-time"]')).toBeVisible();
      
      // Wait for completion (allow longer timeout for large file)
      await page.waitForSelector('[data-testid="import-success"]', { timeout: 120000 });
      
      await expect(page.locator('[data-testid="import-success"]')).toContainText('1000 users imported');
    });

    test('should reject invalid file formats', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-users-tab"]');
      
      // Try to upload non-CSV file
      const filePath = path.join(testFilesDir, 'invalid-format.txt');
      await fileUploadHelpers.uploadFile('[data-testid="file-upload"]', filePath);
      
      // Should show format error
      await expect(page.locator('[data-testid="format-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="format-error"]')).toContainText('Only CSV and XLSX files are supported');
      
      // Preview and import buttons should be disabled
      await expect(page.locator('[data-testid="preview-data"]')).toBeDisabled();
      await expect(page.locator('[data-testid="start-import"]')).toBeDisabled();
    });
  });

  test.describe('Attendance Records Import', () => {
    test('should import attendance records successfully', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-attendance-tab"]');
      
      // Upload attendance CSV
      const filePath = path.join(testFilesDir, 'valid-attendance.csv');
      await fileUploadHelpers.uploadFile('[data-testid="attendance-file-upload"]', filePath);
      
      // Configure import settings
      await page.selectOption('[data-testid="date-format"]', 'YYYY-MM-DD');
      await page.check('[data-testid="validate-students"]'); // Validate student IDs exist
      
      await page.click('[data-testid="preview-attendance-data"]');
      
      // Should show attendance preview
      await expect(page.locator('[data-testid="attendance-preview-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="attendance-preview-row"]')).toHaveCount(3);
      
      // Start import
      await page.click('[data-testid="start-attendance-import"]');
      
      await page.waitForSelector('[data-testid="attendance-import-success"]', { timeout: 30000 });
      
      // Verify import results
      await expect(page.locator('[data-testid="attendance-import-success"]')).toContainText('3 attendance records imported');
    });

    test('should validate student IDs during attendance import', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      // Create attendance file with invalid student ID
      const invalidAttendanceCsv = `studentId,date,status,notes
INVALID_ID,2024-01-15,present,Should fail validation
ST001,2024-01-15,present,Valid record`;
      
      const invalidFilePath = path.join(testFilesDir, 'invalid-attendance.csv');
      await fs.writeFile(invalidFilePath, invalidAttendanceCsv);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-attendance-tab"]');
      
      await fileUploadHelpers.uploadFile('[data-testid="attendance-file-upload"]', invalidFilePath);
      
      await page.check('[data-testid="validate-students"]');
      await page.click('[data-testid="preview-attendance-data"]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="attendance-validation-errors"]')).toBeVisible();
      await expect(page.locator('[data-testid="invalid-student-ids"]')).toContainText('INVALID_ID');
      
      // Should offer options to continue or fix
      await expect(page.locator('[data-testid="continue-with-valid"]')).toBeVisible();
      await expect(page.locator('[data-testid="fix-errors"]')).toBeVisible();
      
      // Continue with valid records only
      await page.click('[data-testid="continue-with-valid"]');
      await page.click('[data-testid="start-attendance-import"]');
      
      await page.waitForSelector('[data-testid="attendance-import-success"]', { timeout: 30000 });
      
      // Should import only valid records
      await expect(page.locator('[data-testid="attendance-import-success"]')).toContainText('1 attendance records imported');
      await expect(page.locator('[data-testid="skipped-invalid"]')).toContainText('1 records skipped');
    });
  });

  test.describe('Excel (XLSX) File Support', () => {
    test('should handle XLSX file uploads', async ({ page }) => {
      // Note: In a real implementation, you'd create actual XLSX files
      // For this test, we'll simulate XLSX support
      
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-users-tab"]');
      
      // Mock XLSX file upload
      await page.evaluate(() => {
        // Simulate XLSX file selection
        const fileInput = document.querySelector('[data-testid="file-upload"]');
        const mockFile = new File(['mock xlsx content'], 'users.xlsx', { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        // Create a mock FileList
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(mockFile);
        fileInput.files = dataTransfer.files;
        
        // Trigger change event
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      // Should detect XLSX format
      await expect(page.locator('[data-testid="file-format"]')).toContainText('XLSX');
      
      // Should show XLSX-specific options
      await expect(page.locator('[data-testid="sheet-selector"]')).toBeVisible();
      await expect(page.locator('[data-testid="header-row-option"]')).toBeVisible();
    });
  });

  test.describe('Import History and Management', () => {
    test('should maintain import history', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      
      // Check import history section
      await page.click('[data-testid="import-history-tab"]');
      
      // Should show previous imports
      await expect(page.locator('[data-testid="history-table"]')).toBeVisible();
      
      // Should show import details
      const historyRows = page.locator('[data-testid="history-row"]');
      const firstRow = historyRows.first();
      
      await expect(firstRow.locator('[data-testid="import-date"]')).toBeVisible();
      await expect(firstRow.locator('[data-testid="import-file-name"]')).toBeVisible();
      await expect(firstRow.locator('[data-testid="import-status"]')).toBeVisible();
      await expect(firstRow.locator('[data-testid="imported-count"]')).toBeVisible();
    });

    test('should allow viewing import details', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-history-tab"]');
      
      // Click on an import to view details
      await page.click('[data-testid="history-row"]:first-child [data-testid="view-details"]');
      
      // Should show import details modal
      await expect(page.locator('[data-testid="import-details-modal"]')).toBeVisible();
      
      // Should show detailed information
      await expect(page.locator('[data-testid="import-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="import-errors"]')).toBeVisible();
      await expect(page.locator('[data-testid="imported-data-preview"]')).toBeVisible();
    });

    test('should allow rollback of recent imports', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-history-tab"]');
      
      // Should show rollback option for recent imports
      const recentImport = page.locator('[data-testid="history-row"]:first-child');
      await expect(recentImport.locator('[data-testid="rollback-btn"]')).toBeVisible();
      
      // Click rollback
      await recentImport.locator('[data-testid="rollback-btn"]').click();
      
      // Should show rollback confirmation
      await expect(page.locator('[data-testid="rollback-confirmation"]')).toBeVisible();
      await expect(page.locator('[data-testid="rollback-warning"]')).toContainText('This will permanently delete');
      
      // Confirm rollback
      await page.fill('[data-testid="rollback-reason"]', 'Test rollback');
      await page.click('[data-testid="confirm-rollback"]');
      
      // Should show rollback progress
      await expect(page.locator('[data-testid="rollback-progress"]')).toBeVisible();
      
      // Wait for completion
      await page.waitForSelector('[data-testid="rollback-success"]', { timeout: 30000 });
      
      await expect(page.locator('[data-testid="rollback-success"]')).toContainText('Rollback completed successfully');
    });
  });

  test.describe('Bulk Operations via Import', () => {
    test('should support bulk user updates via import', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      // Create update CSV file
      const updateCsv = `email,role,phone
john.doe@example.com,coreTeam,9876543210
jane.smith@example.com,student,8765432109`;
      
      const updateFilePath = path.join(testFilesDir, 'user-updates.csv');
      await fs.writeFile(updateFilePath, updateCsv);
      
      await page.goto('/import-export');
      await page.click('[data-testid="bulk-operations-tab"]');
      
      // Select update operation
      await page.selectOption('[data-testid="operation-type"]', 'update');
      await page.selectOption('[data-testid="update-target"]', 'users');
      
      await fileUploadHelpers.uploadFile('[data-testid="bulk-file-upload"]', updateFilePath);
      
      // Configure update settings
      await page.selectOption('[data-testid="match-field"]', 'email');
      await page.check('[data-testid="update-role"]');
      await page.check('[data-testid="update-phone"]');
      
      await page.click('[data-testid="preview-bulk-operation"]');
      
      // Should show update preview
      await expect(page.locator('[data-testid="bulk-preview-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="changes-summary"]')).toContainText('2 users will be updated');
      
      await page.click('[data-testid="execute-bulk-operation"]');
      
      await page.waitForSelector('[data-testid="bulk-operation-success"]', { timeout: 30000 });
      
      await expect(page.locator('[data-testid="bulk-operation-success"]')).toContainText('2 users updated successfully');
    });

    test('should handle bulk delete operations safely', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      // Create delete list CSV
      const deleteCsv = `email
user1@example.com
user2@example.com`;
      
      const deleteFilePath = path.join(testFilesDir, 'users-to-delete.csv');
      await fs.writeFile(deleteFilePath, deleteCsv);
      
      await page.goto('/import-export');
      await page.click('[data-testid="bulk-operations-tab"]');
      
      // Select delete operation
      await page.selectOption('[data-testid="operation-type"]', 'delete');
      await page.selectOption('[data-testid="delete-target"]', 'users');
      
      await fileUploadHelpers.uploadFile('[data-testid="bulk-file-upload"]', deleteFilePath);
      
      // Should show safety warnings
      await expect(page.locator('[data-testid="delete-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-warning"]')).toContainText('This operation cannot be undone');
      
      // Should require additional confirmation
      await page.check('[data-testid="confirm-understand-delete"]');
      await page.fill('[data-testid="delete-confirmation-text"]', 'DELETE');
      
      await page.click('[data-testid="preview-bulk-operation"]');
      
      // Should show delete preview with warnings
      await expect(page.locator('[data-testid="delete-preview-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-count"]')).toContainText('2 users will be deleted');
      
      // Should show additional safety checks
      await expect(page.locator('[data-testid="safety-checks"]')).toBeVisible();
      await expect(page.locator('[data-testid="backup-recommendation"]')).toContainText('database backup');
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle network interruption during import', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-users-tab"]');
      
      // Upload large file
      const filePath = path.join(testFilesDir, 'large-users.csv');
      await fileUploadHelpers.uploadFile('[data-testid="file-upload"]', filePath);
      
      await page.click('[data-testid="preview-data"]');
      await page.click('[data-testid="start-import"]');
      
      // Wait for import to start
      await expect(page.locator('[data-testid="import-progress"]')).toBeVisible();
      
      // Simulate network interruption
      await page.context().setOffline(true);
      
      // Should detect connection loss
      await expect(page.locator('[data-testid="connection-lost"]')).toBeVisible();
      await expect(page.locator('[data-testid="import-paused"]')).toBeVisible();
      
      // Restore connection
      await page.context().setOffline(false);
      
      // Should offer to resume import
      await expect(page.locator('[data-testid="resume-import"]')).toBeVisible();
      await page.click('[data-testid="resume-import"]');
      
      // Import should continue
      await expect(page.locator('[data-testid="import-resumed"]')).toBeVisible();
      await page.waitForSelector('[data-testid="import-success"]', { timeout: 60000 });
    });

    test('should handle server errors gracefully', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-users-tab"]');
      
      // Mock server error response
      await page.route('/api/import/users', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database connection failed' })
        });
      });
      
      const filePath = path.join(testFilesDir, 'valid-users.csv');
      await fileUploadHelpers.uploadFile('[data-testid="file-upload"]', filePath);
      
      await page.click('[data-testid="preview-data"]');
      await page.click('[data-testid="start-import"]');
      
      // Should show server error
      await expect(page.locator('[data-testid="server-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Database connection failed');
      
      // Should offer retry option
      await expect(page.locator('[data-testid="retry-import"]')).toBeVisible();
      
      // Should allow downloading error report
      await expect(page.locator('[data-testid="download-error-report"]')).toBeVisible();
    });
  });

  test.describe('Performance and File Size Limits', () => {
    test('should enforce file size limits', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-users-tab"]');
      
      // Mock oversized file
      await page.evaluate(() => {
        const fileInput = document.querySelector('[data-testid="file-upload"]');
        const oversizedFile = new File(['x'.repeat(10 * 1024 * 1024)], 'oversized.csv', { 
          type: 'text/csv' 
        }); // 10MB file
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(oversizedFile);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      // Should show file size error
      await expect(page.locator('[data-testid="file-size-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-size-error"]')).toContainText('File size exceeds the maximum limit');
      
      // Should suggest file splitting
      await expect(page.locator('[data-testid="split-file-suggestion"]')).toBeVisible();
    });

    test('should show memory usage warnings for large imports', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/import-export');
      await page.click('[data-testid="import-users-tab"]');
      
      const filePath = path.join(testFilesDir, 'large-users.csv');
      await fileUploadHelpers.uploadFile('[data-testid="file-upload"]', filePath);
      
      // Should show memory warning for large files
      await expect(page.locator('[data-testid="memory-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="memory-warning"]')).toContainText('Large file detected');
      
      // Should suggest batch processing
      await expect(page.locator('[data-testid="batch-processing-option"]')).toBeVisible();
      
      // Enable batch processing
      await page.check('[data-testid="enable-batch-processing"]');
      
      // Should show batch size options
      await expect(page.locator('[data-testid="batch-size-selector"]')).toBeVisible();
      await page.selectOption('[data-testid="batch-size-selector"]', '100');
      
      await page.click('[data-testid="preview-data"]');
      await page.click('[data-testid="start-import"]');
      
      // Should show batch progress
      await expect(page.locator('[data-testid="batch-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-batch"]')).toContainText('Batch 1 of');
    });
  });

  test.describe('Cross-browser File Upload Compatibility', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`should work correctly in ${browserName}`, async ({ playwright }) => {
        if (browserName === 'webkit' && process.platform === 'linux') {
          test.skip();
        }
        
        const browser = await playwright[browserName].launch();
        const context = await browser.newContext();
        const page = await context.newPage();
        
        const auth = new AuthFixtures();
        const fileHelper = new FileUploadHelpers(page);
        
        await auth.loginAsCoreTeam(page);
        await page.goto('/import-export');
        await page.click('[data-testid="import-users-tab"]');
        
        // File upload should work in all browsers
        const filePath = path.join(testFilesDir, 'valid-users.csv');
        await fileHelper.uploadFile('[data-testid="file-upload"]', filePath);
        
        await expect(page.locator('[data-testid="file-name"]')).toContainText('valid-users.csv');
        
        await browser.close();
      });
    });
  });
});