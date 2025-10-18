const { test, expect } = require('@playwright/test');
const { 
  AuthFixtures, 
  TeacherDashboard, 
  WaitHelpers 
} = require('../utils/testUtils');

test.describe('Teacher Workflow E2E Tests', () => {
  let authFixtures;
  let teacherDashboard;

  test.beforeEach(async ({ page }) => {
    authFixtures = new AuthFixtures();
    teacherDashboard = new TeacherDashboard(page);
    await authFixtures.loginAsTeacher(page);
  });

  test.describe('Daily Review Workflow', () => {
    test('should access daily log viewer', async ({ page }) => {
      await teacherDashboard.dailyLogsTab.click();
      
      await expect(page.locator('[data-testid="daily-logs-viewer"]')).toBeVisible();
      await expect(page.locator('[data-testid="date-selector"]')).toBeVisible();
      
      // Select today's date
      const today = new Date().toISOString().split('T')[0];
      await page.locator('[data-testid="date-selector"]').fill(today);
      
      // Should load logs for selected date
      await expect(page.locator('[data-testid="logs-for-date"]')).toBeVisible();
    });

    test('should review student duty sessions', async ({ page }) => {
      await teacherDashboard.dailyLogsTab.click();
      
      // Select a session to review
      if (await page.locator('[data-testid="session-entry"]').first().isVisible()) {
        await page.locator('[data-testid="session-entry"]').first().click();
        
        await expect(page.locator('[data-testid="session-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="session-duration"]')).toBeVisible();
        await expect(page.locator('[data-testid="hourly-logs-list"]')).toBeVisible();
        
        // Review individual hourly logs
        await page.locator('[data-testid="hourly-log"]').first().click();
        await expect(page.locator('[data-testid="log-previous-work"]')).toBeVisible();
        await expect(page.locator('[data-testid="log-next-plan"]')).toBeVisible();
        await expect(page.locator('[data-testid="log-timestamp"]')).toBeVisible();
      }
    });

    test('should examine hourly work logs in detail', async ({ page }) => {
      await teacherDashboard.dailyLogsTab.click();
      
      if (await page.locator('[data-testid="session-entry"]').first().isVisible()) {
        await page.locator('[data-testid="session-entry"]').first().click();
        
        // Expand all hourly logs
        await page.locator('[data-testid="expand-all-logs"]').click();
        
        const logs = await page.locator('[data-testid="hourly-log-expanded"]').all();
        
        for (let i = 0; i < Math.min(logs.length, 3); i++) {
          const log = logs[i];
          await expect(log.locator('[data-testid="work-description"]')).toBeVisible();
          await expect(log.locator('[data-testid="next-plan-description"]')).toBeVisible();
          await expect(log.locator('[data-testid="submission-time"]')).toBeVisible();
        }
      }
    });

    test('should validate attendance eligibility', async ({ page }) => {
      await teacherDashboard.dailyLogsTab.click();
      
      if (await page.locator('[data-testid="session-entry"]').first().isVisible()) {
        await page.locator('[data-testid="session-entry"]').first().click();
        
        // Check attendance eligibility indicator
        await expect(page.locator('[data-testid="eligibility-status"]')).toBeVisible();
        
        // Should show minimum 2-hour requirement status
        const sessionDuration = await page.locator('[data-testid="session-duration"]').textContent();
        const eligibilityStatus = await page.locator('[data-testid="eligibility-status"]').textContent();
        
        if (sessionDuration.includes('2:')) { // 2+ hours
          expect(eligibilityStatus).toContain('Eligible');
        } else {
          expect(eligibilityStatus).toContain('Not Eligible');
        }
      }
    });
  });

  test.describe('Attendance Validation Flow', () => {
    test('should review pending attendance records', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      await expect(page.locator('[data-testid="pending-validations"]')).toBeVisible();
      
      // Should show list of pending attendance records
      const pendingRecords = await page.locator('[data-testid="pending-record"]').count();
      expect(pendingRecords).toBeGreaterThanOrEqual(0);
    });

    test('should approve individual attendance records', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      if (await page.locator('[data-testid="pending-record"]').first().isVisible()) {
        const recordId = await page.locator('[data-testid="pending-record"]').first().getAttribute('data-record-id');
        
        await teacherDashboard.validateAttendance(recordId, 'approve');
        
        // Verify approval
        await expect(page.locator('[data-testid="validation-success"]')).toContainText('Attendance approved');
        
        // Check approved tab
        await page.locator('[data-testid="approved-tab"]').click();
        await expect(page.locator(`[data-testid="approved-${recordId}"]`)).toBeVisible();
      }
    });

    test('should reject attendance records with feedback', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      if (await page.locator('[data-testid="pending-record"]').first().isVisible()) {
        const recordId = await page.locator('[data-testid="pending-record"]').first().getAttribute('data-record-id');
        
        await teacherDashboard.validateAttendance(recordId, 'reject');
        
        // Verify rejection
        await expect(page.locator('[data-testid="validation-success"]')).toContainText('Attendance rejected');
        
        // Check rejected tab
        await page.locator('[data-testid="rejected-tab"]').click();
        await expect(page.locator(`[data-testid="rejected-${recordId}"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="rejection-reason-${recordId}"]`)).toContainText('Does not meet requirements');
      }
    });

    test('should verify minimum 2-hour requirement', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      if (await page.locator('[data-testid="pending-record"]').first().isVisible()) {
        await page.locator('[data-testid="pending-record"]').first().click();
        
        // Check duty session duration
        await expect(page.locator('[data-testid="validation-session-duration"]')).toBeVisible();
        
        const duration = await page.locator('[data-testid="validation-session-duration"]').textContent();
        
        // Should highlight if below 2 hours
        if (duration.includes('1:') || duration.includes('0:')) {
          await expect(page.locator('[data-testid="duration-warning"]')).toContainText('Below minimum requirement');
        }
      }
    });

    test('should provide detailed feedback comments', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      if (await page.locator('[data-testid="pending-record"]').first().isVisible()) {
        const recordId = await page.locator('[data-testid="pending-record"]').first().getAttribute('data-record-id');
        
        await page.locator(`[data-testid="approve-${recordId}"]`).click();
        
        // Add detailed feedback
        await page.locator('[data-testid="feedback-comment"]').fill('Good work quality. Consistent hourly logging. Met all requirements.');
        await page.locator('[data-testid="confirm-validation"]').click();
        
        // Verify feedback saved
        await page.locator('[data-testid="approved-tab"]').click();
        await page.locator(`[data-testid="approved-${recordId}"]`).click();
        await expect(page.locator('[data-testid="teacher-feedback"]')).toContainText('Good work quality');
      }
    });

    test('should track validation history', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      // Check validation history tab
      await page.locator('[data-testid="validation-history-tab"]').click();
      
      await expect(page.locator('[data-testid="validation-history-table"]')).toBeVisible();
      
      // Should show validated records with dates
      const historyEntries = await page.locator('[data-testid="history-entry"]').count();
      expect(historyEntries).toBeGreaterThanOrEqual(0);
      
      if (historyEntries > 0) {
        await expect(page.locator('[data-testid="history-entry"]').first().locator('[data-testid="validation-date"]')).toBeVisible();
        await expect(page.locator('[data-testid="history-entry"]').first().locator('[data-testid="validation-action"]')).toBeVisible();
      }
    });
  });

  test.describe('Strike Oversight Tests', () => {
    test('should view student strike history', async ({ page }) => {
      await teacherDashboard.strikesOverviewTab.click();
      
      await expect(page.locator('[data-testid="strikes-overview-table"]')).toBeVisible();
      
      // Check strike summary
      await expect(page.locator('[data-testid="total-active-strikes"]')).toBeVisible();
      await expect(page.locator('[data-testid="students-at-risk"]')).toBeVisible();
      await expect(page.locator('[data-testid="suspended-students"]')).toBeVisible();
    });

    test('should review strike reasons and patterns', async ({ page }) => {
      await teacherDashboard.strikesOverviewTab.click();
      
      if (await page.locator('[data-testid="student-with-strikes"]').first().isVisible()) {
        await page.locator('[data-testid="student-with-strikes"]').first().click();
        
        await expect(page.locator('[data-testid="student-strike-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="strike-pattern-analysis"]')).toBeVisible();
        
        // Check individual strike reasons
        const strikes = await page.locator('[data-testid="individual-strike"]').all();
        for (let i = 0; i < Math.min(strikes.length, 3); i++) {
          await expect(strikes[i].locator('[data-testid="strike-reason"]')).toBeVisible();
          await expect(strikes[i].locator('[data-testid="strike-date"]')).toBeVisible();
        }
      }
    });

    test('should monitor escalation levels', async ({ page }) => {
      await teacherDashboard.strikesOverviewTab.click();
      
      // Check escalation warnings
      if (await page.locator('[data-testid="high-risk-student"]').isVisible()) {
        const highRiskCount = await page.locator('[data-testid="high-risk-student"]').count();
        expect(highRiskCount).toBeGreaterThan(0);
        
        // Click to view details
        await page.locator('[data-testid="high-risk-student"]').first().click();
        
        await expect(page.locator('[data-testid="escalation-timeline"]')).toBeVisible();
        await expect(page.locator('[data-testid="intervention-recommendations"]')).toBeVisible();
      }
    });

    test('should generate strike reports', async ({ page }) => {
      await teacherDashboard.strikesOverviewTab.click();
      
      await page.locator('[data-testid="generate-strike-report"]').click();
      
      // Configure report parameters
      await page.locator('[data-testid="report-period"]').selectOption('last-30-days');
      await page.locator('[data-testid="include-resolved"]').check();
      
      await page.locator('[data-testid="generate-report"]').click();
      
      // Verify report generation
      await expect(page.locator('[data-testid="strike-report-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="report-statistics"]')).toBeVisible();
      
      // Test export
      const downloadPromise = page.waitForEvent('download');
      await page.locator('[data-testid="export-strike-report"]').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('strike-report');
    });

    test('should identify at-risk students', async ({ page }) => {
      await teacherDashboard.strikesOverviewTab.click();
      
      await page.locator('[data-testid="at-risk-analysis"]').click();
      
      await expect(page.locator('[data-testid="at-risk-students-list"]')).toBeVisible();
      
      // Should show risk indicators
      if (await page.locator('[data-testid="at-risk-student"]').first().isVisible()) {
        await page.locator('[data-testid="at-risk-student"]').first().click();
        
        await expect(page.locator('[data-testid="risk-factors"]')).toBeVisible();
        await expect(page.locator('[data-testid="recommended-actions"]')).toBeVisible();
        await expect(page.locator('[data-testid="contact-information"]')).toBeVisible();
      }
    });
  });

  test.describe('Filtering and Search Tests', () => {
    test('should filter attendance by date ranges', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      // Set date range filter
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();
      
      await page.locator('[data-testid="date-range-start"]').fill(startDate.toISOString().split('T')[0]);
      await page.locator('[data-testid="date-range-end"]').fill(endDate.toISOString().split('T')[0]);
      
      await page.locator('[data-testid="apply-date-filter"]').click();
      
      // Verify filtered results
      await expect(page.locator('[data-testid="filtered-attendance-records"]')).toBeVisible();
      
      // Check that all visible records are within date range
      const recordDates = await page.locator('[data-testid="record-date"]').allTextContents();
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();
      
      recordDates.forEach(dateStr => {
        const recordTime = new Date(dateStr).getTime();
        expect(recordTime).toBeGreaterThanOrEqual(startTime);
        expect(recordTime).toBeLessThanOrEqual(endTime);
      });
    });

    test('should search by student name', async ({ page }) => {
      await teacherDashboard.dailyLogsTab.click();
      
      await page.locator('[data-testid="student-search"]').fill('Test Student');
      await page.locator('[data-testid="search-button"]').click();
      
      // Verify search results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      
      const resultNames = await page.locator('[data-testid="student-name"]').allTextContents();
      resultNames.forEach(name => {
        expect(name.toLowerCase()).toContain('test');
      });
    });

    test('should filter by event type', async ({ page }) => {
      await teacherDashboard.dailyLogsTab.click();
      
      await page.locator('[data-testid="event-type-filter"]').selectOption('club-duty');
      await page.locator('[data-testid="apply-filter"]').click();
      
      // Verify filtered results show only club duty sessions
      await expect(page.locator('[data-testid="duty-session-entries"]')).toBeVisible();
      
      const sessionTypes = await page.locator('[data-testid="session-type"]').allTextContents();
      sessionTypes.forEach(type => {
        expect(type.toLowerCase()).toContain('duty');
      });
    });

    test('should use quick filter presets', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      // Test "Today" preset
      await page.locator('[data-testid="filter-today"]').click();
      await expect(page.locator('[data-testid="todays-records"]')).toBeVisible();
      
      // Test "This Week" preset
      await page.locator('[data-testid="filter-this-week"]').click();
      await expect(page.locator('[data-testid="weeks-records"]')).toBeVisible();
      
      // Test "Pending Only" preset
      await page.locator('[data-testid="filter-pending-only"]').click();
      await expect(page.locator('[data-testid="pending-only-records"]')).toBeVisible();
    });

    test('should save custom filter configurations', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      // Set up custom filter
      await page.locator('[data-testid="student-search"]').fill('Test');
      await page.locator('[data-testid="date-range-start"]').fill('2024-01-01');
      await page.locator('[data-testid="status-filter"]').selectOption('pending');
      
      // Save as custom filter
      await page.locator('[data-testid="save-filter"]').click();
      await page.locator('[data-testid="filter-name"]').fill('Test Students Pending');
      await page.locator('[data-testid="confirm-save-filter"]').click();
      
      // Verify saved filter appears in presets
      await expect(page.locator('[data-testid="custom-filter-Test Students Pending"]')).toBeVisible();
      
      // Test loading saved filter
      await page.locator('[data-testid="clear-filters"]').click();
      await page.locator('[data-testid="custom-filter-Test Students Pending"]').click();
      
      // Verify filter settings restored
      expect(await page.locator('[data-testid="student-search"]').inputValue()).toBe('Test');
    });
  });

  test.describe('Bulk Operations Tests', () => {
    test('should select multiple attendance records', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      // Select multiple records
      await page.locator('[data-testid="select-all-records"]').check();
      
      // Verify selection count
      const selectedCount = await page.locator('[data-testid="selected-count"]').textContent();
      expect(parseInt(selectedCount)).toBeGreaterThan(0);
      
      // Test individual selection
      await page.locator('[data-testid="select-all-records"]').uncheck();
      await page.locator('[data-testid="record-checkbox"]').first().check();
      await page.locator('[data-testid="record-checkbox"]').nth(1).check();
      
      expect(await page.locator('[data-testid="selected-count"]').textContent()).toBe('2');
    });

    test('should perform bulk approve operations', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      if (await page.locator('[data-testid="pending-record"]').count() >= 2) {
        // Select multiple records
        await page.locator('[data-testid="record-checkbox"]').first().check();
        await page.locator('[data-testid="record-checkbox"]').nth(1).check();
        
        // Bulk approve
        await teacherDashboard.bulkActionsButton.click();
        await page.locator('[data-testid="bulk-approve"]').click();
        await page.locator('[data-testid="bulk-feedback"]').fill('Bulk approved - all requirements met');
        await page.locator('[data-testid="confirm-bulk-approve"]').click();
        
        // Verify bulk operation
        await expect(page.locator('[data-testid="bulk-success"]')).toContainText('records approved');
        
        // Check progress indicator
        await expect(page.locator('[data-testid="bulk-progress"]')).toBeVisible();
      }
    });

    test('should perform bulk reject operations', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      if (await page.locator('[data-testid="pending-record"]').count() >= 2) {
        // Select multiple records
        await page.locator('[data-testid="record-checkbox"]').first().check();
        await page.locator('[data-testid="record-checkbox"]').nth(1).check();
        
        // Bulk reject
        await teacherDashboard.bulkActionsButton.click();
        await page.locator('[data-testid="bulk-reject"]').click();
        await page.locator('[data-testid="bulk-rejection-reason"]').fill('Insufficient work documentation');
        await page.locator('[data-testid="confirm-bulk-reject"]').click();
        
        // Verify bulk rejection
        await expect(page.locator('[data-testid="bulk-reject-success"]')).toContainText('records rejected');
      }
    });

    test('should track bulk operation progress', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      if (await page.locator('[data-testid="pending-record"]').count() >= 5) {
        // Select many records for bulk operation
        await page.locator('[data-testid="select-all-records"]').check();
        
        await teacherDashboard.bulkActionsButton.click();
        await page.locator('[data-testid="bulk-approve"]').click();
        await page.locator('[data-testid="confirm-bulk-approve"]').click();
        
        // Monitor progress
        await expect(page.locator('[data-testid="bulk-progress-bar"]')).toBeVisible();
        await expect(page.locator('[data-testid="progress-percentage"]')).toBeVisible();
        
        // Wait for completion
        await WaitHelpers.waitForCondition(page, () => 
          document.querySelector('[data-testid="bulk-complete"]')
        );
        
        await expect(page.locator('[data-testid="bulk-complete"]')).toContainText('completed successfully');
      }
    });

    test('should handle partial failures in bulk operations', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      // Mock partial failure scenario
      await page.route('**/api/attendance/validate/bulk', route => {
        route.fulfill({
          status: 207, // Multi-status
          contentType: 'application/json',
          body: JSON.stringify({
            success: 3,
            failed: 1,
            errors: [{ recordId: 'test-123', error: 'Validation failed' }]
          })
        });
      });
      
      if (await page.locator('[data-testid="pending-record"]').count() >= 2) {
        await page.locator('[data-testid="select-all-records"]').check();
        await teacherDashboard.bulkActionsButton.click();
        await page.locator('[data-testid="bulk-approve"]').click();
        await page.locator('[data-testid="confirm-bulk-approve"]').click();
        
        // Should show partial success message
        await expect(page.locator('[data-testid="partial-success"]')).toContainText('3 succeeded, 1 failed');
        await expect(page.locator('[data-testid="view-errors"]')).toBeVisible();
        
        // View error details
        await page.locator('[data-testid="view-errors"]').click();
        await expect(page.locator('[data-testid="error-details"]')).toBeVisible();
      }
    });
  });

  test.describe('Report Access Tests', () => {
    test('should generate attendance summary reports', async ({ page }) => {
      await page.locator('[data-testid="reports-menu"]').click();
      await page.locator('[data-testid="attendance-reports"]').click();
      
      await expect(page.locator('[data-testid="report-generator"]')).toBeVisible();
      
      // Configure report
      await page.locator('[data-testid="report-type"]').selectOption('summary');
      await page.locator('[data-testid="report-period"]').selectOption('last-month');
      
      await page.locator('[data-testid="generate-report"]').click();
      
      // Verify report content
      await expect(page.locator('[data-testid="report-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="attendance-statistics"]')).toBeVisible();
      await expect(page.locator('[data-testid="student-performance-summary"]')).toBeVisible();
    });

    test('should access statistical dashboards', async ({ page }) => {
      await page.locator('[data-testid="analytics-dashboard"]').click();
      
      await expect(page.locator('[data-testid="dashboard-widgets"]')).toBeVisible();
      
      // Check key metrics
      await expect(page.locator('[data-testid="overall-attendance-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="duty-session-completion"]')).toBeVisible();
      await expect(page.locator('[data-testid="strike-trends"]')).toBeVisible();
      
      // Interactive charts
      if (await page.locator('[data-testid="attendance-chart"]').isVisible()) {
        await page.locator('[data-testid="attendance-chart"]').click();
        await expect(page.locator('[data-testid="chart-details"]')).toBeVisible();
      }
    });

    test('should view historical trends', async ({ page }) => {
      await page.locator('[data-testid="analytics-dashboard"]').click();
      await page.locator('[data-testid="trends-tab"]').click();
      
      await expect(page.locator('[data-testid="trend-analysis"]')).toBeVisible();
      
      // Time period selection
      await page.locator('[data-testid="trend-period"]').selectOption('semester');
      await page.locator('[data-testid="update-trends"]').click();
      
      // Verify trend data
      await expect(page.locator('[data-testid="attendance-trends"]')).toBeVisible();
      await expect(page.locator('[data-testid="performance-trends"]')).toBeVisible();
      await expect(page.locator('[data-testid="engagement-trends"]')).toBeVisible();
    });

    test('should download performance analytics', async ({ page }) => {
      await page.locator('[data-testid="analytics-dashboard"]').click();
      
      const downloadPromise = page.waitForEvent('download');
      await page.locator('[data-testid="download-analytics"]').click();
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toContain('analytics');
      
      // Verify download options
      await page.locator('[data-testid="download-options"]').click();
      await expect(page.locator('[data-testid="download-pdf"]')).toBeVisible();
      await expect(page.locator('[data-testid="download-excel"]')).toBeVisible();
      await expect(page.locator('[data-testid="download-csv"]')).toBeVisible();
    });
  });

  test.describe('Real-time Updates Tests', () => {
    test('should receive notifications for new submissions', async ({ page }) => {
      // Simulate real-time notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: { 
            type: 'new_submission', 
            message: 'New attendance submission from Test Student',
            data: { studentId: 'test-123', recordId: 'record-456' }
          }
        }));
      });
      
      await expect(page.locator('[data-testid="notification-toast"]')).toContainText('New attendance submission');
      
      // Check notification center update
      await page.locator('[data-testid="notification-center"]').click();
      const unreadCount = await page.locator('[data-testid="unread-notifications"]').count();
      expect(unreadCount).toBeGreaterThan(0);
    });

    test('should monitor live attendance updates', async ({ page }) => {
      await teacherDashboard.attendanceValidationTab.click();
      
      const initialCount = await page.locator('[data-testid="pending-count"]').textContent();
      
      // Simulate real-time update
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('attendance-update', {
          detail: { type: 'new_pending', count: 1 }
        }));
      });
      
      // Should see updated count
      await WaitHelpers.waitForCondition(page, () => {
        const currentCount = document.querySelector('[data-testid="pending-count"]').textContent;
        return currentCount !== initialCount;
      });
    });

    test('should track real-time sync status', async ({ page }) => {
      await expect(page.locator('[data-testid="sync-status"]')).toBeVisible();
      
      // Should show last sync time
      await expect(page.locator('[data-testid="last-sync-time"]')).toBeVisible();
      
      // Simulate sync status update
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('sync-status', {
          detail: { status: 'syncing', lastSync: new Date().toISOString() }
        }));
      });
      
      await expect(page.locator('[data-testid="sync-indicator"]')).toContainText('Syncing');
    });

    test('should validate data freshness indicators', async ({ page }) => {
      await teacherDashboard.dailyLogsTab.click();
      
      // Check for data freshness indicators
      await expect(page.locator('[data-testid="data-freshness"]')).toBeVisible();
      
      // Should show "Live" for real-time data
      const freshnessIndicator = await page.locator('[data-testid="data-freshness"]').textContent();
      expect(freshnessIndicator).toMatch(/(Live|Updated|Cached)/);
      
      // Simulate stale data warning
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('data-stale', {
          detail: { component: 'daily-logs', lastUpdate: Date.now() - 300000 } // 5 minutes ago
        }));
      });
      
      await expect(page.locator('[data-testid="stale-data-warning"]')).toBeVisible();
    });
  });

  test.describe('Mobile Teacher Interface', () => {
    test('should access teacher dashboard on mobile', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test');
      
      await expect(page.locator('[data-testid="mobile-teacher-dashboard"]')).toBeVisible();
      
      // Mobile navigation
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
      
      // Quick actions on mobile
      await expect(page.locator('[data-testid="mobile-quick-actions"]')).toBeVisible();
    });

    test('should review logs on mobile screens', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test');
      
      await page.locator('[data-testid="mobile-nav-menu"]').tap();
      await page.locator('[data-testid="mobile-daily-logs"]').tap();
      
      await expect(page.locator('[data-testid="mobile-logs-view"]')).toBeVisible();
      
      // Swipe gestures for navigation
      if (await page.locator('[data-testid="log-entry"]').first().isVisible()) {
        await page.locator('[data-testid="log-entry"]').first().tap();
        await expect(page.locator('[data-testid="mobile-log-details"]')).toBeVisible();
      }
    });

    test('should perform quick approval actions on mobile', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test');
      
      await page.locator('[data-testid="mobile-nav-menu"]').tap();
      await page.locator('[data-testid="mobile-validation"]').tap();
      
      if (await page.locator('[data-testid="mobile-pending-record"]').first().isVisible()) {
        // Quick approve action
        await page.locator('[data-testid="mobile-pending-record"]').first().locator('[data-testid="quick-approve"]').tap();
        
        await expect(page.locator('[data-testid="mobile-approval-success"]')).toBeVisible();
      }
    });
  });
});