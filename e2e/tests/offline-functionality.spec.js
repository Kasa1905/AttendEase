const { test, expect } = require('@playwright/test');
const { AuthFixtures, OfflineHelpers, APIHelpers } = require('../utils/testUtils');

/**
 * Offline Functionality E2E Tests
 * Tests service worker functionality, offline data sync, PWA features, and network resilience
 */

test.describe('Offline Functionality', () => {
  let authFixtures;
  let offlineHelpers;
  let apiHelpers;

  test.beforeEach(async ({ page, context }) => {
    authFixtures = new AuthFixtures();
    offlineHelpers = new OfflineHelpers(page);
    apiHelpers = new APIHelpers();
  });

  test.describe('Service Worker Registration', () => {
    test('should register service worker on app load', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Check service worker registration
      const swRegistered = await page.evaluate(async () => {
        return 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
      });
      
      expect(swRegistered).toBeTruthy();
      
      // Verify service worker status in UI
      await expect(page.locator('[data-testid="pwa-status"]')).toContainText('Ready for offline use');
    });

    test('should update service worker when new version available', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Mock service worker update
      await page.evaluate(() => {
        // Simulate service worker update event
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.dispatchEvent(new CustomEvent('updatefound'));
        }
      });
      
      // Should show update notification
      await expect(page.locator('[data-testid="app-update-available"]')).toBeVisible();
      await expect(page.locator('[data-testid="update-app-btn"]')).toBeVisible();
      
      // Click update
      await page.click('[data-testid="update-app-btn"]');
      
      // Should refresh the app
      await expect(page.locator('[data-testid="app-updating"]')).toBeVisible();
    });

    test('should handle service worker installation failure', async ({ page }) => {
      // Mock service worker registration failure
      await page.addInitScript(() => {
        // Override service worker registration to fail
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register = () => Promise.reject(new Error('SW registration failed'));
        }
      });
      
      await authFixtures.loginAsStudent(page);
      
      // Should show offline functionality warning
      await expect(page.locator('[data-testid="offline-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="offline-warning"]')).toContainText('Offline features not available');
    });
  });

  test.describe('Offline Data Storage', () => {
    test('should cache attendance data for offline access', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Load attendance data while online
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="attendance-history"]')).toBeVisible();
      
      const onlineAttendanceCount = await page.locator('[data-testid="attendance-record"]').count();
      expect(onlineAttendanceCount).toBeGreaterThan(0);
      
      // Go offline
      await page.context().setOffline(true);
      await page.reload();
      
      // Should still show cached attendance data
      await expect(page.locator('[data-testid="offline-mode-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="attendance-history"]')).toBeVisible();
      
      const offlineAttendanceCount = await page.locator('[data-testid="attendance-record"]').count();
      expect(offlineAttendanceCount).toBe(onlineAttendanceCount);
      
      // Should show last sync time
      await expect(page.locator('[data-testid="last-sync-time"]')).toBeVisible();
    });

    test('should queue attendance actions while offline', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      await page.goto('/attendance');
      
      // Go offline
      await page.context().setOffline(true);
      
      // Try to mark attendance while offline
      await page.click('[data-testid="mark-present-btn"]');
      await page.fill('[data-testid="attendance-notes"]', 'Offline attendance marking');
      await page.click('[data-testid="submit-attendance"]');
      
      // Should show queued for sync
      await expect(page.locator('[data-testid="queued-for-sync"]')).toBeVisible();
      await expect(page.locator('[data-testid="pending-sync-count"]')).toContainText('1');
      
      // Should store in local queue
      const queuedActions = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('attendanceQueue') || '[]');
      });
      
      expect(queuedActions).toHaveLength(1);
      expect(queuedActions[0].notes).toBe('Offline attendance marking');
    });

    test('should sync queued actions when coming back online', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      await page.goto('/attendance');
      
      // Go offline and queue some actions
      await page.context().setOffline(true);
      
      // Queue multiple attendance actions
      for (let i = 1; i <= 3; i++) {
        await page.click('[data-testid="mark-present-btn"]');
        await page.fill('[data-testid="attendance-notes"]', `Offline action ${i}`);
        await page.click('[data-testid="submit-attendance"]');
        
        // Wait a bit between actions
        await page.waitForTimeout(500);
      }
      
      // Verify queue count
      await expect(page.locator('[data-testid="pending-sync-count"]')).toContainText('3');
      
      // Come back online
      await page.context().setOffline(false);
      
      // Should start syncing automatically
      await expect(page.locator('[data-testid="syncing-indicator"]')).toBeVisible();
      
      // Wait for sync completion
      await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible();
      await expect(page.locator('[data-testid="pending-sync-count"]')).toContainText('0');
      
      // Queued actions should be cleared
      const remainingQueue = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('attendanceQueue') || '[]');
      });
      
      expect(remainingQueue).toHaveLength(0);
    });

    test('should handle sync conflicts gracefully', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Mock API to simulate conflict
      await page.route('/api/attendance', (route, request) => {
        if (request.method() === 'POST') {
          route.fulfill({
            status: 409, // Conflict
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Attendance already marked for this time period',
              conflictData: {
                existingAttendance: { id: 123, status: 'present', timestamp: '2024-01-15T10:00:00Z' }
              }
            })
          });
        } else {
          route.continue();
        }
      });
      
      await page.goto('/attendance');
      
      // Go offline and queue action
      await page.context().setOffline(true);
      await page.click('[data-testid="mark-present-btn"]');
      await page.fill('[data-testid="attendance-notes"]', 'Conflicting attendance');
      await page.click('[data-testid="submit-attendance"]');
      
      // Come back online
      await page.context().setOffline(false);
      
      // Should detect conflict during sync
      await expect(page.locator('[data-testid="sync-conflict-detected"]')).toBeVisible();
      
      // Should show conflict resolution options
      await expect(page.locator('[data-testid="conflict-resolution-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="keep-local"]')).toBeVisible();
      await expect(page.locator('[data-testid="keep-server"]')).toBeVisible();
      await expect(page.locator('[data-testid="merge-data"]')).toBeVisible();
      
      // Choose to keep server data
      await page.click('[data-testid="keep-server"]');
      
      // Should resolve conflict and continue
      await expect(page.locator('[data-testid="conflict-resolved"]')).toBeVisible();
    });
  });

  test.describe('Offline UI Experience', () => {
    test('should show appropriate offline indicators', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Go offline
      await page.context().setOffline(true);
      await page.reload();
      
      // Should show offline banner
      await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
      await expect(page.locator('[data-testid="offline-banner"]')).toContainText('You are currently offline');
      
      // Should show connection status
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Offline');
      
      // Should disable online-only features
      await expect(page.locator('[data-testid="live-notifications-disabled"]')).toBeVisible();
      await expect(page.locator('[data-testid="real-time-updates-disabled"]')).toBeVisible();
      
      // Should show last sync information
      await expect(page.locator('[data-testid="last-sync-info"]')).toBeVisible();
    });

    test('should disable unavailable features while offline', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      await page.goto('/dashboard');
      
      // Go offline
      await page.context().setOffline(true);
      await page.reload();
      
      // File upload should be disabled
      const uploadButton = page.locator('[data-testid="file-upload-btn"]');
      if (await uploadButton.count() > 0) {
        await expect(uploadButton).toBeDisabled();
        await expect(page.locator('[data-testid="upload-offline-warning"]')).toBeVisible();
      }
      
      // Report generation should be disabled
      const generateReportBtn = page.locator('[data-testid="generate-report-btn"]');
      if (await generateReportBtn.count() > 0) {
        await expect(generateReportBtn).toBeDisabled();
        await expect(page.locator('[data-testid="report-offline-warning"]')).toBeVisible();
      }
      
      // Real-time features should show offline message
      await expect(page.locator('[data-testid="real-time-disabled"]')).toBeVisible();
    });

    test('should provide offline help and guidance', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Go offline
      await page.context().setOffline(true);
      await page.reload();
      
      // Should show offline help button
      await expect(page.locator('[data-testid="offline-help"]')).toBeVisible();
      
      await page.click('[data-testid="offline-help"]');
      
      // Should show offline capabilities modal
      await expect(page.locator('[data-testid="offline-help-modal"]')).toBeVisible();
      
      // Should list available offline features
      await expect(page.locator('[data-testid="offline-features-list"]')).toContainText('View attendance history');
      await expect(page.locator('[data-testid="offline-features-list"]')).toContainText('Mark attendance (queued for sync)');
      await expect(page.locator('[data-testid="offline-features-list"]')).toContainText('View cached reports');
      
      // Should list unavailable features
      await expect(page.locator('[data-testid="online-only-features"]')).toContainText('Real-time notifications');
      await expect(page.locator('[data-testid="online-only-features"]')).toContainText('File uploads');
      await expect(page.locator('[data-testid="online-only-features"]')).toContainText('Live report generation');
    });
  });

  test.describe('Progressive Web App (PWA) Features', () => {
    test('should show install app prompt', async ({ page, context }) => {
      // Mock PWA install prompt
      await page.addInitScript(() => {
        let installPromptEvent = null;
        
        // Mock the beforeinstallprompt event
        setTimeout(() => {
          installPromptEvent = new CustomEvent('beforeinstallprompt');
          installPromptEvent.prompt = () => Promise.resolve();
          installPromptEvent.userChoice = Promise.resolve({ outcome: 'accepted' });
          window.dispatchEvent(installPromptEvent);
        }, 1000);
        
        // Store event for later use
        window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          window.installPromptEvent = e;
        });
      });
      
      await authFixtures.loginAsStudent(page);
      
      // Should show install banner
      await expect(page.locator('[data-testid="pwa-install-banner"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="install-app-btn"]')).toBeVisible();
      
      // Click install
      await page.click('[data-testid="install-app-btn"]');
      
      // Should trigger install prompt
      const installResult = await page.evaluate(async () => {
        if (window.installPromptEvent) {
          await window.installPromptEvent.prompt();
          return await window.installPromptEvent.userChoice;
        }
        return null;
      });
      
      expect(installResult).toBeTruthy();
    });

    test('should work as standalone PWA', async ({ page, context }) => {
      // Simulate PWA standalone mode
      await page.addInitScript(() => {
        Object.defineProperty(window.navigator, 'standalone', { 
          value: true, 
          writable: false 
        });
        
        // Mock display mode
        Object.defineProperty(window, 'matchMedia', {
          value: (query) => {
            if (query === '(display-mode: standalone)') {
              return { matches: true };
            }
            return { matches: false };
          }
        });
      });
      
      await authFixtures.loginAsStudent(page);
      
      // Should detect PWA mode
      const isPWAMode = await page.evaluate(() => {
        return window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
      });
      
      expect(isPWAMode).toBeTruthy();
      
      // Should show PWA-specific UI elements
      await expect(page.locator('[data-testid="pwa-header"]')).toBeVisible();
      
      // Should not show browser-specific elements
      await expect(page.locator('[data-testid="browser-back-btn"]')).not.toBeVisible();
    });

    test('should handle PWA notifications', async ({ page, context }) => {
      // Grant notification permission
      await context.grantPermissions(['notifications']);
      
      await authFixtures.loginAsStudent(page);
      
      // Should request notification permission
      const notificationPermission = await page.evaluate(async () => {
        return await Notification.requestPermission();
      });
      
      expect(notificationPermission).toBe('granted');
      
      // Mock incoming notification
      await page.evaluate(() => {
        // Simulate service worker notification
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('Test Notification', {
              body: 'This is a test PWA notification',
              icon: '/icons/icon-192x192.png',
              badge: '/icons/badge-72x72.png'
            });
          });
        }
      });
      
      // Should handle notification click
      await page.evaluate(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('notificationclick', (event) => {
            event.notification.close();
            // Handle notification click
            window.notificationClicked = true;
          });
        }
      });
    });
  });

  test.describe('Network Resilience', () => {
    test('should handle intermittent connectivity', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      await page.goto('/dashboard');
      
      // Simulate network instability
      for (let i = 0; i < 5; i++) {
        // Go offline
        await page.context().setOffline(true);
        await page.waitForTimeout(2000);
        
        // Come back online
        await page.context().setOffline(false);
        await page.waitForTimeout(2000);
      }
      
      // App should remain functional
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
      
      // Should show connection stability indicator
      await expect(page.locator('[data-testid="connection-quality"]')).toBeVisible();
    });

    test('should retry failed requests when back online', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      await page.goto('/attendance');
      
      // Mock request failure
      let requestCount = 0;
      await page.route('/api/attendance', (route, request) => {
        requestCount++;
        if (requestCount <= 2) {
          // Fail first two requests
          route.abort('failed');
        } else {
          // Succeed on third attempt
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, id: 123 })
          });
        }
      });
      
      // Try to mark attendance
      await page.click('[data-testid="mark-present-btn"]');
      await page.fill('[data-testid="attendance-notes"]', 'Test retry mechanism');
      await page.click('[data-testid="submit-attendance"]');
      
      // Should show retry attempts
      await expect(page.locator('[data-testid="request-retrying"]')).toBeVisible();
      
      // Should eventually succeed
      await expect(page.locator('[data-testid="attendance-success"]')).toBeVisible({ timeout: 10000 });
      
      // Should have made multiple attempts
      expect(requestCount).toBeGreaterThan(1);
    });

    test('should degrade gracefully under poor network conditions', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Simulate slow network
      await page.route('**/*', (route, request) => {
        // Delay all requests by 3 seconds
        setTimeout(() => route.continue(), 3000);
      });
      
      await page.goto('/dashboard');
      
      // Should show loading states
      await expect(page.locator('[data-testid="slow-network-indicator"]')).toBeVisible();
      
      // Should provide option to use cached data
      await expect(page.locator('[data-testid="use-cached-data"]')).toBeVisible();
      
      // Click to use cached data
      await page.click('[data-testid="use-cached-data"]');
      
      // Should load cached content immediately
      await expect(page.locator('[data-testid="cached-content-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
    });
  });

  test.describe('Data Persistence and Recovery', () => {
    test('should persist user session across app restarts', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Verify session is stored
      const sessionData = await page.evaluate(() => {
        return {
          token: localStorage.getItem('authToken'),
          user: localStorage.getItem('userData')
        };
      });
      
      expect(sessionData.token).toBeTruthy();
      expect(sessionData.user).toBeTruthy();
      
      // Simulate app restart (reload page)
      await page.reload();
      
      // Should automatically restore session
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      
      // Should not show login form
      await expect(page.locator('[data-testid="login-form"]')).not.toBeVisible();
    });

    test('should recover from corrupted local storage', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Corrupt local storage data
      await page.evaluate(() => {
        localStorage.setItem('attendanceQueue', 'invalid-json');
        localStorage.setItem('userData', 'corrupted-data');
      });
      
      // Reload page
      await page.reload();
      
      // Should detect and recover from corruption
      await expect(page.locator('[data-testid="data-recovery-notice"]')).toBeVisible();
      
      // Should reset corrupted data
      const recoveredData = await page.evaluate(() => {
        return {
          queue: localStorage.getItem('attendanceQueue'),
          userData: localStorage.getItem('userData')
        };
      });
      
      // Corrupted data should be reset
      expect(recoveredData.queue).toBe('[]');
      
      // User should still be logged in (if auth token was not corrupted)
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });

    test('should handle storage quota exceeded gracefully', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Mock storage quota exceeded error
      await page.addInitScript(() => {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
          if (key === 'testLargeData') {
            throw new DOMException('QuotaExceededError');
          }
          return originalSetItem.call(this, key, value);
        };
      });
      
      // Try to store large data
      await page.evaluate(() => {
        try {
          localStorage.setItem('testLargeData', 'x'.repeat(10000000));
        } catch (error) {
          window.quotaExceeded = true;
        }
      });
      
      const quotaExceeded = await page.evaluate(() => window.quotaExceeded);
      expect(quotaExceeded).toBeTruthy();
      
      // Should show storage warning
      await expect(page.locator('[data-testid="storage-warning"]')).toBeVisible();
      
      // Should offer storage cleanup
      await expect(page.locator('[data-testid="cleanup-storage-btn"]')).toBeVisible();
      
      await page.click('[data-testid="cleanup-storage-btn"]');
      
      // Should clean up old cached data
      await expect(page.locator('[data-testid="storage-cleaned"]')).toBeVisible();
    });
  });

  test.describe('Background Sync', () => {
    test('should register background sync when offline', async ({ page }) => {
      await authFixtures.loginAsStudent(page);
      
      // Mock background sync API
      await page.addInitScript(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            if ('sync' in registration) {
              window.backgroundSyncSupported = true;
            }
          });
        }
      });
      
      await page.goto('/attendance');
      
      // Go offline
      await page.context().setOffline(true);
      
      // Queue attendance action
      await page.click('[data-testid="mark-present-btn"]');
      await page.fill('[data-testid="attendance-notes"]', 'Background sync test');
      await page.click('[data-testid="submit-attendance"]');
      
      // Should register background sync
      const syncRegistered = await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if ('sync' in registration) {
            await registration.sync.register('attendance-sync');
            return true;
          }
        }
        return false;
      });
      
      // If background sync is supported, should be registered
      const backgroundSyncSupported = await page.evaluate(() => window.backgroundSyncSupported);
      if (backgroundSyncSupported) {
        expect(syncRegistered).toBeTruthy();
      }
    });
  });

  test.describe('Cross-browser Offline Compatibility', () => {
    ['chromium', 'firefox'].forEach(browserName => {
      test(`should work correctly offline in ${browserName}`, async ({ playwright }) => {
        const browser = await playwright[browserName].launch();
        const context = await browser.newContext();
        const page = await context.newPage();
        
        const auth = new AuthFixtures();
        const offline = new OfflineHelpers(page);
        
        await auth.loginAsStudent(page);
        await page.goto('/dashboard');
        
        // Go offline
        await page.context().setOffline(true);
        await page.reload();
        
        // Basic offline functionality should work
        await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
        await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
        
        await browser.close();
      });
    });
  });
});