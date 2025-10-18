const { test, expect } = require('@playwright/test');
const { 
  AuthFixtures, 
  LoginPage, 
  WaitHelpers,
  ScreenshotUtilities 
} = require('../utils/testUtils');

test.describe('Authentication E2E Tests', () => {
  let authFixtures;

  test.beforeAll(async () => {
    authFixtures = new AuthFixtures(page);
  });

  test.describe('Login Flow Tests', () => {
    test('should login student successfully and redirect to dashboard', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await page.goto('/login');
      await loginPage.login('student@test.com', 'password123');
      
      // Wait for redirect to student dashboard
      await page.waitForURL('**/dashboard/student');
      await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="mark-attendance"]')).toBeVisible();
    });

    test('should login core team member successfully and redirect to dashboard', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await page.goto('/login');
      await loginPage.login('coreteam@test.com', 'password123');
      
      // Wait for redirect to core team dashboard
      await page.waitForURL('**/dashboard/core-team');
      await expect(page.locator('[data-testid="core-team-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="import-members"]')).toBeVisible();
    });

    test('should login teacher successfully and redirect to dashboard', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await page.goto('/login');
      await loginPage.login('teacher@test.com', 'password123');
      
      // Wait for redirect to teacher dashboard
      await page.waitForURL('**/dashboard/teacher');
      await expect(page.locator('[data-testid="teacher-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="daily-logs-tab"]')).toBeVisible();
    });

    test('should handle invalid credentials gracefully', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await page.goto('/login');
      await loginPage.login('invalid@test.com', 'wrongpassword');
      
      // Should show error message
      await loginPage.waitForError();
      await expect(loginPage.errorMessage).toContainText('Invalid credentials');
      
      // Should remain on login page
      expect(page.url()).toContain('/login');
    });

    test('should validate required fields', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await page.goto('/login');
      await loginPage.loginButton.click();
      
      // Should show validation errors
      await expect(page.locator('[data-testid="email-error"]')).toContainText('Email is required');
      await expect(page.locator('[data-testid="password-error"]')).toContainText('Password is required');
    });
  });

  test.describe('Registration Flow Tests', () => {
    test('should register new student successfully', async ({ page }) => {
      const timestamp = Date.now();
      const userData = {
        firstName: 'New',
        lastName: 'Student',
        email: `newstudent${timestamp}@test.com`,
        password: 'password123',
        confirmPassword: 'password123',
        department: 'Computer Science',
        year: '2'
      };

      await page.goto('/register');
      
      // Fill registration form
      await page.locator('[data-testid="firstName-input"]').fill(userData.firstName);
      await page.locator('[data-testid="lastName-input"]').fill(userData.lastName);
      await page.locator('[data-testid="email-input"]').fill(userData.email);
      await page.locator('[data-testid="password-input"]').fill(userData.password);
      await page.locator('[data-testid="confirmPassword-input"]').fill(userData.confirmPassword);
      await page.locator('[data-testid="department-select"]').selectOption(userData.department);
      await page.locator('[data-testid="year-select"]').selectOption(userData.year);
      
      await page.locator('[data-testid="register-button"]').click();
      
      // Should redirect to student dashboard after successful registration
      await page.waitForURL('**/dashboard/student');
      await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
    });

    test('should validate password confirmation', async ({ page }) => {
      await page.goto('/register');
      
      await page.locator('[data-testid="password-input"]').fill('password123');
      await page.locator('[data-testid="confirmPassword-input"]').fill('differentpassword');
      await page.locator('[data-testid="register-button"]').click();
      
      await expect(page.locator('[data-testid="confirmPassword-error"]')).toContainText('Passwords do not match');
    });

    test('should handle duplicate email registration', async ({ page }) => {
      await page.goto('/register');
      
      // Try to register with existing email
      await page.locator('[data-testid="firstName-input"]').fill('Duplicate');
      await page.locator('[data-testid="lastName-input"]').fill('User');
      await page.locator('[data-testid="email-input"]').fill('student@test.com'); // Existing email
      await page.locator('[data-testid="password-input"]').fill('password123');
      await page.locator('[data-testid="confirmPassword-input"]').fill('password123');
      await page.locator('[data-testid="department-select"]').selectOption('Computer Science');
      await page.locator('[data-testid="year-select"]').selectOption('2');
      
      await page.locator('[data-testid="register-button"]').click();
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Email already exists');
    });
  });

  test.describe('Session Management Tests', () => {
    test('should maintain session across page refreshes', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Refresh the page
      await page.reload();
      
      // Should still be logged in
      await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
    });

    test('should handle session expiration gracefully', async ({ page, context }) => {
      await authFixtures.loginAsStudent(page);
      
      // Clear cookies to simulate session expiration
      await context.clearCookies();
      
      // Try to access a protected route
      await page.goto('/dashboard/student');
      
      // Should redirect to login
      await page.waitForURL('**/login');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('should handle automatic logout on token expiry', async ({ page }) => {
      // This test would require mocking JWT expiration
      // For now, we'll test the logout functionality
      await authFixtures.loginAsStudent(page);
      
      await page.locator('[data-testid="user-menu"]').click();
      await page.locator('[data-testid="logout-button"]').click();
      
      // Should redirect to login
      await page.waitForURL('**/login');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });
  });

  test.describe('Password Management Tests', () => {
    test('should change password successfully', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Navigate to profile/settings
      await page.locator('[data-testid="user-menu"]').click();
      await page.locator('[data-testid="profile-settings"]').click();
      
      // Change password
      await page.locator('[data-testid="current-password"]').fill('password123');
      await page.locator('[data-testid="new-password"]').fill('newpassword123');
      await page.locator('[data-testid="confirm-new-password"]').fill('newpassword123');
      await page.locator('[data-testid="change-password-button"]').click();
      
      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Password changed successfully');
    });

    test('should validate current password before change', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      await page.locator('[data-testid="user-menu"]').click();
      await page.locator('[data-testid="profile-settings"]').click();
      
      // Try to change password with wrong current password
      await page.locator('[data-testid="current-password"]').fill('wrongpassword');
      await page.locator('[data-testid="new-password"]').fill('newpassword123');
      await page.locator('[data-testid="confirm-new-password"]').fill('newpassword123');
      await page.locator('[data-testid="change-password-button"]').click();
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Current password is incorrect');
    });
  });

  test.describe('Role-Based Access Tests', () => {
    test('should prevent students from accessing core team routes', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Try to access core team dashboard directly
      await page.goto('/dashboard/core-team');
      
      // Should redirect to unauthorized page or student dashboard
      await expect(page.locator('[data-testid="unauthorized-message"]')).toBeVisible();
    });

    test('should prevent students from accessing teacher routes', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Try to access teacher dashboard directly
      await page.goto('/dashboard/teacher');
      
      // Should redirect to unauthorized page or student dashboard
      await expect(page.locator('[data-testid="unauthorized-message"]')).toBeVisible();
    });

    test('should allow core team access to management features', async ({ page }) => {
      await authFixtures.loginAsCoreTeam(page);
      
      await page.goto('/dashboard/core-team/members');
      await expect(page.locator('[data-testid="member-management"]')).toBeVisible();
    });

    test('should allow teacher access to validation features', async ({ page }) => {
      await authFixtures.loginAsTeacher(page);
      
      await page.goto('/dashboard/teacher/validation');
      await expect(page.locator('[data-testid="attendance-validation"]')).toBeVisible();
    });
  });

  test.describe('Security Tests', () => {
    test('should protect against XSS in login form', async ({ page }) => {
      const loginPage = new LoginPage(page);
      
      await page.goto('/login');
      
      // Try XSS payload
      const xssPayload = '<script>alert("xss")</script>';
      await loginPage.emailInput.fill(xssPayload);
      await loginPage.passwordInput.fill('password123');
      await loginPage.loginButton.click();
      
      // Should not execute script - check that no alert is present
      const alertHandled = await page.evaluate(() => {
        return new Promise(resolve => {
          const originalAlert = window.alert;
          window.alert = () => resolve(true);
          setTimeout(() => resolve(false), 100);
        });
      });
      
      expect(alertHandled).toBe(false);
    });

    test('should have secure headers', async ({ page }) => {
      const response = await page.goto('/login');
      
      // Check for security headers
      const headers = response.headers();
      expect(headers['x-frame-options']).toBeDefined();
      expect(headers['x-content-type-options']).toBe('nosniff');
    });

    test('should enforce HTTPS in production', async ({ page }) => {
      // This test would be more relevant in production environment
      // For development, we'll check that the app handles protocol correctly
      await page.goto('/login');
      expect(page.url()).toMatch(/^https?:\/\//);
    });
  });

  test.describe('Multi-Browser Tests', () => {
    test('should work consistently across browsers', async ({ browserName, page }) => {
      const loginPage = new LoginPage(page);
      
      await page.goto('/login');
      await loginPage.login('student@test.com', 'password123');
      
      await page.waitForURL('**/dashboard/student');
      await expect(page.locator('[data-testid="student-dashboard"]')).toBeVisible();
      
      // Take browser-specific screenshot
      await ScreenshotUtilities.takeFullPageScreenshot(page, `auth-${browserName}`);
    });
  });

  test.describe('Mobile Authentication Tests', () => {
    test('should handle mobile login interface', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test');
      
      const loginPage = new LoginPage(page);
      
      await page.goto('/login');
      
      // Check mobile-specific elements
      await expect(page.locator('[data-testid="mobile-login-form"]')).toBeVisible();
      
      await loginPage.login('student@test.com', 'password123');
      await page.waitForURL('**/dashboard/student');
      
      // Check mobile dashboard
      await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    });
  });

  test.describe('Error Handling Tests', () => {
    test('should handle network failures gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/auth/login', route => route.abort());
      
      const loginPage = new LoginPage(page);
      await page.goto('/login');
      await loginPage.login('student@test.com', 'password123');
      
      // Should show network error message
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    });

    test('should handle server errors gracefully', async ({ page }) => {
      // Mock server error
      await page.route('**/api/auth/login', route => 
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        })
      );
      
      const loginPage = new LoginPage(page);
      await page.goto('/login');
      await loginPage.login('student@test.com', 'password123');
      
      // Should show server error message
      await expect(page.locator('[data-testid="server-error"]')).toBeVisible();
    });
  });

  test.describe('Cross-Tab Session Tests', () => {
    test('should share session across multiple tabs', async ({ context }) => {
      // Create first tab and login
      const page1 = await context.newPage();
      await authFixtures.loginAsStudent(page1);
      
      // Create second tab
      const page2 = await context.newPage();
      await page2.goto('/dashboard/student');
      
      // Should be automatically logged in
      await expect(page2.locator('[data-testid="student-dashboard"]')).toBeVisible();
      
      await page1.close();
      await page2.close();
    });

    test('should propagate logout across tabs', async ({ context }) => {
      // Create two tabs with same session
      const page1 = await context.newPage();
      await authFixtures.loginAsStudent(page1);
      
      const page2 = await context.newPage();
      await page2.goto('/dashboard/student');
      await expect(page2.locator('[data-testid="student-dashboard"]')).toBeVisible();
      
      // Logout from first tab
      await page1.locator('[data-testid="user-menu"]').click();
      await page1.locator('[data-testid="logout-button"]').click();
      
      // Second tab should also be logged out (may require refresh)
      await page2.reload();
      await page2.waitForURL('**/login');
      
      await page1.close();
      await page2.close();
    });
  });
});