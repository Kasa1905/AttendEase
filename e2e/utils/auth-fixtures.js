const { expect } = require('@playwright/test');

/**
 * Authentication Fixtures for E2E Tests
 * Provides reusable authentication methods for different user roles
 */

class AuthFixtures {
  constructor(page) {
    this.page = page;
  }

  /**
   * Login as administrator
   * @returns {Promise<void>}
   */
  async loginAsAdmin() {
    await this.page.goto('/login');
    await this.page.fill('input[name="email"]', 'admin@test.com');
    await this.page.fill('input[name="password"]', 'password123');
    await this.page.click('button[type="submit"]');
    
    // Wait for successful login redirect
    await this.page.waitForURL('/dashboard');
    
    // Verify admin privileges
    await expect(this.page.locator('[data-testid="admin-panel"]')).toBeVisible();
  }

  /**
   * Login as core team member
   * @returns {Promise<void>}
   */
  async loginAsCoreTeam() {
    await this.page.goto('/login');
    await this.page.fill('input[name="email"]', 'coreteam@test.com');
    await this.page.fill('input[name="password"]', 'password123');
    await this.page.click('button[type="submit"]');
    
    await this.page.waitForURL('/dashboard');
    
    // Verify core team access
    await expect(this.page.locator('[data-testid="core-team-tools"]')).toBeVisible();
  }

  /**
   * Login as teacher
   * @returns {Promise<void>}
   */
  async loginAsTeacher() {
    await this.page.goto('/login');
    await this.page.fill('input[name="email"]', 'teacher@test.com');
    await this.page.fill('input[name="password"]', 'password123');
    await this.page.click('button[type="submit"]');
    
    await this.page.waitForURL('/dashboard');
    
    // Verify teacher access
    await expect(this.page.locator('[data-testid="teacher-dashboard"]')).toBeVisible();
  }

  /**
   * Login as student
   * @returns {Promise<void>}
   */
  async loginAsStudent() {
    await this.page.goto('/login');
    await this.page.fill('input[name="email"]', 'student@test.com');
    await this.page.fill('input[name="password"]', 'password123');
    await this.page.click('button[type="submit"]');
    
    await this.page.waitForURL('/dashboard');
    
    // Verify student access
    await expect(this.page.locator('[data-testid="student-dashboard"]')).toBeVisible();
  }

  /**
   * Login with custom credentials
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} expectedUrl - Expected redirect URL after login
   * @returns {Promise<void>}
   */
  async loginWithCredentials(email, password, expectedUrl = '/dashboard') {
    await this.page.goto('/login');
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
    
    if (expectedUrl) {
      await this.page.waitForURL(expectedUrl);
    }
  }

  /**
   * Logout current user
   * @returns {Promise<void>}
   */
  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout-btn"]');
    await this.page.waitForURL('/login');
    
    // Verify logout
    await expect(this.page.locator('input[name="email"]')).toBeVisible();
  }

  /**
   * Setup test user with specific role
   * @param {string} role - User role (admin, core_team, teacher, student)
   * @param {Object} userData - Additional user data
   * @returns {Promise<Object>} Created user data
   */
  async setupTestUser(role = 'student', userData = {}) {
    const defaultUser = {
      name: `Test ${role}`,
      email: `test-${role}-${Date.now()}@test.com`,
      password: 'testpass123',
      role: role,
      studentId: role === 'student' ? `ST${Date.now()}` : null,
      ...userData
    };

    // Make API call to create user
    const response = await this.page.request.post('/api/auth/register', {
      data: defaultUser
    });
    
    expect(response.ok()).toBeTruthy();
    const createdUser = await response.json();
    
    return { ...defaultUser, id: createdUser.user.id };
  }

  /**
   * Clean up test user
   * @param {string} userId - User ID to delete
   * @returns {Promise<void>}
   */
  async cleanupTestUser(userId) {
    try {
      await this.page.request.delete(`/api/users/${userId}`);
    } catch (error) {
      console.warn('Failed to cleanup test user:', error.message);
    }
  }

  /**
   * Verify current user role and permissions
   * @param {string} expectedRole - Expected user role
   * @returns {Promise<void>}
   */
  async verifyUserRole(expectedRole) {
    // Make API call to get current user
    const response = await this.page.request.get('/api/auth/profile');
    expect(response.ok()).toBeTruthy();
    
    const profile = await response.json();
    expect(profile.role).toBe(expectedRole);
  }

  /**
   * Setup session with authentication token
   * @param {string} token - JWT token
   * @returns {Promise<void>}
   */
  async setupAuthToken(token) {
    await this.page.context().addCookies([{
      name: 'auth-token',
      value: token,
      domain: 'localhost',
      path: '/'
    }]);
  }

  /**
   * Get authentication state for reuse
   * @returns {Promise<Object>} Authentication state
   */
  async getAuthState() {
    const cookies = await this.page.context().cookies();
    const localStorage = await this.page.evaluate(() => {
      return Object.keys(localStorage).reduce((items, key) => {
        items[key] = localStorage.getItem(key);
        return items;
      }, {});
    });

    return { cookies, localStorage };
  }

  /**
   * Restore authentication state
   * @param {Object} authState - Previously saved auth state
   * @returns {Promise<void>}
   */
  async restoreAuthState(authState) {
    // Restore cookies
    if (authState.cookies) {
      await this.page.context().addCookies(authState.cookies);
    }

    // Restore localStorage
    if (authState.localStorage) {
      await this.page.evaluate((items) => {
        Object.keys(items).forEach(key => {
          localStorage.setItem(key, items[key]);
        });
      }, authState.localStorage);
    }
  }

  /**
   * Handle login failures gracefully
   * @param {string} email - Email to attempt
   * @param {string} password - Password to attempt
   * @returns {Promise<boolean>} Whether login succeeded
   */
  async attemptLogin(email, password) {
    try {
      await this.page.goto('/login');
      await this.page.fill('input[name="email"]', email);
      await this.page.fill('input[name="password"]', password);
      await this.page.click('button[type="submit"]');
      
      // Check if login succeeded (redirect to dashboard)
      await this.page.waitForURL('/dashboard', { timeout: 5000 });
      return true;
    } catch (error) {
      // Check for error message
      const errorElement = await this.page.locator('.error-message, [data-testid="login-error"]');
      if (await errorElement.isVisible()) {
        console.log('Login failed with error:', await errorElement.textContent());
      }
      return false;
    }
  }
}

/**
 * Factory function to create AuthFixtures instance
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {AuthFixtures} AuthFixtures instance
 */
function createAuthFixtures(page) {
  return new AuthFixtures(page);
}

module.exports = { AuthFixtures, createAuthFixtures };