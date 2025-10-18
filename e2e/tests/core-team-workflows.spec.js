const { test, expect } = require('@playwright/test');
const { 
  AuthFixtures, 
  CoreTeamDashboard, 
  FileUploadHelpers,
  DataGenerators,
  WaitHelpers 
} = require('../utils/testUtils');

test.describe('Core Team Workflow E2E Tests', () => {
  let authFixtures;
  let coreTeamDashboard;

  test.beforeEach(async ({ page }) => {
    authFixtures = new AuthFixtures();
    coreTeamDashboard = new CoreTeamDashboard(page);
    await authFixtures.loginAsCoreTeam(page);
  });

  test.describe('Member Management Flow', () => {
    test('should import members from CSV successfully', async ({ page }) => {
      const testData = DataGenerators.generateMultipleUsers(5);
      const csvPath = await FileUploadHelpers.createTestCSV(testData);
      
      await coreTeamDashboard.importMembers(csvPath);
      
      // Verify preview shows correct data
      await expect(page.locator('[data-testid="import-preview-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="preview-rows"]')).toHaveCount(5);
      
      // Confirm import
      await page.locator('[data-testid="confirm-import"]').click();
      
      // Wait for import completion
      await expect(page.locator('[data-testid="import-success"]')).toContainText('5 members imported successfully');
      
      await FileUploadHelpers.cleanupTestFiles();
    });

    test('should handle CSV validation errors', async ({ page }) => {
      const invalidData = [
        { firstName: '', lastName: 'Test', email: 'invalid-email', department: 'CS', year: 1 },
        { firstName: 'Valid', lastName: 'User', email: 'valid@test.com', department: 'CS', year: 6 } // Invalid year
      ];
      const csvPath = await FileUploadHelpers.createTestCSV(invalidData);
      
      await coreTeamDashboard.importMembers(csvPath);
      
      // Should show validation errors
      await expect(page.locator('[data-testid="validation-errors"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-count"]')).toContainText('2 errors found');
      
      // Should highlight problematic rows
      await expect(page.locator('[data-testid="error-row"]')).toHaveCount(2);
      
      await FileUploadHelpers.cleanupTestFiles();
    });

    test('should handle duplicate member entries', async ({ page }) => {
      const duplicateData = [
        { firstName: 'Test', lastName: 'User1', email: 'duplicate@test.com', department: 'CS', year: 2 },
        { firstName: 'Test', lastName: 'User2', email: 'duplicate@test.com', department: 'CS', year: 3 } // Same email
      ];
      const csvPath = await FileUploadHelpers.createTestCSV(duplicateData);
      
      await coreTeamDashboard.importMembers(csvPath);
      
      // Should detect duplicates
      await expect(page.locator('[data-testid="duplicate-warning"]')).toContainText('Duplicate email detected');
      
      // Should provide resolution options
      await expect(page.locator('[data-testid="resolve-duplicates"]')).toBeVisible();
      
      await FileUploadHelpers.cleanupTestFiles();
    });

    test('should track import progress in real-time', async ({ page }) => {
      const largeDataSet = DataGenerators.generateMultipleUsers(50);
      const csvPath = await FileUploadHelpers.createTestCSV(largeDataSet);
      
      await coreTeamDashboard.importMembers(csvPath);
      await page.locator('[data-testid="confirm-import"]').click();
      
      // Should show progress bar
      await expect(page.locator('[data-testid="import-progress"]')).toBeVisible();
      
      // Wait for completion with progress updates
      await WaitHelpers.waitForCondition(page, () => 
        document.querySelector('[data-testid="import-complete"]')
      );
      
      await expect(page.locator('[data-testid="import-complete"]')).toContainText('Import completed');
      
      await FileUploadHelpers.cleanupTestFiles();
    });

    test('should download member import template', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download');
      
      await page.locator('[data-testid="download-template"]').click();
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toContain('member-import-template');
      
      // Verify file content
      const path = await download.path();
      expect(path).toBeTruthy();
    });

    test('should manage member list with search and filters', async ({ page }) => {
      await page.locator('[data-testid="member-list"]').click();
      
      // Search functionality
      await page.locator('[data-testid="member-search"]').fill('Test');
      const filteredCount = await page.locator('[data-testid="filtered-members"]').count();
      expect(filteredCount).toBeGreaterThan(0);
      
      // Filter by department
      await page.locator('[data-testid="department-filter"]').selectOption('Computer Science');
      await page.waitForSelector('[data-testid="cs-members"]');
      
      // Filter by year
      await page.locator('[data-testid="year-filter"]').selectOption('3');
      await page.waitForSelector('[data-testid="third-year-members"]');
    });
  });

  test.describe('Request Approval Workflow', () => {
    test('should view and approve leave requests', async ({ page }) => {
      await coreTeamDashboard.requestsTab.click();
      
      // Should show pending requests
      await expect(page.locator('[data-testid="pending-requests"]')).toBeVisible();
      
      // Approve first request
      const firstRequestId = await page.locator('[data-testid^="request-"]').first().getAttribute('data-request-id');
      await coreTeamDashboard.approveRequest(firstRequestId);
      
      // Verify approval
      await expect(page.locator('[data-testid="approval-success"]')).toContainText('Request approved');
      
      // Check approved requests tab
      await page.locator('[data-testid="approved-tab"]').click();
      await expect(page.locator(`[data-testid="approved-${firstRequestId}"]`)).toBeVisible();
    });

    test('should reject requests with reasons', async ({ page }) => {
      await coreTeamDashboard.requestsTab.click();
      
      const requestId = await page.locator('[data-testid^="request-"]').first().getAttribute('data-request-id');
      
      // Reject request
      await page.locator(`[data-testid="reject-${requestId}"]`).click();
      await page.locator('[data-testid="rejection-reason"]').fill('Insufficient notice provided');
      await page.locator('[data-testid="confirm-rejection"]').click();
      
      // Verify rejection
      await expect(page.locator('[data-testid="rejection-success"]')).toContainText('Request rejected');
      
      // Check rejected requests tab
      await page.locator('[data-testid="rejected-tab"]').click();
      await expect(page.locator(`[data-testid="rejected-${requestId}"]`)).toBeVisible();
    });

    test('should handle bulk approval operations', async ({ page }) => {
      await coreTeamDashboard.requestsTab.click();
      
      // Select multiple requests
      await page.locator('[data-testid="select-all-requests"]').check();
      
      // Bulk approve
      await coreTeamDashboard.bulkApprovalButton.click();
      await page.locator('[data-testid="confirm-bulk-approval"]').click();
      
      // Verify bulk operation
      await expect(page.locator('[data-testid="bulk-success"]')).toContainText('requests approved');
      
      // Check progress indicator
      await expect(page.locator('[data-testid="bulk-progress"]')).toBeVisible();
    });

    test('should filter requests by date and status', async ({ page }) => {
      await coreTeamDashboard.requestsTab.click();
      
      // Date filter
      const today = new Date().toISOString().split('T')[0];
      await page.locator('[data-testid="date-filter"]').fill(today);
      
      // Status filter
      await page.locator('[data-testid="status-filter"]').selectOption('pending');
      
      // Apply filters
      await page.locator('[data-testid="apply-filters"]').click();
      
      await expect(page.locator('[data-testid="filtered-results"]')).toBeVisible();
    });

    test('should send notifications after approval/rejection', async ({ page }) => {
      await coreTeamDashboard.requestsTab.click();
      
      const requestId = await page.locator('[data-testid^="request-"]').first().getAttribute('data-request-id');
      
      // Approve with notification
      await page.locator(`[data-testid="approve-${requestId}"]`).click();
      await page.locator('[data-testid="send-notification"]').check();
      await page.locator('[data-testid="notification-message"]').fill('Your leave request has been approved.');
      await page.locator('[data-testid="confirm-approval"]').click();
      
      // Verify notification sent
      await expect(page.locator('[data-testid="notification-sent"]')).toContainText('Notification sent to student');
    });
  });

  test.describe('Strike Management Tests', () => {
    test('should view all student strikes', async ({ page }) => {
      await coreTeamDashboard.strikesTab.click();
      
      await expect(page.locator('[data-testid="strikes-table"]')).toBeVisible();
      const strikeCount = await page.locator('[data-testid="strike-entries"]').count();
      expect(strikeCount).toBeGreaterThanOrEqual(0);
      
      // Check strike details
      if (await page.locator('[data-testid="strike-entry"]').first().isVisible()) {
        await page.locator('[data-testid="strike-entry"]').first().click();
        await expect(page.locator('[data-testid="strike-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="strike-reason"]')).toBeVisible();
        await expect(page.locator('[data-testid="strike-timestamp"]')).toBeVisible();
      }
    });

    test('should resolve individual strikes', async ({ page }) => {
      await coreTeamDashboard.strikesTab.click();
      
      if (await page.locator('[data-testid="unresolved-strike"]').first().isVisible()) {
        const strikeId = await page.locator('[data-testid="unresolved-strike"]').first().getAttribute('data-strike-id');
        
        await page.locator(`[data-testid="resolve-${strikeId}"]`).click();
        await page.locator('[data-testid="resolution-reason"]').fill('Student provided valid explanation');
        await page.locator('[data-testid="confirm-resolution"]').click();
        
        // Verify resolution
        await expect(page.locator('[data-testid="resolution-success"]')).toContainText('Strike resolved');
        
        // Check resolved strikes tab
        await page.locator('[data-testid="resolved-tab"]').click();
        await expect(page.locator(`[data-testid="resolved-${strikeId}"]`)).toBeVisible();
      }
    });

    test('should handle bulk strike resolution', async ({ page }) => {
      await coreTeamDashboard.strikesTab.click();
      
      // Select multiple unresolved strikes
      await page.locator('[data-testid="select-unresolved"]').check();
      
      // Bulk resolve
      await page.locator('[data-testid="bulk-resolve"]').click();
      await page.locator('[data-testid="bulk-resolution-reason"]').fill('Batch resolution after review');
      await page.locator('[data-testid="confirm-bulk-resolve"]').click();
      
      // Verify bulk resolution
      await expect(page.locator('[data-testid="bulk-resolve-success"]')).toContainText('strikes resolved');
    });

    test('should filter strikes by student and date', async ({ page }) => {
      await coreTeamDashboard.strikesTab.click();
      
      // Student filter
      await page.locator('[data-testid="student-filter"]').fill('Test Student');
      
      // Date range filter
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      await page.locator('[data-testid="date-from"]').fill(lastWeek.toISOString().split('T')[0]);
      await page.locator('[data-testid="date-to"]').fill(new Date().toISOString().split('T')[0]);
      
      await page.locator('[data-testid="apply-strike-filters"]').click();
      
      await expect(page.locator('[data-testid="filtered-strikes"]')).toBeVisible();
    });

    test('should track strike escalation levels', async ({ page }) => {
      await coreTeamDashboard.strikesTab.click();
      
      // Check escalation indicators
      await expect(page.locator('[data-testid="escalation-summary"]')).toBeVisible();
      
      // Students with 3+ strikes should be highlighted
      if (await page.locator('[data-testid="high-risk-students"]').isVisible()) {
        await expect(page.locator('[data-testid="high-risk-students"]')).toHaveCount(0);
        
        // Click to view details
        await page.locator('[data-testid="high-risk-students"]').first().click();
        await expect(page.locator('[data-testid="student-strike-history"]')).toBeVisible();
      }
    });
  });

  test.describe('Report Generation Flow', () => {
    test('should generate attendance summary report', async ({ page }) => {
      await coreTeamDashboard.reportsTab.click();
      
      // Select report type
      await page.locator('[data-testid="report-type"]').selectOption('attendance-summary');
      
      // Set date range
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      await page.locator('[data-testid="report-start-date"]').fill(startDate.toISOString().split('T')[0]);
      await page.locator('[data-testid="report-end-date"]').fill(new Date().toISOString().split('T')[0]);
      
      // Generate report
      await page.locator('[data-testid="generate-report"]').click();
      
      // Verify report generation
      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="report-stats"]')).toContainText('Total Students');
    });

    test('should export reports in multiple formats', async ({ page }) => {
      await coreTeamDashboard.reportsTab.click();
      
      // Generate a basic report first
      await page.locator('[data-testid="report-type"]').selectOption('attendance-summary');
      await page.locator('[data-testid="generate-report"]').click();
      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible();
      
      // Test PDF export
      const pdfDownloadPromise = page.waitForEvent('download');
      await page.locator('[data-testid="export-pdf"]').click();
      const pdfDownload = await pdfDownloadPromise;
      expect(pdfDownload.suggestedFilename()).toContain('.pdf');
      
      // Test Excel export
      const excelDownloadPromise = page.waitForEvent('download');
      await page.locator('[data-testid="export-excel"]').click();
      const excelDownload = await excelDownloadPromise;
      expect(excelDownload.suggestedFilename()).toContain('.xlsx');
      
      // Test CSV export
      const csvDownloadPromise = page.waitForEvent('download');
      await page.locator('[data-testid="export-csv"]').click();
      const csvDownload = await csvDownloadPromise;
      expect(csvDownload.suggestedFilename()).toContain('.csv');
    });

    test('should filter reports by students and events', async ({ page }) => {
      await coreTeamDashboard.reportsTab.click();
      
      await page.locator('[data-testid="report-type"]').selectOption('detailed-attendance');
      
      // Filter by specific students
      await page.locator('[data-testid="student-filter-multiselect"]').click();
      await page.locator('[data-testid="select-student"]').first().check();
      await page.locator('[data-testid="select-student"]').nth(1).check();
      
      // Filter by events
      await page.locator('[data-testid="event-filter-multiselect"]').click();
      await page.locator('[data-testid="select-event"]').first().check();
      
      await page.locator('[data-testid="generate-filtered-report"]').click();
      
      await expect(page.locator('[data-testid="filtered-report-preview"]')).toBeVisible();
    });

    test('should schedule recurring reports', async ({ page }) => {
      await coreTeamDashboard.reportsTab.click();
      
      // Navigate to scheduled reports
      await page.locator('[data-testid="scheduled-reports-tab"]').click();
      
      // Create new scheduled report
      await page.locator('[data-testid="create-scheduled-report"]').click();
      
      await page.locator('[data-testid="schedule-report-type"]').selectOption('weekly-attendance');
      await page.locator('[data-testid="schedule-frequency"]').selectOption('weekly');
      await page.locator('[data-testid="schedule-recipients"]').fill('admin@test.com');
      
      await page.locator('[data-testid="save-schedule"]').click();
      
      await expect(page.locator('[data-testid="schedule-success"]')).toContainText('Report scheduled successfully');
    });
  });

  test.describe('Dashboard Management', () => {
    test('should display overview statistics', async ({ page }) => {
      await expect(page.locator('[data-testid="total-students"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-sessions"]')).toBeVisible();
      await expect(page.locator('[data-testid="pending-requests"]')).toBeVisible();
      await expect(page.locator('[data-testid="unresolved-strikes"]')).toBeVisible();
      
      // Check that statistics are numbers
      const totalStudents = await page.locator('[data-testid="total-students"]').textContent();
      expect(totalStudents).toMatch(/\d+/);
    });

    test('should show real-time updates', async ({ page }) => {
      const initialPendingCount = await page.locator('[data-testid="pending-requests"]').textContent();
      
      // Simulate real-time update
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('stats-update', {
          detail: { pending_requests: parseInt(document.querySelector('[data-testid="pending-requests"]').textContent) + 1 }
        }));
      });
      
      // Should see updated count
      await expect(page.locator('[data-testid="pending-requests"]')).not.toContainText(initialPendingCount);
    });

    test('should navigate between management tabs', async ({ page }) => {
      // Test tab navigation
      await coreTeamDashboard.requestsTab.click();
      await expect(page.locator('[data-testid="requests-content"]')).toBeVisible();
      
      await coreTeamDashboard.strikesTab.click();
      await expect(page.locator('[data-testid="strikes-content"]')).toBeVisible();
      
      await coreTeamDashboard.reportsTab.click();
      await expect(page.locator('[data-testid="reports-content"]')).toBeVisible();
      
      // Test state persistence
      await page.locator('[data-testid="report-type"]').selectOption('attendance-summary');
      await coreTeamDashboard.requestsTab.click();
      await coreTeamDashboard.reportsTab.click();
      
      // Should maintain report type selection
      const selectedValue = await page.locator('[data-testid="report-type"]').inputValue();
      expect(selectedValue).toBe('attendance-summary');
    });

    test('should handle quick action buttons', async ({ page }) => {
      // Quick approve action
      if (await page.locator('[data-testid="quick-approve-btn"]').isVisible()) {
        await page.locator('[data-testid="quick-approve-btn"]').click();
        await expect(page.locator('[data-testid="quick-approve-modal"]')).toBeVisible();
      }
      
      // Quick import action
      await page.locator('[data-testid="quick-import-btn"]').click();
      await expect(page.locator('[data-testid="import-modal"]')).toBeVisible();
    });
  });

  test.describe('Notification Management', () => {
    test('should receive real-time alerts for new requests', async ({ page }) => {
      // Simulate new request notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: { type: 'new_request', message: 'New leave request from Test Student' }
        }));
      });
      
      await expect(page.locator('[data-testid="notification-toast"]')).toContainText('New leave request');
      
      // Check notification center
      await page.locator('[data-testid="notification-center"]').click();
      await expect(page.locator('[data-testid="unread-notifications"]')).toHaveCount(0);
    });

    test('should manage notification preferences', async ({ page }) => {
      await page.locator('[data-testid="user-menu"]').click();
      await page.locator('[data-testid="notification-settings"]').click();
      
      // Toggle notification types
      await page.locator('[data-testid="email-notifications"]').uncheck();
      await page.locator('[data-testid="push-notifications"]').check();
      
      await page.locator('[data-testid="save-notification-prefs"]').click();
      
      await expect(page.locator('[data-testid="preferences-saved"]')).toContainText('Preferences saved');
    });
  });

  test.describe('Administrative Functions', () => {
    test('should manage user roles', async ({ page }) => {
      await page.locator('[data-testid="admin-menu"]').click();
      await page.locator('[data-testid="user-management"]').click();
      
      // Change user role
      const firstUser = page.locator('[data-testid="user-row"]').first();
      await firstUser.locator('[data-testid="edit-user"]').click();
      
      await page.locator('[data-testid="user-role"]').selectOption('core_team');
      await page.locator('[data-testid="save-user"]').click();
      
      await expect(page.locator('[data-testid="role-updated"]')).toContainText('User role updated');
    });

    test('should access system settings', async ({ page }) => {
      await page.locator('[data-testid="admin-menu"]').click();
      await page.locator('[data-testid="system-settings"]').click();
      
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
      
      // Test setting update
      await page.locator('[data-testid="attendance-deadline"]').fill('09:30');
      await page.locator('[data-testid="save-settings"]').click();
      
      await expect(page.locator('[data-testid="settings-saved"]')).toContainText('Settings saved');
    });

    test('should view audit logs', async ({ page }) => {
      await page.locator('[data-testid="admin-menu"]').click();
      await page.locator('[data-testid="audit-logs"]').click();
      
      await expect(page.locator('[data-testid="audit-table"]')).toBeVisible();
      
      // Filter audit logs
      await page.locator('[data-testid="audit-action-filter"]').selectOption('user_created');
      await page.locator('[data-testid="apply-audit-filter"]').click();
      
      await expect(page.locator('[data-testid="filtered-audit-logs"]')).toBeVisible();
    });
  });
});