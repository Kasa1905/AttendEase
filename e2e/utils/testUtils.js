const { test, expect } = require('@playwright/test');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * Authentication Fixtures
 */
class AuthFixtures {
  constructor(baseURL = 'http://localhost:5000') {
    this.baseURL = baseURL;
    this.tokens = {};
  }

  async loginUser(email, password) {
    try {
      const response = await axios.post(`${this.baseURL}/api/auth/login`, {
        email,
        password
      });
      
      return {
        success: true,
        data: response.data.data,
        tokens: response.data.data.tokens
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  async loginAsStudent(page) {
    const result = await this.loginUser('student@test.com', 'password123');
    if (result.success) {
      await page.context().addCookies([{
        name: 'accessToken',
        value: result.tokens.accessToken,
        domain: 'localhost',
        path: '/'
      }]);
      
      await page.goto('/dashboard/student');
      this.tokens.student = result.tokens;
    }
    return result;
  }

  async loginAsCoreTeam(page) {
    const result = await this.loginUser('coreteam@test.com', 'password123');
    if (result.success) {
      await page.context().addCookies([{
        name: 'accessToken',
        value: result.tokens.accessToken,
        domain: 'localhost',
        path: '/'
      }]);
      
      await page.goto('/dashboard/core-team');
      this.tokens.coreTeam = result.tokens;
    }
    return result;
  }

  async loginAsTeacher(page) {
    const result = await this.loginUser('teacher@test.com', 'password123');
    if (result.success) {
      await page.context().addCookies([{
        name: 'accessToken',
        value: result.tokens.accessToken,
        domain: 'localhost',
        path: '/'
      }]);
      
      await page.goto('/dashboard/teacher');
      this.tokens.teacher = result.tokens;
    }
    return result;
  }
}

/**
 * Page Object Models
 */
class LoginPage {
  constructor(page) {
    this.page = page;
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }

  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async waitForError() {
    return await this.errorMessage.waitFor({ state: 'visible' });
  }
}

class StudentDashboard {
  constructor(page) {
    this.page = page;
    this.markAttendanceButton = page.locator('[data-testid="mark-attendance"]');
    this.startDutyButton = page.locator('[data-testid="start-duty"]');
    this.endDutyButton = page.locator('[data-testid="end-duty"]');
    this.hourlyLogButton = page.locator('[data-testid="hourly-log"]');
    this.leaveRequestButton = page.locator('[data-testid="leave-request"]');
    this.notificationCenter = page.locator('[data-testid="notification-center"]');
    this.currentSessionTimer = page.locator('[data-testid="session-timer"]');
  }

  async markAttendance(type = 'present_in_class') {
    await this.markAttendanceButton.click();
    await this.page.locator(`[data-testid="attendance-${type}"]`).click();
    await this.page.locator('[data-testid="confirm-attendance"]').click();
  }

  async startDutySession() {
    await this.startDutyButton.click();
    await this.page.locator('[data-testid="confirm-start-duty"]').click();
  }

  async submitHourlyLog(previousWork, nextPlan) {
    await this.hourlyLogButton.click();
    await this.page.locator('[data-testid="previous-work"]').fill(previousWork);
    await this.page.locator('[data-testid="next-plan"]').fill(nextPlan);
    await this.page.locator('[data-testid="submit-log"]').click();
  }
}

class CoreTeamDashboard {
  constructor(page) {
    this.page = page;
    this.memberImportButton = page.locator('[data-testid="import-members"]');
    this.requestsTab = page.locator('[data-testid="requests-tab"]');
    this.strikesTab = page.locator('[data-testid="strikes-tab"]');
    this.reportsTab = page.locator('[data-testid="reports-tab"]');
    this.bulkApprovalButton = page.locator('[data-testid="bulk-approval"]');
  }

  async importMembers(filePath) {
    await this.memberImportButton.click();
    const fileInput = this.page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(filePath);
    await this.page.locator('[data-testid="preview-import"]').click();
  }

  async approveRequest(requestId) {
    await this.requestsTab.click();
    await this.page.locator(`[data-testid="approve-${requestId}"]`).click();
    await this.page.locator('[data-testid="confirm-approval"]').click();
  }
}

class TeacherDashboard {
  constructor(page) {
    this.page = page;
    this.dailyLogsTab = page.locator('[data-testid="daily-logs-tab"]');
    this.attendanceValidationTab = page.locator('[data-testid="validation-tab"]');
    this.strikesOverviewTab = page.locator('[data-testid="strikes-overview"]');
    this.bulkActionsButton = page.locator('[data-testid="bulk-actions"]');
  }

  async validateAttendance(recordId, action = 'approve') {
    await this.attendanceValidationTab.click();
    await this.page.locator(`[data-testid="${action}-${recordId}"]`).click();
    if (action === 'reject') {
      await this.page.locator('[data-testid="rejection-reason"]').fill('Does not meet requirements');
    }
    await this.page.locator('[data-testid="confirm-validation"]').click();
  }
}

/**
 * API Helpers
 */
class APIHelpers {
  constructor(baseURL = 'http://localhost:5000') {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  async makeRequest(method, endpoint, data = null, token = null) {
    const headers = { ...this.defaultHeaders };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const config = {
      method,
      url: `${this.baseURL}/api${endpoint}`,
      headers
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  async createUser(userData, token) {
    return this.makeRequest('POST', '/users', userData, token);
  }

  async markAttendance(attendanceData, token) {
    return this.makeRequest('POST', '/attendance', attendanceData, token);
  }

  async createEvent(eventData, token) {
    return this.makeRequest('POST', '/events', eventData, token);
  }

  async submitLeaveRequest(leaveData, token) {
    return this.makeRequest('POST', '/leave-requests', leaveData, token);
  }
}

/**
 * File Upload Helpers
 */
class FileUploadHelpers {
  constructor(page) {
    this.page = page;
  }

  async uploadFile(selector, filePath) {
    await this.page.locator(selector).setInputFiles(filePath);
  }

  async createTestCSV(data, fileName = 'test-import.csv') {
    const csvContent = [
      'firstName,lastName,email,department,year',
      ...data.map(row => `${row.firstName},${row.lastName},${row.email},${row.department},${row.year}`)
    ].join('\n');

    const filePath = path.join(__dirname, '../fixtures', fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, csvContent);
    return filePath;
  }

  async createTestXLSX(data, fileName = 'test-import.xlsx') {
    // This would require XLSX library implementation
    // For now, return CSV equivalent
    return this.createTestCSV(data, fileName.replace('.xlsx', '.csv'));
  }

  async cleanupTestFiles() {
    const fixturesDir = path.join(__dirname, '../fixtures');
    try {
      const files = await fs.readdir(fixturesDir);
      await Promise.all(
        files.filter(file => file.startsWith('test-'))
          .map(file => fs.unlink(path.join(fixturesDir, file)))
      );
    } catch (error) {
      // Directory might not exist, ignore
    }
  }
}

/**
 * Offline Helpers
 */
class OfflineHelpers {
  constructor(page) {
    this.page = page;
  }

  async goOffline() {
    await this.page.context().setOffline(true);
  }

  async goOnline() {
    await this.page.context().setOffline(false);
  }
}

/**
 * Real-time Testing Helpers
 */
class RealtimeHelpers {
  constructor(page) {
    this.page = page;
    this.notifications = [];
  }

  async setupNotificationListener() {
    await this.page.evaluate(() => {
      window.__testNotifications = [];
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        if (args[0] && args[0].includes('notification')) {
          window.__testNotifications.push(args);
        }
        originalConsoleLog.apply(console, args);
      };
    });
  }

  async getNotifications() {
    return await this.page.evaluate(() => window.__testNotifications || []);
  }

  async waitForNotification(timeout = 10000) {
    return await this.page.waitForFunction(
      () => window.__testNotifications && window.__testNotifications.length > 0,
      { timeout }
    );
  }

  async simulateNetworkOffline() {
    await this.page.context().setOffline(true);
  }

  async simulateNetworkOnline() {
    await this.page.context().setOffline(false);
  }
}

/**
 * Wait Helpers
 */
class WaitHelpers {
  static async waitForElement(page, selector, timeout = 10000) {
    return await page.waitForSelector(selector, { timeout });
  }

  static async waitForAPI(page, endpoint, timeout = 15000) {
    return await page.waitForResponse(
      response => response.url().includes(endpoint) && response.status() === 200,
      { timeout }
    );
  }

  static async waitForText(page, text, timeout = 10000) {
    return await page.waitForFunction(
      text => document.body.innerText.includes(text),
      text,
      { timeout }
    );
  }

  static async waitForCondition(page, condition, timeout = 10000) {
    return await page.waitForFunction(condition, { timeout });
  }
}

/**
 * Data Generators
 */
class DataGenerators {
  static generateUser(role = 'student') {
    const timestamp = Date.now();
    return {
      firstName: `Test${timestamp}`,
      lastName: `User${timestamp}`,
      email: `test${timestamp}@example.com`,
      department: 'Computer Science',
      year: Math.floor(Math.random() * 4) + 1,
      role
    };
  }

  static generateMultipleUsers(count = 10, role = 'student') {
    return Array.from({ length: count }, () => this.generateUser(role));
  }

  static generateEvent() {
    const timestamp = Date.now();
    return {
      name: `Test Event ${timestamp}`,
      description: `Test event created at ${new Date().toISOString()}`,
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
      location: 'Test Location',
      isActive: true
    };
  }

  static generateLeaveRequest() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return {
      date: tomorrow.toISOString().split('T')[0],
      reason: 'Personal work - E2E Test',
      type: 'personal'
    };
  }
}

/**
 * Screenshot Utilities
 */
class ScreenshotUtilities {
  static async takeFullPageScreenshot(page, name) {
    return await page.screenshot({
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true
    });
  }

  static async takeElementScreenshot(page, selector, name) {
    const element = await page.locator(selector);
    return await element.screenshot({
      path: `test-results/screenshots/${name}-${Date.now()}.png`
    });
  }

  static async compareScreenshots(page, selector, name, options = {}) {
    const { expect } = require('@playwright/test');
    await expect(page.locator(selector)).toHaveScreenshot(name, options);
  }
}

// Export all utilities
module.exports = {
  AuthFixtures,
  LoginPage,
  StudentDashboard,
  CoreTeamDashboard,
  TeacherDashboard,
  APIHelpers,
  FileUploadHelpers,
  OfflineHelpers,
  RealtimeHelpers,
  WaitHelpers,
  DataGenerators,
  ScreenshotUtilities
};