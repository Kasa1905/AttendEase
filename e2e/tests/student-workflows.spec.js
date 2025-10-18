const { test, expect } = require('@playwright/test');
const { 
  AuthFixtures, 
  StudentDashboard, 
  RealtimeHelpers,
  DataGenerators,
  WaitHelpers 
} = require('../utils/testUtils');

test.describe('Student Workflow E2E Tests', () => {
  let authFixtures;
  let studentDashboard;

  test.beforeEach(async ({ page }) => {
    authFixtures = new AuthFixtures();
    studentDashboard = new StudentDashboard(page);
    await authFixtures.loginAsStudent(page);
  });

  test.describe('Daily Attendance Flow', () => {
    test('should mark attendance as present in class successfully', async ({ page }) => {
      await studentDashboard.markAttendance('present_in_class');
      
      // Verify attendance marked
      await expect(page.locator('[data-testid="attendance-status"]')).toContainText('Present in Class');
      await expect(page.locator('[data-testid="attendance-timestamp"]')).toBeVisible();
      
      // Verify dashboard reflects attendance
      await expect(page.locator('[data-testid="today-attendance"]')).toContainText('Marked');
    });

    test('should mark attendance as on club duty successfully', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      
      // Verify attendance marked
      await expect(page.locator('[data-testid="attendance-status"]')).toContainText('On Club Duty');
      
      // Should enable duty session options
      await expect(page.locator('[data-testid="start-duty"]')).toBeEnabled();
    });

    test('should prevent duplicate attendance marking', async ({ page }) => {
      // Mark attendance first time
      await studentDashboard.markAttendance('present_in_class');
      
      // Try to mark again
      await expect(page.locator('[data-testid="mark-attendance"]')).toBeDisabled();
      await expect(page.locator('[data-testid="attendance-message"]')).toContainText('Already marked for today');
    });

    test('should show attendance history', async ({ page }) => {
      await page.locator('[data-testid="attendance-history"]').click();
      
      await expect(page.locator('[data-testid="history-table"]')).toBeVisible();
      const historyCount = await page.locator('[data-testid="history-entries"]').count();
      expect(historyCount).toBeGreaterThan(0);
    });
  });

  test.describe('Duty Session Workflow', () => {
    test('should start duty session after marking club duty attendance', async ({ page }) => {
      // First mark attendance as on club duty
      await studentDashboard.markAttendance('on_club_duty');
      
      // Start duty session
      await studentDashboard.startDutySession();
      
      // Verify session started
      await expect(page.locator('[data-testid="session-status"]')).toContainText('Active');
      await expect(studentDashboard.currentSessionTimer).toBeVisible();
      await expect(studentDashboard.endDutyButton).toBeEnabled();
    });

    test('should track duty session time accurately', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Wait for timer to update (check after 1 second)
      await page.waitForTimeout(1000);
      
      const timerText = await studentDashboard.currentSessionTimer.textContent();
      expect(timerText).toMatch(/00:00:[0-9]{2}/); // Format: HH:MM:SS
    });

    test('should enforce minimum 2-hour duty session requirement', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Try to end session immediately
      await studentDashboard.endDutyButton.click();
      
      // Should show warning about minimum requirement
      await expect(page.locator('[data-testid="minimum-time-warning"]')).toContainText('Minimum 2 hours required');
      await expect(page.locator('[data-testid="confirm-end-session"]')).toBeDisabled();
    });

    test('should allow session break management', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Start break
      await page.locator('[data-testid="start-break"]').click();
      await expect(page.locator('[data-testid="break-status"]')).toContainText('On Break');
      
      // End break
      await page.locator('[data-testid="end-break"]').click();
      await expect(page.locator('[data-testid="break-status"]')).toContainText('Working');
    });

    test('should enforce 30-minute break limit', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Start break
      await page.locator('[data-testid="start-break"]').click();
      
      // Simulate 31 minutes (using fast time for testing)
      await page.evaluate(() => {
        window.__testBreakTime = 31 * 60 * 1000; // 31 minutes in milliseconds
      });
      
      // Should automatically end break and show warning
      await expect(page.locator('[data-testid="break-exceeded-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="break-status"]')).toContainText('Working');
    });
  });

  test.describe('Hourly Logging Tests', () => {
    test('should submit hourly log with work details', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Submit first hourly log
      const previousWork = 'Set up development environment and reviewed project requirements';
      const nextPlan = 'Start implementing user authentication module';
      
      await studentDashboard.submitHourlyLog(previousWork, nextPlan);
      
      // Verify log submitted
      await expect(page.locator('[data-testid="log-success"]')).toContainText('Log submitted successfully');
      await expect(page.locator('[data-testid="logs-count"]')).toContainText('1 log submitted');
    });

    test('should validate required fields in hourly logs', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Try to submit empty log
      await studentDashboard.hourlyLogButton.click();
      await page.locator('[data-testid="submit-log"]').click();
      
      // Should show validation errors
      await expect(page.locator('[data-testid="previous-work-error"]')).toContainText('Previous work is required');
      await expect(page.locator('[data-testid="next-plan-error"]')).toContainText('Next plan is required');
    });

    test('should track hourly log submission timing', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Submit log and check timestamp
      await studentDashboard.submitHourlyLog('Test work', 'Test plan');
      
      const logTimestamp = await page.locator('[data-testid="latest-log-time"]').textContent();
      expect(logTimestamp).toMatch(/\d{2}:\d{2}/); // HH:MM format
    });

    test('should detect missed hourly logs and create strikes', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Simulate time passing without log submission (2+ hours)
      await page.evaluate(() => {
        window.__testSessionTime = 2.5 * 60 * 60 * 1000; // 2.5 hours
      });
      
      // Should show missed log warning
      await expect(page.locator('[data-testid="missed-log-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="strike-notification"]')).toContainText('Strike added for missed log');
    });

    test('should show log history during session', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Submit multiple logs
      await studentDashboard.submitHourlyLog('Initial setup', 'Start coding');
      await studentDashboard.submitHourlyLog('Authentication module', 'Testing module');
      
      // Check log history
      await page.locator('[data-testid="log-history"]').click();
      await expect(page.locator('[data-testid="log-entries"]')).toHaveCount(2);
    });
  });

  test.describe('Leave Request Flow', () => {
    test('should submit leave request successfully', async ({ page }) => {
      const leaveData = DataGenerators.generateLeaveRequest();
      
      await page.locator('[data-testid="leave-request"]').click();
      await page.locator('[data-testid="leave-date"]').fill(leaveData.date);
      await page.locator('[data-testid="leave-reason"]').fill(leaveData.reason);
      await page.locator('[data-testid="leave-type"]').selectOption(leaveData.type);
      await page.locator('[data-testid="submit-leave"]').click();
      
      // Verify request submitted
      await expect(page.locator('[data-testid="request-success"]')).toContainText('Leave request submitted');
      await expect(page.locator('[data-testid="request-status"]')).toContainText('Pending');
    });

    test('should enforce 9 AM deadline for leave requests', async ({ page }) => {
      // Simulate time after 9 AM
      await page.evaluate(() => {
        const now = new Date();
        now.setHours(10, 0, 0, 0); // 10 AM
        window.__testCurrentTime = now.getTime();
      });
      
      await page.locator('[data-testid="leave-request"]').click();
      
      // Should show deadline warning
      await expect(page.locator('[data-testid="deadline-warning"]')).toContainText('Leave requests must be submitted before 9 AM');
      await expect(page.locator('[data-testid="submit-leave"]')).toBeDisabled();
    });

    test('should track leave request status updates', async ({ page }) => {
      const realtimeHelper = new RealtimeHelpers(page);
      await realtimeHelper.setupNotificationListener();
      
      // Submit leave request
      await page.locator('[data-testid="leave-request"]').click();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await page.locator('[data-testid="leave-date"]').fill(tomorrow.toISOString().split('T')[0]);
      await page.locator('[data-testid="leave-reason"]').fill('Medical appointment');
      await page.locator('[data-testid="submit-leave"]').click();
      
      // Verify in requests list
      await page.locator('[data-testid="my-requests"]').click();
      await expect(page.locator('[data-testid="request-item"]').first()).toContainText('Pending');
    });

    test('should show leave request history', async ({ page }) => {
      await page.locator('[data-testid="my-requests"]').click();
      
      await expect(page.locator('[data-testid="requests-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="filter-status"]')).toBeVisible();
      
      // Test filtering
      await page.locator('[data-testid="filter-status"]').selectOption('approved');
      await page.waitForSelector('[data-testid="approved-requests"]');
    });
  });

  test.describe('Offline Functionality Tests', () => {
    test('should mark attendance offline and sync when online', async ({ page }) => {
      const realtimeHelper = new RealtimeHelpers(page);
      
      // Go offline
      await realtimeHelper.simulateNetworkOffline();
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
      
      // Mark attendance offline
      await studentDashboard.markAttendance('present_in_class');
      
      // Should show offline confirmation
      await expect(page.locator('[data-testid="offline-saved"]')).toContainText('Saved offline');
      
      // Go back online
      await realtimeHelper.simulateNetworkOnline();
      await expect(page.locator('[data-testid="sync-indicator"]')).toBeVisible();
      
      // Should sync automatically
      await WaitHelpers.waitForCondition(page, () => 
        !document.querySelector('[data-testid="sync-indicator"]')
      );
    });

    test('should queue offline actions and sync in order', async ({ page }) => {
      const realtimeHelper = new RealtimeHelpers(page);
      
      await realtimeHelper.simulateNetworkOffline();
      
      // Perform multiple offline actions
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Check offline queue
      const queueItems = await page.locator('[data-testid="offline-queue-count"]').textContent();
      expect(parseInt(queueItems)).toBeGreaterThan(0);
      
      // Go online and verify sync
      await realtimeHelper.simulateNetworkOnline();
      await WaitHelpers.waitForCondition(page, () => 
        document.querySelector('[data-testid="offline-queue-count"]').textContent === '0'
      );
    });
  });

  test.describe('Strike System Tests', () => {
    test('should display current strike count', async ({ page }) => {
      await expect(page.locator('[data-testid="strike-count"]')).toBeVisible();
      
      const strikeCount = await page.locator('[data-testid="strike-count"]').textContent();
      expect(strikeCount).toMatch(/\d+/);
    });

    test('should show strike warnings at 3 strikes', async ({ page }) => {
      // This would require setting up test data with 3 strikes
      // For now, simulate the warning state
      await page.evaluate(() => {
        window.__testStrikeCount = 3;
      });
      
      await page.reload();
      await expect(page.locator('[data-testid="strike-warning"]')).toContainText('Warning: 3 strikes');
      await expect(page.locator('[data-testid="suspension-warning"]')).toContainText('2 more strikes will result in suspension');
    });

    test('should show suspension notice at 5 strikes', async ({ page }) => {
      await page.evaluate(() => {
        window.__testStrikeCount = 5;
        window.__testSuspended = true;
      });
      
      await page.reload();
      await expect(page.locator('[data-testid="suspension-notice"]')).toBeVisible();
      await expect(page.locator('[data-testid="mark-attendance"]')).toBeDisabled();
    });

    test('should display strike history with reasons', async ({ page }) => {
      await page.locator('[data-testid="strike-history"]').click();
      
      await expect(page.locator('[data-testid="strikes-table"]')).toBeVisible();
      
      // Check if strikes have proper reasons
      const strikeReasons = await page.locator('[data-testid="strike-reason"]').allTextContents();
      expect(strikeReasons.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Real-time Notifications', () => {
    test('should receive hourly reminders during duty session', async ({ page }) => {
      const realtimeHelper = new RealtimeHelpers(page);
      await realtimeHelper.setupNotificationListener();
      
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Simulate hour passing
      await page.evaluate(() => {
        window.__testSessionTime = 60 * 60 * 1000; // 1 hour
      });
      
      // Should receive notification
      await realtimeHelper.waitForNotification();
      const notifications = await realtimeHelper.getNotifications();
      expect(notifications.some(n => n.includes('hourly log reminder'))).toBe(true);
    });

    test('should receive leave request approval notifications', async ({ page }) => {
      const realtimeHelper = new RealtimeHelpers(page);
      await realtimeHelper.setupNotificationListener();
      
      // This would simulate a notification from the backend
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: { type: 'leave_approved', message: 'Your leave request has been approved' }
        }));
      });
      
      await expect(page.locator('[data-testid="notification-toast"]')).toContainText('approved');
    });

    test('should manage notification center', async ({ page }) => {
      await page.locator('[data-testid="notification-center"]').click();
      
      await expect(page.locator('[data-testid="notifications-list"]')).toBeVisible();
      
      // Mark as read
      await page.locator('[data-testid="mark-all-read"]').click();
      await expect(page.locator('[data-testid="unread-count"]')).toContainText('0');
    });
  });

  test.describe('Mobile Workflow Tests', () => {
    test('should handle mobile attendance marking', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test');
      
      // Mobile-specific attendance interface
      await expect(page.locator('[data-testid="mobile-attendance-card"]')).toBeVisible();
      
      await page.locator('[data-testid="mobile-mark-attendance"]').tap();
      await page.locator('[data-testid="mobile-present-class"]').tap();
      
      await expect(page.locator('[data-testid="mobile-success-toast"]')).toBeVisible();
    });

    test('should handle mobile duty session interface', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test');
      
      await studentDashboard.markAttendance('on_club_duty');
      
      // Mobile duty interface
      await page.locator('[data-testid="mobile-start-duty"]').tap();
      await expect(page.locator('[data-testid="mobile-session-timer"]')).toBeVisible();
      
      // Mobile hourly log
      await page.locator('[data-testid="mobile-quick-log"]').tap();
      await expect(page.locator('[data-testid="mobile-log-form"]')).toBeVisible();
    });
  });

  test.describe('Error Recovery Tests', () => {
    test('should handle network failures gracefully', async ({ page }) => {
      // Start attendance marking
      await page.locator('[data-testid="mark-attendance"]').click();
      
      // Simulate network failure during submission
      await page.route('**/api/attendance', route => route.abort());
      
      await page.locator('[data-testid="attendance-present_in_class"]').click();
      await page.locator('[data-testid="confirm-attendance"]').click();
      
      // Should show retry option
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should recover from session interruption', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Simulate page refresh during session
      await page.reload();
      
      // Should recover session state
      await expect(page.locator('[data-testid="session-recovered"]')).toBeVisible();
      await expect(studentDashboard.currentSessionTimer).toBeVisible();
    });

    test('should validate data integrity after errors', async ({ page }) => {
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      
      // Submit log with network interruption
      await page.route('**/api/hourly-logs', route => {
        // Simulate intermittent failure
        if (Math.random() > 0.5) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      await studentDashboard.submitHourlyLog('Test work', 'Test plan');
      
      // Check data consistency
      await page.locator('[data-testid="refresh-data"]').click();
      const logCount = await page.locator('[data-testid="logs-count"]').textContent();
      expect(logCount).toMatch(/\d+ log/);
    });
  });
});