const { test, expect, chromium } = require('@playwright/test');
const lighthouse = require('lighthouse');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

/**
 * Performance Testing with Lighthouse
 * Tests web performance metrics and generates audit reports
 */

test.describe('Performance Tests', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Use chromium for Lighthouse compatibility
    browser = await chromium.launch({
      args: ['--remote-debugging-port=9222']
    });
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
    await browser.close();
  });

  test('should meet performance benchmarks for dashboard', async () => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Get the current URL
    const currentUrl = page.url();
    
    // Run Lighthouse audit
    const lighthouseResult = await runLighthouseAudit(currentUrl);
    
    // Assert performance thresholds
    expect(lighthouseResult.lhr.categories.performance.score).toBeGreaterThan(0.7); // 70%
    expect(lighthouseResult.lhr.categories.accessibility.score).toBeGreaterThan(0.8); // 80%
    expect(lighthouseResult.lhr.categories['best-practices'].score).toBeGreaterThan(0.8); // 80%
    
    // Generate report
    await saveReport(lighthouseResult, 'dashboard-performance');
  });

  test('should meet performance benchmarks for attendance page', async () => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'student@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to attendance
    await page.goto('/attendance');
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    const lighthouseResult = await runLighthouseAudit(currentUrl);
    
    // Performance thresholds for data-heavy page
    expect(lighthouseResult.lhr.categories.performance.score).toBeGreaterThan(0.6); // 60%
    expect(lighthouseResult.lhr.audits['first-contentful-paint'].numericValue).toBeLessThan(3000);
    expect(lighthouseResult.lhr.audits['largest-contentful-paint'].numericValue).toBeLessThan(4000);
    
    await saveReport(lighthouseResult, 'attendance-performance');
  });

  test('should meet performance benchmarks for mobile experience', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/login');
    await page.fill('input[name="email"]', 'student@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    const currentUrl = page.url();
    
    // Run mobile Lighthouse audit
    const lighthouseResult = await runLighthouseAudit(currentUrl, {
      mobile: true
    });
    
    // Mobile performance thresholds
    expect(lighthouseResult.lhr.categories.performance.score).toBeGreaterThan(0.5); // 50%
    expect(lighthouseResult.lhr.audits['cumulative-layout-shift'].numericValue).toBeLessThan(0.2);
    
    await saveReport(lighthouseResult, 'mobile-performance');
  });

  test('should have good SEO and accessibility scores', async () => {
    // Test public pages that don't require authentication
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    const lighthouseResult = await runLighthouseAudit(currentUrl);
    
    // SEO and accessibility requirements
    expect(lighthouseResult.lhr.categories.seo.score).toBeGreaterThan(0.8);
    expect(lighthouseResult.lhr.categories.accessibility.score).toBeGreaterThan(0.9);
    expect(lighthouseResult.lhr.categories.pwa.score).toBeGreaterThan(0.3);
    
    await saveReport(lighthouseResult, 'seo-accessibility');
  });
});

/**
 * Run Lighthouse audit on a URL
 * @param {string} url - URL to audit
 * @param {Object} options - Lighthouse options
 * @returns {Promise<Object>} Lighthouse result
 */
async function runLighthouseAudit(url, options = {}) {
  const config = {
    extends: 'lighthouse:default',
    settings: {
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
      ...options.mobile && {
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
          disabled: false
        }
      }
    }
  };

  try {
    const result = await lighthouse(url, {
      port: 9222,
      disableStorageReset: true,
      ...options
    }, config);
    
    return result;
  } catch (error) {
    console.error('Lighthouse audit failed:', error);
    throw error;
  }
}

/**
 * Save Lighthouse report to file
 * @param {Object} result - Lighthouse result
 * @param {string} filename - Report filename
 */
async function saveReport(result, filename) {
  try {
    const reportsDir = path.join(__dirname, '..', 'reports', 'lighthouse');
    
    // Ensure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Save HTML report
    const htmlReport = result.report;
    const htmlPath = path.join(reportsDir, `${filename}-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, htmlReport);
    
    // Save JSON results for CI analysis
    const jsonPath = path.join(reportsDir, `${filename}-${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(result.lhr, null, 2));
    
    console.log(`Lighthouse report saved: ${htmlPath}`);
    console.log(`Lighthouse results saved: ${jsonPath}`);
  } catch (error) {
    console.warn('Failed to save Lighthouse report:', error.message);
  }
}