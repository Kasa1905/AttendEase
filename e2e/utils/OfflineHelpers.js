/**
 * Offline Functionality Helper utilities for E2E tests
 * Provides methods to simulate offline conditions and test offline capabilities
 */
class OfflineHelpers {
  /**
   * Set the browser context to offline mode
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @returns {Promise<void>}
   */
  static async goOffline(page) {
    await page.context().setOffline(true);
  }

  /**
   * Set the browser context to online mode
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @returns {Promise<void>}
   */
  static async goOnline(page) {
    await page.context().setOffline(false);
  }

  /**
   * Simulate slow network conditions
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {Object} options - Network throttling options
   * @param {number} options.downloadThroughput - Download speed in bytes/sec
   * @param {number} options.uploadThroughput - Upload speed in bytes/sec
   * @param {number} options.latency - Latency in ms
   * @returns {Promise<void>}
   */
  static async simulateSlowNetwork(page, options = {}) {
    const {
      downloadThroughput = 500 * 1024, // 500 KB/s
      uploadThroughput = 100 * 1024,   // 100 KB/s
      latency = 1000                   // 1 second
    } = options;

    await page.context().route('**/*', async (route, request) => {
      // Add artificial delay
      await new Promise(resolve => setTimeout(resolve, latency));
      await route.continue();
    });
  }

  /**
   * Verify offline indicator is visible
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>}
   */
  static async verifyOfflineIndicator(page, timeout = 5000) {
    try {
      await page.waitForSelector('[data-testid="offline-indicator"], .offline-indicator', { 
        state: 'visible', 
        timeout 
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify offline indicator is hidden
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>}
   */
  static async verifyOnlineStatus(page, timeout = 5000) {
    try {
      await page.waitForSelector('[data-testid="offline-indicator"], .offline-indicator', { 
        state: 'hidden', 
        timeout 
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get count of pending offline actions
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @returns {Promise<number>}
   */
  static async getPendingActionsCount(page) {
    try {
      const elements = await page.locator('[data-testid="pending-changes"], .pending-action').all();
      return elements.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Perform actions while offline and verify they are queued
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {Function} actionCallback - Function that performs offline actions
   * @returns {Promise<Object>} - Result object with success status and pending count
   */
  static async performOfflineActions(page, actionCallback) {
    // Go offline
    await this.goOffline(page);
    
    // Verify offline status
    const isOffline = await this.verifyOfflineIndicator(page);
    if (!isOffline) {
      throw new Error('Failed to go offline');
    }
    
    // Perform the actions
    await actionCallback();
    
    // Count pending actions
    const pendingCount = await this.getPendingActionsCount(page);
    
    return {
      success: true,
      pendingCount,
      isOffline: true
    };
  }

  /**
   * Test sync functionality after going back online
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} expectedSyncCount - Expected number of items to sync
   * @param {number} timeout - Timeout for sync completion
   * @returns {Promise<Object>} - Sync result
   */
  static async testOfflineSync(page, expectedSyncCount = 0, timeout = 15000) {
    // Go back online
    await this.goOnline(page);
    
    // Verify online status
    const isOnline = await this.verifyOnlineStatus(page);
    if (!isOnline) {
      throw new Error('Failed to go online');
    }
    
    // Wait for sync to complete
    const startTime = Date.now();
    let pendingCount = await this.getPendingActionsCount(page);
    
    while (pendingCount > 0 && (Date.now() - startTime) < timeout) {
      await page.waitForTimeout(1000);
      pendingCount = await this.getPendingActionsCount(page);
    }
    
    return {
      success: pendingCount === 0,
      remainingPending: pendingCount,
      syncTime: Date.now() - startTime
    };
  }

  /**
   * Simulate intermittent connectivity
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {Object} options - Configuration options
   * @param {number} options.cycles - Number of offline/online cycles
   * @param {number} options.offlineDuration - Duration to stay offline (ms)
   * @param {number} options.onlineDuration - Duration to stay online (ms)
   * @returns {Promise<void>}
   */
  static async simulateIntermittentConnectivity(page, options = {}) {
    const {
      cycles = 3,
      offlineDuration = 2000,
      onlineDuration = 3000
    } = options;

    for (let i = 0; i < cycles; i++) {
      console.log(`Connectivity cycle ${i + 1}/${cycles}`);
      
      // Go offline
      await this.goOffline(page);
      await page.waitForTimeout(offlineDuration);
      
      // Go online
      await this.goOnline(page);
      await page.waitForTimeout(onlineDuration);
    }
  }

  /**
   * Test offline form submission
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {Object} formData - Form data to submit
   * @param {string} formSelector - CSS selector for the form
   * @returns {Promise<Object>} - Submission result
   */
  static async testOfflineFormSubmission(page, formData, formSelector) {
    // Go offline
    await this.goOffline(page);
    
    // Fill and submit form
    for (const [field, value] of Object.entries(formData)) {
      await page.fill(`${formSelector} [name="${field}"]`, value);
    }
    
    await page.click(`${formSelector} [type="submit"]`);
    
    // Verify form is queued for submission
    const pendingCount = await this.getPendingActionsCount(page);
    
    return {
      success: pendingCount > 0,
      pendingCount
    };
  }

  /**
   * Test data persistence across offline sessions
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} dataKey - Key to check in localStorage
   * @returns {Promise<any>} - Stored data
   */
  static async getOfflineStoredData(page, dataKey) {
    return await page.evaluate((key) => {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }, dataKey);
  }

  /**
   * Clear offline stored data
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} dataKey - Key to clear from localStorage
   * @returns {Promise<void>}
   */
  static async clearOfflineData(page, dataKey = null) {
    await page.evaluate((key) => {
      if (key) {
        localStorage.removeItem(key);
      } else {
        localStorage.clear();
      }
    }, dataKey);
  }
}

module.exports = OfflineHelpers;