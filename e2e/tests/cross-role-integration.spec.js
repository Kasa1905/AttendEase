const { test, expect } = require('@playwright/test');
const { 
  AuthFixtures, 
  StudentDashboard,
  CoreTeamDashboard,
  TeacherDashboard,
  RealtimeHelpers,
  DataGenerators,
  WaitHelpers 
} = require('../utils/testUtils');

test.describe('Cross-Role Integration E2E Tests', () => {
  let authFixtures;
  let studentPage, coreTeamPage, teacherPage;
  let studentDashboard, coreTeamDashboard, teacherDashboard;

  test.beforeAll(async ({ browser }) => {
    // Create separate browser contexts for different roles
    const studentContext = await browser.newContext();
    const coreTeamContext = await browser.newContext();
    const teacherContext = await browser.newContext();

    studentPage = await studentContext.newPage();
    coreTeamPage = await coreTeamContext.newPage();
    teacherPage = await teacherContext.newPage();

    authFixtures = new AuthFixtures();
    studentDashboard = new StudentDashboard(studentPage);
    coreTeamDashboard = new CoreTeamDashboard(coreTeamPage);
    teacherDashboard = new TeacherDashboard(teacherPage);

    // Login all roles
    await authFixtures.loginAsStudent(studentPage);
    await authFixtures.loginAsCoreTeam(coreTeamPage);
    await authFixtures.loginAsTeacher(teacherPage);
  });

  test.afterAll(async () => {
    await studentPage.close();
    await coreTeamPage.close();
    await teacherPage.close();
  });

  test.describe('Complete Attendance Cycle', () => {
    test('should handle full attendance workflow across all roles', async () => {
      // Step 1: Student marks duty attendance
      await studentDashboard.markAttendance('on_club_duty');
      await expect(studentPage.locator('[data-testid="attendance-status"]')).toContainText('On Club Duty');

      // Step 2: Student starts duty session
      await studentDashboard.startDutySession();
      await expect(studentPage.locator('[data-testid="session-status"]')).toContainText('Active');

      // Step 3: Student logs hourly work
      await studentDashboard.submitHourlyLog('Initial project setup and environment configuration', 'Begin implementing core features');
      await expect(studentPage.locator('[data-testid="log-success"]')).toContainText('Log submitted successfully');

      // Step 4: Student ends duty session (simulate 2+ hour session)
      await studentPage.evaluate(() => {
        window.__testSessionTime = 2.5 * 60 * 60 * 1000; // 2.5 hours
      });
      await studentDashboard.endDutyButton.click();
      await studentPage.locator('[data-testid="confirm-end-session"]').click();

      // Step 5: Teacher reviews submission
      await teacherDashboard.attendanceValidationTab.click();
      await teacherPage.waitForSelector('[data-testid="pending-record"]');
      
      if (await teacherPage.locator('[data-testid="pending-record"]').first().isVisible()) {
        const recordId = await teacherPage.locator('[data-testid="pending-record"]').first().getAttribute('data-record-id');
        
        // Step 6: Teacher approves attendance
        await teacherDashboard.validateAttendance(recordId, 'approve');
        await expect(teacherPage.locator('[data-testid="validation-success"]')).toContainText('Attendance approved');

        // Step 7: Verify all parties receive notifications
        await WaitHelpers.waitForCondition(studentPage, () => 
          document.querySelector('[data-testid="notification-toast"]')
        );
        await expect(studentPage.locator('[data-testid="notification-toast"]')).toContainText('approved');

        // Step 8: Verify data consistency across dashboards
        await studentPage.locator('[data-testid="attendance-history"]').click();
        await expect(studentPage.locator('[data-testid="approved-attendance"]').first()).toBeVisible();
        
        await teacherPage.locator('[data-testid="approved-tab"]').click();
        await expect(teacherPage.locator(`[data-testid="approved-${recordId}"]`)).toBeVisible();
      }
    });

    test('should handle attendance rejection workflow', async () => {
      // Student marks duty attendance and completes session
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      await studentDashboard.submitHourlyLog('Minimal work done', 'Will do better next time');
      
      // Simulate short session (under 2 hours)
      await studentPage.evaluate(() => {
        window.__testSessionTime = 1.5 * 60 * 60 * 1000; // 1.5 hours
      });
      await studentDashboard.endDutyButton.click();
      await studentPage.locator('[data-testid="confirm-end-session"]').click();

      // Teacher rejects due to insufficient time
      await teacherDashboard.attendanceValidationTab.click();
      await teacherPage.waitForSelector('[data-testid="pending-record"]');
      
      if (await teacherPage.locator('[data-testid="pending-record"]').first().isVisible()) {
        const recordId = await teacherPage.locator('[data-testid="pending-record"]').first().getAttribute('data-record-id');
        await teacherDashboard.validateAttendance(recordId, 'reject');
        
        // Verify rejection notification reaches student
        await WaitHelpers.waitForCondition(studentPage, () => 
          document.querySelector('[data-testid="notification-toast"]')
        );
        await expect(studentPage.locator('[data-testid="notification-toast"]')).toContainText('rejected');
      }
    });
  });

  test.describe('Leave Request Cycle', () => {
    test('should handle complete leave request workflow', async () => {
      const leaveData = DataGenerators.generateLeaveRequest();

      // Step 1: Student submits leave request before 9 AM
      await studentPage.evaluate(() => {
        const earlyMorning = new Date();
        earlyMorning.setHours(8, 30, 0, 0);
        window.__testCurrentTime = earlyMorning.getTime();
      });

      await studentPage.locator('[data-testid="leave-request"]').click();
      await studentPage.locator('[data-testid="leave-date"]').fill(leaveData.date);
      await studentPage.locator('[data-testid="leave-reason"]').fill(leaveData.reason);
      await studentPage.locator('[data-testid="leave-type"]').selectOption(leaveData.type);
      await studentPage.locator('[data-testid="submit-leave"]').click();

      await expect(studentPage.locator('[data-testid="request-success"]')).toContainText('Leave request submitted');

      // Step 2: Core team member reviews request
      await coreTeamDashboard.requestsTab.click();
      await coreTeamPage.waitForSelector('[data-testid="pending-requests"]');
      
      if (await coreTeamPage.locator('[data-testid^="request-"]').first().isVisible()) {
        const requestId = await coreTeamPage.locator('[data-testid^="request-"]').first().getAttribute('data-request-id');

        // Step 3: Core team approves request with notification
        await coreTeamPage.locator(`[data-testid="approve-${requestId}"]`).click();
        await coreTeamPage.locator('[data-testid="send-notification"]').check();
        await coreTeamPage.locator('[data-testid="notification-message"]').fill('Your leave request has been approved. Please ensure all pending work is completed.');
        await coreTeamPage.locator('[data-testid="confirm-approval"]').click();

        // Step 4: Student receives notification
        await WaitHelpers.waitForCondition(studentPage, () => 
          document.querySelector('[data-testid="notification-toast"]')
        );
        await expect(studentPage.locator('[data-testid="notification-toast"]')).toContainText('approved');

        // Step 5: Calendar updates reflect decision
        await studentPage.locator('[data-testid="my-requests"]').click();
        await expect(studentPage.locator(`[data-testid="request-${requestId}"]`)).toContainText('Approved');

        // Step 6: Teacher sees approved requests
        await teacherPage.locator('[data-testid="approved-leaves-tab"]').click();
        await expect(teacherPage.locator(`[data-testid="approved-leave-${requestId}"]`)).toBeVisible();
      }
    });

    test('should handle leave request rejection workflow', async () => {
      const leaveData = DataGenerators.generateLeaveRequest();

      // Student submits leave request
      await studentPage.locator('[data-testid="leave-request"]').click();
      await studentPage.locator('[data-testid="leave-date"]').fill(leaveData.date);
      await studentPage.locator('[data-testid="leave-reason"]').fill('Personal work (short notice)');
      await studentPage.locator('[data-testid="submit-leave"]').click();

      // Core team rejects with reason
      await coreTeamDashboard.requestsTab.click();
      if (await coreTeamPage.locator('[data-testid^="request-"]').first().isVisible()) {
        const requestId = await coreTeamPage.locator('[data-testid^="request-"]').first().getAttribute('data-request-id');
        
        await coreTeamPage.locator(`[data-testid="reject-${requestId}"]`).click();
        await coreTeamPage.locator('[data-testid="rejection-reason"]').fill('Insufficient notice provided. Please submit requests at least 24 hours in advance.');
        await coreTeamPage.locator('[data-testid="confirm-rejection"]').click();

        // Verify rejection notification and reasoning
        await WaitHelpers.waitForCondition(studentPage, () => 
          document.querySelector('[data-testid="notification-toast"]')
        );
        await expect(studentPage.locator('[data-testid="notification-toast"]')).toContainText('rejected');
        
        await studentPage.locator('[data-testid="my-requests"]').click();
        await studentPage.locator(`[data-testid="request-${requestId}"]`).click();
        await expect(studentPage.locator('[data-testid="rejection-reason"]')).toContainText('Insufficient notice');
      }
    });
  });

  test.describe('Strike Escalation Flow', () => {
    test('should handle automatic strike generation and escalation', async () => {
      // Step 1: Student starts duty session
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();

      // Step 2: Student misses hourly logs (simulate 2+ hours without logs)
      await studentPage.evaluate(() => {
        window.__testSessionTime = 2.5 * 60 * 60 * 1000; // 2.5 hours
        window.__testMissedLogs = true;
      });

      // Step 3: System generates automatic strike
      await expect(studentPage.locator('[data-testid="missed-log-warning"]')).toBeVisible();
      await expect(studentPage.locator('[data-testid="strike-notification"]')).toContainText('Strike added');

      // Step 4: Core team receives notification
      await WaitHelpers.waitForCondition(coreTeamPage, () => 
        document.querySelector('[data-testid="notification-toast"]')
      );
      await expect(coreTeamPage.locator('[data-testid="notification-toast"]')).toContainText('New strike generated');

      // Step 5: Teacher gets academic alert
      await WaitHelpers.waitForCondition(teacherPage, () => 
        document.querySelector('[data-testid="academic-alert"]')
      );
      await expect(teacherPage.locator('[data-testid="academic-alert"]')).toContainText('Student missed hourly log');

      // Step 6: All parties can track strike status
      await studentPage.locator('[data-testid="strike-history"]').click();
      const studentStrikes = await studentPage.locator('[data-testid="strike-entry"]').count();
      
      await coreTeamDashboard.strikesTab.click();
      const coreTeamStrikes = await coreTeamPage.locator('[data-testid="unresolved-strike"]').count();
      
      await teacherDashboard.strikesOverviewTab.click();
      const teacherStrikes = await teacherPage.locator('[data-testid="student-with-strikes"]').count();

      expect(studentStrikes).toBeGreaterThan(0);
      expect(coreTeamStrikes).toBeGreaterThan(0);
      expect(teacherStrikes).toBeGreaterThan(0);
    });

    test('should handle strike resolution workflow', async () => {
      // Simulate student with existing strikes
      await studentPage.evaluate(() => {
        window.__testStrikeCount = 2;
      });

      // Step 1: Core team reviews and resolves strike
      await coreTeamDashboard.strikesTab.click();
      if (await coreTeamPage.locator('[data-testid="unresolved-strike"]').first().isVisible()) {
        const strikeId = await coreTeamPage.locator('[data-testid="unresolved-strike"]').first().getAttribute('data-strike-id');
        
        await coreTeamPage.locator(`[data-testid="resolve-${strikeId}"]`).click();
        await coreTeamPage.locator('[data-testid="resolution-reason"]').fill('Student provided valid explanation and made up work');
        await coreTeamPage.locator('[data-testid="confirm-resolution"]').click();

        // Step 2: Resolution notification sent to all parties
        await WaitHelpers.waitForCondition(studentPage, () => 
          document.querySelector('[data-testid="notification-toast"]')
        );
        await expect(studentPage.locator('[data-testid="notification-toast"]')).toContainText('Strike resolved');

        await WaitHelpers.waitForCondition(teacherPage, () => 
          document.querySelector('[data-testid="strike-resolution-notification"]')
        );

        // Step 3: Strike count updates across all interfaces
        await studentPage.reload();
        const newStrikeCount = await studentPage.locator('[data-testid="strike-count"]').textContent();
        expect(parseInt(newStrikeCount)).toBeLessThan(2);
      }
    });
  });

  test.describe('Import to Usage Flow', () => {
    test('should handle complete member import and immediate usage', async () => {
      const newStudents = DataGenerators.generateMultipleUsers(3);
      const csvPath = await FileUploadHelpers.createTestCSV(newStudents);

      // Step 1: Core team imports new members
      await coreTeamDashboard.importMembers(csvPath);
      await coreTeamPage.locator('[data-testid="confirm-import"]').click();
      
      await expect(coreTeamPage.locator('[data-testid="import-success"]')).toContainText('3 members imported successfully');

      // Step 2: New students should be able to login immediately
      const newStudentContext = await studentPage.context().browser().newContext();
      const newStudentPage = await newStudentContext.newPage();
      
      const newStudent = newStudents[0];
      await newStudentPage.goto('/login');
      await newStudentPage.locator('[data-testid="email-input"]').fill(newStudent.email);
      await newStudentPage.locator('[data-testid="password-input"]').fill('password123'); // Default password
      await newStudentPage.locator('[data-testid="login-button"]').click();

      await newStudentPage.waitForURL('**/dashboard/student');
      await expect(newStudentPage.locator('[data-testid="student-dashboard"]')).toBeVisible();

      // Step 3: New students can mark attendance
      await newStudentPage.locator('[data-testid="mark-attendance"]').click();
      await newStudentPage.locator('[data-testid="attendance-present_in_class"]').click();
      await newStudentPage.locator('[data-testid="confirm-attendance"]').click();

      await expect(newStudentPage.locator('[data-testid="attendance-success"]')).toContainText('Attendance marked successfully');

      // Step 4: Teachers can see new member submissions
      await teacherDashboard.attendanceValidationTab.click();
      await teacherPage.waitForSelector('[data-testid="pending-record"]');
      
      const pendingRecords = await teacherPage.locator('[data-testid="pending-record"]').allTextContents();
      expect(pendingRecords.some(record => record.includes(newStudent.firstName))).toBe(true);

      // Step 5: Reports include new members
      await coreTeamDashboard.reportsTab.click();
      await coreTeamPage.locator('[data-testid="report-type"]').selectOption('attendance-summary');
      await coreTeamPage.locator('[data-testid="generate-report"]').click();
      
      await expect(coreTeamPage.locator('[data-testid="report-preview"]')).toBeVisible();
      const reportContent = await coreTeamPage.locator('[data-testid="report-content"]').textContent();
      expect(reportContent).toContain(newStudent.firstName);

      await newStudentPage.close();
      await FileUploadHelpers.cleanupTestFiles();
    });
  });

  test.describe('Real-time Collaboration', () => {
    test('should handle multiple users online simultaneously', async () => {
      const realtimeStudentHelper = new RealtimeHelpers(studentPage);
      const realtimeCoreTeamHelper = new RealtimeHelpers(coreTeamPage);
      const realtimeTeacherHelper = new RealtimeHelpers(teacherPage);

      // Set up notification listeners for all roles
      await realtimeStudentHelper.setupNotificationListener();
      await realtimeCoreTeamHelper.setupNotificationListener();
      await realtimeTeacherHelper.setupNotificationListener();

      // Step 1: Student performs action
      await studentDashboard.markAttendance('on_club_duty');
      
      // Step 2: Real-time updates should propagate to other users
      await WaitHelpers.waitForCondition(coreTeamPage, () => 
        document.querySelector('[data-testid="pending-requests"]').textContent !== '0'
      );

      await WaitHelpers.waitForCondition(teacherPage, () => 
        document.querySelector('[data-testid="pending-validations"]').textContent !== '0'
      );

      // Step 3: Core team action should notify others
      await coreTeamDashboard.requestsTab.click();
      if (await coreTeamPage.locator('[data-testid^="request-"]').first().isVisible()) {
        const requestId = await coreTeamPage.locator('[data-testid^="request-"]').first().getAttribute('data-request-id');
        await coreTeamPage.locator(`[data-testid="approve-${requestId}"]`).click();
        await coreTeamPage.locator('[data-testid="confirm-approval"]').click();

        // Student and teacher should receive real-time updates
        await realtimeStudentHelper.waitForNotification();
        await realtimeTeacherHelper.waitForNotification();
      }

      // Step 4: Data consistency maintained across all sessions
      const studentNotifications = await realtimeStudentHelper.getNotifications();
      const teacherNotifications = await realtimeTeacherHelper.getNotifications();
      
      expect(studentNotifications.length).toBeGreaterThan(0);
      expect(teacherNotifications.length).toBeGreaterThan(0);
    });

    test('should maintain data consistency during concurrent actions', async () => {
      // Simulate concurrent actions
      const promises = [
        // Student marks attendance
        (async () => {
          await studentDashboard.markAttendance('present_in_class');
        })(),
        
        // Core team imports members
        (async () => {
          const testData = DataGenerators.generateMultipleUsers(2);
          const csvPath = await FileUploadHelpers.createTestCSV(testData);
          await coreTeamDashboard.importMembers(csvPath);
          await coreTeamPage.locator('[data-testid="confirm-import"]').click();
          await FileUploadHelpers.cleanupTestFiles();
        })(),
        
        // Teacher reviews submissions
        (async () => {
          await teacherDashboard.attendanceValidationTab.click();
          await teacherPage.waitForTimeout(1000); // Allow other actions to complete
        })()
      ];

      await Promise.all(promises);

      // Verify all actions completed successfully
      await expect(studentPage.locator('[data-testid="attendance-status"]')).toBeVisible();
      await expect(coreTeamPage.locator('[data-testid="import-success"]')).toBeVisible();
      await expect(teacherPage.locator('[data-testid="attendance-validation"]')).toBeVisible();
    });
  });

  test.describe('Workflow Dependencies', () => {
    test('should enforce business rule dependencies', async () => {
      // Rule: Students must mark attendance before starting duty session
      await studentPage.goto('/dashboard/student');
      
      // Try to start duty session without marking attendance
      if (await studentPage.locator('[data-testid="start-duty"]').isVisible()) {
        await expect(studentPage.locator('[data-testid="start-duty"]')).toBeDisabled();
      }

      // Mark club duty attendance first
      await studentDashboard.markAttendance('on_club_duty');
      
      // Now duty session should be enabled
      await expect(studentPage.locator('[data-testid="start-duty"]')).toBeEnabled();

      // Rule: Teachers can only validate completed sessions
      await teacherDashboard.attendanceValidationTab.click();
      
      // Incomplete sessions should not appear in validation queue
      const incompleteSessions = await teacherPage.locator('[data-testid="incomplete-session"]').count();
      expect(incompleteSessions).toBe(0);
    });

    test('should validate cascading updates', async () => {
      // Step 1: Student completes duty session
      await studentDashboard.markAttendance('on_club_duty');
      await studentDashboard.startDutySession();
      await studentDashboard.submitHourlyLog('Completed project tasks', 'Next: code review');
      
      await studentPage.evaluate(() => {
        window.__testSessionTime = 2.5 * 60 * 60 * 1000;
      });
      await studentDashboard.endDutyButton.click();
      await studentPage.locator('[data-testid="confirm-end-session"]').click();

      // Step 2: Teacher approves attendance
      await teacherDashboard.attendanceValidationTab.click();
      await teacherPage.waitForSelector('[data-testid="pending-record"]');
      
      if (await teacherPage.locator('[data-testid="pending-record"]').first().isVisible()) {
        const recordId = await teacherPage.locator('[data-testid="pending-record"]').first().getAttribute('data-record-id');
        await teacherDashboard.validateAttendance(recordId, 'approve');

        // Step 3: Verify cascading updates
        // - Student's attendance history updates
        await WaitHelpers.waitForCondition(studentPage, () => 
          document.querySelector('[data-testid="approved-attendance"]')
        );
        
        // - Core team's statistics update
        await WaitHelpers.waitForCondition(coreTeamPage, () => {
          const approvedCount = document.querySelector('[data-testid="approved-today"]');
          return approvedCount && parseInt(approvedCount.textContent) > 0;
        });
        
        // - Reports reflect the update
        await coreTeamDashboard.reportsTab.click();
        await coreTeamPage.locator('[data-testid="refresh-stats"]').click();
        await expect(coreTeamPage.locator('[data-testid="updated-stats"]')).toBeVisible();
      }
    });
  });

  test.describe('System Integration', () => {
    test('should handle complete system workflow integration', async () => {
      // This test simulates a full day's workflow across all roles
      
      // Morning: Core team checks system status
      await expect(coreTeamPage.locator('[data-testid="system-status"]')).toContainText('Online');
      await expect(coreTeamPage.locator('[data-testid="total-students"]')).toBeVisible();
      
      // Students start arriving and marking attendance
      await studentDashboard.markAttendance('present_in_class');
      await expect(studentPage.locator('[data-testid="attendance-marked"]')).toBeVisible();
      
      // Some students switch to duty
      await studentPage.locator('[data-testid="change-to-duty"]').click();
      await studentDashboard.startDutySession();
      
      // Throughout the day: Students log work
      await studentDashboard.submitHourlyLog('Morning: Setup and planning', 'Afternoon: Implementation');
      
      // Afternoon: Teacher starts reviewing submissions
      await teacherDashboard.attendanceValidationTab.click();
      await teacherPage.waitForSelector('[data-testid="pending-record"]');
      
      // End of day: Core team generates reports
      await coreTeamDashboard.reportsTab.click();
      await coreTeamPage.locator('[data-testid="report-type"]').selectOption('daily-summary');
      await coreTeamPage.locator('[data-testid="generate-report"]').click();
      
      // Verify all components work together
      await expect(coreTeamPage.locator('[data-testid="report-preview"]')).toBeVisible();
      
      // System maintains performance under load
      const responseTime = await coreTeamPage.evaluate(() => {
        return performance.getEntriesByType('navigation')[0].loadEventEnd - 
               performance.getEntriesByType('navigation')[0].navigationStart;
      });
      expect(responseTime).toBeLessThan(5000); // Less than 5 seconds
    });

    test('should maintain data integrity across all features', async () => {
      // Create test data that will be used across multiple features
      const testStudent = DataGenerators.generateUser('student');
      const testEvent = DataGenerators.generateEvent();
      
      // Import student through core team interface
      const csvPath = await FileUploadHelpers.createTestCSV([testStudent]);
      await coreTeamDashboard.importMembers(csvPath);
      await coreTeamPage.locator('[data-testid="confirm-import"]').click();
      
      // Create event
      await coreTeamPage.locator('[data-testid="create-event"]').click();
      await coreTeamPage.locator('[data-testid="event-name"]').fill(testEvent.name);
      await coreTeamPage.locator('[data-testid="event-date"]').fill(testEvent.date);
      await coreTeamPage.locator('[data-testid="save-event"]').click();
      
      // Login as new student
      const newStudentContext = await studentPage.context().browser().newContext();
      const newStudentPage = await newStudentContext.newPage();
      
      await newStudentPage.goto('/login');
      await newStudentPage.locator('[data-testid="email-input"]').fill(testStudent.email);
      await newStudentPage.locator('[data-testid="password-input"]').fill('password123');
      await newStudentPage.locator('[data-testid="login-button"]').click();
      
      // Student should see the new event
      await expect(newStudentPage.locator('[data-testid="available-events"]')).toContainText(testEvent.name);
      
      // Mark attendance for the event
      await newStudentPage.locator('[data-testid="mark-attendance"]').click();
      await newStudentPage.locator('[data-testid="select-event"]').selectOption(testEvent.name);
      await newStudentPage.locator('[data-testid="attendance-present_in_class"]').click();
      await newStudentPage.locator('[data-testid="confirm-attendance"]').click();
      
      // Teacher should see the attendance in validation queue
      await teacherPage.reload();
      await teacherDashboard.attendanceValidationTab.click();
      
      const pendingRecords = await teacherPage.locator('[data-testid="student-name"]').allTextContents();
      expect(pendingRecords.some(name => name.includes(testStudent.firstName))).toBe(true);
      
      // Core team report should include the new data
      await coreTeamPage.reload();
      await coreTeamDashboard.reportsTab.click();
      await coreTeamPage.locator('[data-testid="report-type"]').selectOption('event-attendance');
      await coreTeamPage.locator('[data-testid="select-report-event"]').selectOption(testEvent.name);
      await coreTeamPage.locator('[data-testid="generate-report"]').click();
      
      await expect(coreTeamPage.locator('[data-testid="report-preview"]')).toContainText(testStudent.firstName);
      
      await newStudentPage.close();
      await FileUploadHelpers.cleanupTestFiles();
    });
  });
});