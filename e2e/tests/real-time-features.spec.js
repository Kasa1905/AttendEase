const { test, expect } = require('@playwright/test');
const { AuthFixtures, RealtimeHelpers, APIHelpers } = require('../utils/testUtils');

/**
 * Real-time Features E2E Tests
 * Tests WebSocket functionality, live notifications, and concurrent user interactions
 */

test.describe('Real-time Features', () => {
  let authFixtures;
  let realtimeHelpers;
  let apiHelpers;

  test.beforeEach(async ({ page, context }) => {
    authFixtures = new AuthFixtures();
    realtimeHelpers = new RealtimeHelpers(page);
    apiHelpers = new APIHelpers();
  });

  test.describe('WebSocket Connection Management', () => {
    test('should establish WebSocket connection on authentication', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Monitor WebSocket connection
      const wsConnection = await realtimeHelpers.waitForWebSocketConnection();
      expect(wsConnection).toBeTruthy();
      
      // Verify connection status in UI
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
    });

    test('should handle WebSocket disconnection gracefully', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      await realtimeHelpers.waitForWebSocketConnection();
      
      // Simulate network disconnection
      await page.context().setOffline(true);
      
      // Verify disconnection handling
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected');
      await expect(page.locator('[data-testid="offline-warning"]')).toBeVisible();
      
      // Simulate network reconnection
      await page.context().setOffline(false);
      
      // Verify reconnection
      await realtimeHelpers.waitForWebSocketConnection();
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
      await expect(page.locator('[data-testid="offline-warning"]')).toBeHidden();
    });

    test('should maintain connection across page navigation', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      await realtimeHelpers.waitForWebSocketConnection();
      
      // Navigate to different pages
      await page.click('[data-testid="nav-duty-sessions"]');
      await page.waitForURL('**/duty-sessions');
      
      // Verify connection maintained
      const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
      expect(connectionStatus).toContain('Connected');
      
      await page.click('[data-testid="nav-profile"]');
      await page.waitForURL('**/profile');
      
      // Connection should still be active
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
    });

    test('should handle multiple concurrent connections from same user', async ({ browser }) => {
      // Open multiple tabs for same user
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      
      const auth1 = new AuthFixtures();
      const auth2 = new AuthFixtures();
      const realtime1 = new RealtimeHelpers(page1);
      const realtime2 = new RealtimeHelpers(page2);
      
      // Login in both tabs
      await auth1.loginAsStudent(page1);
      await auth2.loginAsStudent(page2);
      
      // Both should establish connections
      await realtime1.waitForWebSocketConnection();
      await realtime2.waitForWebSocketConnection();
      
      // Verify both show connected status
      await expect(page1.locator('[data-testid="connection-status"]')).toContainText('Connected');
      await expect(page2.locator('[data-testid="connection-status"]')).toContainText('Connected');
      
      await context.close();
    });
  });

  test.describe('Live Notifications', () => {
    test('should receive real-time attendance notifications', async ({ browser }) => {
      // Setup: Core team member and student
      const coreTeamContext = await browser.newContext();
      const studentContext = await browser.newContext();
      
      const coreTeamPage = await coreTeamContext.newPage();
      const studentPage = await studentContext.newPage();
      
      const coreTeamAuth = new AuthFixtures();
      const studentAuth = new AuthFixtures();
      const studentRealtime = new RealtimeHelpers(studentPage);
      
      // Both users login
      await coreTeamAuth.loginAsCoreTeam(coreTeamPage);
      await studentAuth.loginAsStudent(studentPage);
      await studentRealtime.waitForWebSocketConnection();
      
      // Student should receive notification when attendance is reviewed
      const notificationPromise = studentRealtime.waitForNotification('attendance_reviewed');
      
      // Core team reviews student attendance
      await coreTeamPage.goto('/dashboard');
      await coreTeamPage.click('[data-testid="pending-attendance-review"]');
      await coreTeamPage.click('[data-testid="approve-attendance-btn"]');
      await coreTeamPage.click('[data-testid="confirm-approval"]');
      
      // Student should receive notification
      const notification = await notificationPromise;
      expect(notification.type).toBe('attendance_reviewed');
      expect(notification.status).toBe('approved');
      
      // Notification should appear in student UI
      await expect(studentPage.locator('[data-testid="notification-toast"]')).toBeVisible();
      await expect(studentPage.locator('[data-testid="notification-toast"]')).toContainText('approved');
      
      await coreTeamContext.close();
      await studentContext.close();
    });

    test('should receive strike notifications immediately', async ({ browser }) => {
      const coreTeamContext = await browser.newContext();
      const studentContext = await browser.newContext();
      
      const coreTeamPage = await coreTeamContext.newPage();
      const studentPage = await studentContext.newPage();
      
      const coreTeamAuth = new AuthFixtures();
      const studentAuth = new AuthFixtures();
      const studentRealtime = new RealtimeHelpers(studentPage);
      
      await coreTeamAuth.loginAsCoreTeam(coreTeamPage);
      await studentAuth.loginAsStudent(studentPage);
      await studentRealtime.waitForWebSocketConnection();
      
      // Listen for strike notification
      const strikeNotificationPromise = studentRealtime.waitForNotification('strike_issued');
      
      // Core team issues a strike
      await coreTeamPage.goto('/users');
      await coreTeamPage.click('[data-testid="student-row"]');
      await coreTeamPage.click('[data-testid="issue-strike-btn"]');
      await coreTeamPage.fill('[data-testid="strike-reason"]', 'Real-time test strike');
      await coreTeamPage.selectOption('[data-testid="strike-severity"]', 'minor');
      await coreTeamPage.click('[data-testid="confirm-strike"]');
      
      // Student should receive immediate notification
      const strikeNotification = await strikeNotificationPromise;
      expect(strikeNotification.type).toBe('strike_issued');
      expect(strikeNotification.severity).toBe('minor');
      
      // Verify UI updates
      await expect(studentPage.locator('[data-testid="strike-notification"]')).toBeVisible();
      await expect(studentPage.locator('[data-testid="strike-count"]')).toContainText('1');
      
      await coreTeamContext.close();
      await studentContext.close();
    });

    test('should receive leave request status updates', async ({ browser }) => {
      const studentContext = await browser.newContext();
      const coreTeamContext = await browser.newContext();
      
      const studentPage = await studentContext.newPage();
      const coreTeamPage = await coreTeamContext.newPage();
      
      const studentAuth = new AuthFixtures();
      const coreTeamAuth = new AuthFixtures();
      const studentRealtime = new RealtimeHelpers(studentPage);
      
      await studentAuth.loginAsStudent(studentPage);
      await coreTeamAuth.loginAsCoreTeam(coreTeamPage);
      await studentRealtime.waitForWebSocketConnection();
      
      // Student submits leave request
      await studentPage.goto('/leave-requests');
      await studentPage.click('[data-testid="new-leave-request"]');
      await studentPage.fill('[data-testid="leave-reason"]', 'Real-time test leave');
      await studentPage.fill('[data-testid="leave-start-date"]', '2024-12-25');
      await studentPage.fill('[data-testid="leave-end-date"]', '2024-12-25');
      await studentPage.click('[data-testid="submit-leave-request"]');
      
      // Wait for notification listener
      const approvalNotificationPromise = studentRealtime.waitForNotification('leave_request_approved');
      
      // Core team approves the request
      await coreTeamPage.goto('/leave-requests');
      await coreTeamPage.click('[data-testid="pending-request"]');
      await coreTeamPage.click('[data-testid="approve-request"]');
      await coreTeamPage.click('[data-testid="confirm-approval"]');
      
      // Student should receive approval notification
      const approvalNotification = await approvalNotificationPromise;
      expect(approvalNotification.type).toBe('leave_request_approved');
      
      await expect(studentPage.locator('[data-testid="approval-notification"]')).toBeVisible();
      
      await studentContext.close();
      await coreTeamContext.close();
    });

    test('should handle notification queue during offline periods', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      await realtimeHelpers.waitForWebSocketConnection();
      
      // Go offline
      await page.context().setOffline(true);
      
      // Simulate notifications being queued (would need API call or external trigger)
      await apiHelpers.makeAPICall('/api/notifications/test-queue', 'POST', {
        userId: 'test-student-id',
        notifications: [
          { type: 'attendance_reviewed', data: { status: 'approved' } },
          { type: 'duty_reminder', data: { message: 'Duty session starting soon' } }
        ]
      });
      
      // Come back online
      await page.context().setOffline(false);
      await realtimeHelpers.waitForWebSocketConnection();
      
      // Should receive queued notifications
      await expect(page.locator('[data-testid="notification-toast"]')).toHaveCount(2);
    });
  });

  test.describe('Real-time Dashboard Updates', () => {
    test('should update attendance stats in real-time', async ({ browser }) => {
      const coreTeamContext = await browser.newContext();
      const teacherContext = await browser.newContext();
      
      const coreTeamPage = await coreTeamContext.newPage();
      const teacherPage = await teacherContext.newPage();
      
      const coreTeamAuth = new AuthFixtures();
      const teacherAuth = new AuthFixtures();
      const teacherRealtime = new RealtimeHelpers(teacherPage);
      
      await coreTeamAuth.loginAsCoreTeam(coreTeamPage);
      await teacherAuth.loginAsTeacher(teacherPage);
      await teacherRealtime.waitForWebSocketConnection();
      
      // Teacher monitors dashboard stats
      await teacherPage.goto('/dashboard');
      const initialStats = await teacherPage.locator('[data-testid="attendance-stats"]').textContent();
      
      // Core team approves attendance
      await coreTeamPage.goto('/dashboard');
      await coreTeamPage.click('[data-testid="approve-pending-attendance"]');
      
      // Teacher dashboard should update automatically
      await expect(teacherPage.locator('[data-testid="attendance-stats"]')).not.toContainText(initialStats);
      
      await coreTeamContext.close();
      await teacherContext.close();
    });

    test('should show live user activity status', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      const auth1 = new AuthFixtures();
      const auth2 = new AuthFixtures();
      const realtime1 = new RealtimeHelpers(page1);
      
      // Both users login as core team to see user activity
      await auth1.loginAsCoreTeam(page1);
      await auth2.loginAsStudent(page2);
      await realtime1.waitForWebSocketConnection();
      
      // Check user activity dashboard
      await page1.goto('/dashboard');
      await expect(page1.locator('[data-testid="active-users-count"]')).toContainText('2');
      
      // Second user logs out
      await page2.click('[data-testid="logout-btn"]');
      
      // Activity count should decrease
      await expect(page1.locator('[data-testid="active-users-count"]')).toContainText('1');
      
      await context1.close();
      await context2.close();
    });

    test('should update duty session status in real-time', async ({ browser }) => {
      const studentContext = await browser.newContext();
      const coreTeamContext = await browser.newContext();
      
      const studentPage = await studentContext.newPage();
      const coreTeamPage = await coreTeamContext.newPage();
      
      const studentAuth = new AuthFixtures();
      const coreTeamAuth = new AuthFixtures();
      const coreTeamRealtime = new RealtimeHelpers(coreTeamPage);
      
      await studentAuth.loginAsStudent(studentPage);
      await coreTeamAuth.loginAsCoreTeam(coreTeamPage);
      await coreTeamRealtime.waitForWebSocketConnection();
      
      // Core team monitors duty sessions
      await coreTeamPage.goto('/duty-sessions');
      
      // Student starts duty session
      await studentPage.goto('/duty-sessions');
      await studentPage.click('[data-testid="start-duty-btn"]');
      await studentPage.fill('[data-testid="duty-notes"]', 'Starting real-time test duty');
      await studentPage.click('[data-testid="confirm-start-duty"]');
      
      // Core team should see live update
      await expect(coreTeamPage.locator('[data-testid="active-duty-sessions"]')).toContainText('1 active');
      await expect(coreTeamPage.locator('[data-testid="duty-session-row"]')).toBeVisible();
      
      // Student ends duty session
      await studentPage.click('[data-testid="end-duty-btn"]');
      await studentPage.fill('[data-testid="completion-notes"]', 'Ending duty session');
      await studentPage.click('[data-testid="confirm-end-duty"]');
      
      // Core team should see update
      await expect(coreTeamPage.locator('[data-testid="active-duty-sessions"]')).toContainText('0 active');
      
      await studentContext.close();
      await coreTeamContext.close();
    });
  });

  test.describe('Concurrent User Interactions', () => {
    test('should handle simultaneous attendance marking', async ({ browser }) => {
      // Create multiple student contexts
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ]);
      
      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );
      
      const auths = pages.map((page, index) => new AuthFixtures());
      
      // All students login
      await Promise.all(auths.map((auth, index) => auth.loginAsStudent(pages[index])));
      
      // All students mark attendance simultaneously
      const attendancePromises = pages.map(async (page, index) => {
        await page.goto('/attendance');
        await page.click('[data-testid="mark-present"]');
        await page.fill('[data-testid="attendance-notes"]', `Student ${index + 1} concurrent test`);
        await page.click('[data-testid="submit-attendance"]');
        return page.waitForSelector('[data-testid="attendance-success"]');
      });
      
      // All should succeed
      await Promise.all(attendancePromises);
      
      // Verify all submissions were recorded
      for (let i = 0; i < pages.length; i++) {
        await expect(pages[i].locator('[data-testid="attendance-success"]')).toBeVisible();
      }
      
      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    });

    test('should handle concurrent report generation', async ({ browser }) => {
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext()
      ]);
      
      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );
      
      const auths = pages.map((page, index) => new AuthFixtures());
      
      // Both core team members login
      await Promise.all(auths.map((auth, index) => auth.loginAsCoreTeam(pages[index])));
      
      // Both generate reports simultaneously
      const reportPromises = pages.map(async (page, index) => {
        await page.goto('/reports');
        await page.selectOption('[data-testid="report-type"]', 'attendance-summary');
        await page.fill('[data-testid="start-date"]', '2024-01-01');
        await page.fill('[data-testid="end-date"]', '2024-12-31');
        await page.click('[data-testid="generate-report"]');
        
        // Wait for report completion
        await page.waitForSelector('[data-testid="report-ready"]', { timeout: 30000 });
      });
      
      // Both should complete successfully
      await Promise.all(reportPromises);
      
      await Promise.all(contexts.map(context => context.close()));
    });

    test('should handle race conditions in duty session management', async ({ browser }) => {
      const studentContext = await browser.newContext();
      const coreTeamContext = await browser.newContext();
      
      const studentPage = await studentContext.newPage();
      const coreTeamPage = await coreTeamContext.newPage();
      
      const studentAuth = new AuthFixtures();
      const coreTeamAuth = new AuthFixtures();
      
      await studentAuth.loginAsStudent(studentPage);
      await coreTeamAuth.loginAsCoreTeam(coreTeamPage);
      
      // Student starts duty session
      await studentPage.goto('/duty-sessions');
      const startDutyPromise = studentPage.click('[data-testid="start-duty-btn"]');
      
      // Core team tries to modify student status simultaneously
      await coreTeamPage.goto('/users');
      await coreTeamPage.click('[data-testid="student-row"]');
      const modifyStatusPromise = coreTeamPage.click('[data-testid="suspend-user"]');
      
      // Handle race condition gracefully
      await Promise.allSettled([startDutyPromise, modifyStatusPromise]);
      
      // System should handle the conflict appropriately
      const errorMessage = await studentPage.locator('[data-testid="error-message"]');
      const conflictResolution = await coreTeamPage.locator('[data-testid="conflict-resolution"]');
      
      // Either student gets error or core team gets conflict resolution
      const hasError = await errorMessage.count() > 0;
      const hasConflict = await conflictResolution.count() > 0;
      
      expect(hasError || hasConflict).toBeTruthy();
      
      await studentContext.close();
      await coreTeamContext.close();
    });
  });

  test.describe('WebSocket Performance', () => {
    test('should handle high-frequency notifications', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      await realtimeHelpers.waitForWebSocketConnection();
      
      // Monitor notification performance
      const notificationTimes = [];
      
      await page.evaluate(() => {
        window.notificationReceived = (timestamp) => {
          window.notificationTimes = window.notificationTimes || [];
          window.notificationTimes.push(timestamp);
        };
      });
      
      // Generate high-frequency notifications via API
      for (let i = 0; i < 50; i++) {
        await apiHelpers.makeAPICall('/api/notifications/test', 'POST', {
          type: 'test_notification',
          message: `Test message ${i}`,
          timestamp: Date.now()
        });
      }
      
      // Wait for all notifications to be received
      await page.waitForFunction(() => window.notificationTimes && window.notificationTimes.length >= 50, 
        { timeout: 10000 });
      
      const times = await page.evaluate(() => window.notificationTimes);
      
      // Verify performance (all notifications received within 5 seconds)
      const firstNotification = times[0];
      const lastNotification = times[times.length - 1];
      expect(lastNotification - firstNotification).toBeLessThan(5000);
    });

    test('should maintain connection stability under load', async ({ browser }) => {
      // Create multiple connections
      const contexts = [];
      const pages = [];
      
      for (let i = 0; i < 10; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
        
        const auth = new AuthFixtures();
        await auth.loginAsStudent(page);
      }
      
      // All should maintain stable connections
      const connectionPromises = pages.map(async (page) => {
        const realtime = new RealtimeHelpers(page);
        await realtime.waitForWebSocketConnection();
        
        // Monitor connection for 30 seconds
        let connectionDropped = false;
        
        page.on('websocket', ws => {
          ws.on('close', () => {
            connectionDropped = true;
          });
        });
        
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        return connectionDropped;
      });
      
      const results = await Promise.all(connectionPromises);
      
      // Most connections should remain stable (allow 1-2 drops)
      const droppedConnections = results.filter(dropped => dropped).length;
      expect(droppedConnections).toBeLessThan(3);
      
      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    });
  });

  test.describe('Cross-browser Real-time Compatibility', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`should work correctly in ${browserName}`, async ({ playwright }) => {
        if (browserName === 'webkit' && process.platform === 'linux') {
          test.skip();
        }
        
        const browser = await playwright[browserName].launch();
        const context = await browser.newContext();
        const page = await context.newPage();
        
        const auth = new AuthFixtures();
        const realtime = new RealtimeHelpers(page);
        
        await auth.loginAsStudent(page);
        
        // WebSocket should connect in all browsers
        const connection = await realtime.waitForWebSocketConnection();
        expect(connection).toBeTruthy();
        
        // Basic real-time functionality should work
        await page.goto('/dashboard');
        await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
        
        await browser.close();
      });
    });
  });
});