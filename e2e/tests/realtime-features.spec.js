const { test, expect } = require('@playwright/test');

/**
 * Real-time Features E2E Tests
 * Tests WebSocket connections, live updates, and concurrent operations
 */

test.describe('Real-time Features', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test user and authentication
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should establish WebSocket connection', async ({ page }) => {
    // Navigate to a real-time enabled page
    await page.goto('/duty-sessions');
    
    // Check that WebSocket connection is established
    const webSocketConnected = await page.evaluate(() => {
      return window.socket && window.socket.connected;
    });
    
    expect(webSocketConnected).toBe(true);
  });

  test('should receive real-time duty session updates', async ({ page, context }) => {
    // Open two pages to simulate concurrent users
    const page2 = await context.newPage();
    
    await page.goto('/duty-sessions');
    await page2.goto('/duty-sessions');
    
    // Wait for both pages to load
    await page.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
    
    // Create a new duty session on page 1
    await page.click('button:has-text("New Session")');
    await page.fill('input[name="sessionName"]', 'Test Session');
    await page.click('button:has-text("Create")');
    
    // Verify page 2 receives the update
    await expect(page2.locator('text=Test Session')).toBeVisible({ timeout: 5000 });
  });

  test('should handle connection loss and reconnection', async ({ page }) => {
    await page.goto('/duty-sessions');
    
    // Simulate network interruption
    await page.context().setOffline(true);
    
    // Verify offline indicator appears
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // Restore connection
    await page.context().setOffline(false);
    
    // Verify connection is restored
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeHidden();
  });

  test('should sync data after reconnection', async ({ page }) => {
    await page.goto('/attendance');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Make changes while offline
    await page.click('button:has-text("Mark Present")');
    
    // Verify changes are queued
    await expect(page.locator('[data-testid="pending-changes"]')).toHaveCount(1);
    
    // Go back online
    await page.context().setOffline(false);
    
    // Verify changes are synced
    await expect(page.locator('[data-testid="pending-changes"]')).toHaveCount(0);
  });

  test('should handle concurrent modifications gracefully', async ({ page, context }) => {
    const page2 = await context.newPage();
    
    await page.goto('/events/1/edit');
    await page2.goto('/events/1/edit');
    
    // Both pages make changes simultaneously
    await Promise.all([
      page.fill('input[name="title"]', 'Updated by User 1'),
      page2.fill('input[name="title"]', 'Updated by User 2')
    ]);
    
    // Submit changes
    await page.click('button:has-text("Save")');
    await page2.click('button:has-text("Save")');
    
    // Verify conflict resolution
    await expect(page.locator('[data-testid="conflict-dialog"]')).toBeVisible();
  });
});