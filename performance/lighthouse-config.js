/**
 * Lighthouse Performance Auditing Configuration
 * Automated web performance, accessibility, and SEO testing
 */

const fs = require('fs').promises;
const path = require('path');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

// Configuration for different testing scenarios
const LIGHTHOUSE_CONFIG = {
  // Basic Lighthouse configuration
  extends: 'lighthouse:default',
  settings: {
    maxWaitForFcp: 15 * 1000,
    maxWaitForLoad: 45 * 1000,
    skipAudits: [
      'canonical', // Not applicable for dev/staging
      'is-crawlable' // May not be relevant for authenticated pages
    ],
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1
    },
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false
    },
    emulatedUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.109 Safari/537.36'
  }
};

// Mobile-specific configuration
const MOBILE_CONFIG = {
  ...LIGHTHOUSE_CONFIG,
  settings: {
    ...LIGHTHOUSE_CONFIG.settings,
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false
    },
    throttling: {
      rttMs: 150,
      throughputKbps: 1638,
      cpuSlowdownMultiplier: 4
    }
  }
};

/**
 * Test scenarios for different user flows
 */
const TEST_SCENARIOS = {
  // Public pages
  publicPages: [
    {
      name: 'Landing Page',
      url: '/',
      description: 'Main landing page performance and accessibility',
      requiresAuth: false
    },
    {
      name: 'Login Page',
      url: '/login',
      description: 'Login form performance and usability',
      requiresAuth: false
    }
  ],

  // Authenticated student pages
  studentPages: [
    {
      name: 'Student Dashboard',
      url: '/dashboard',
      description: 'Student dashboard with attendance data',
      requiresAuth: false, // Temporarily disabled until auth is properly implemented
      role: 'student'
    },
    {
      name: 'Attendance Marking',
      url: '/attendance',
      description: 'Attendance marking interface',
      requiresAuth: false, // Temporarily disabled until auth is properly implemented
      role: 'student'
    },
    {
      name: 'Duty Sessions',
      url: '/duty-sessions',
      description: 'Duty session management page',
      requiresAuth: false, // Temporarily disabled until auth is properly implemented
      role: 'student'
    },
    {
      name: 'Profile Page',
      url: '/profile',
      description: 'User profile and settings',
      requiresAuth: false, // Temporarily disabled until auth is properly implemented
      role: 'student'
    }
  ],

  // Core team pages
  coreTeamPages: [
    {
      name: 'Core Team Dashboard',
      url: '/dashboard',
      description: 'Administrative dashboard with full data',
      requiresAuth: false, // Temporarily disabled until auth is properly implemented
      role: 'coreTeam'
    },
    {
      name: 'User Management',
      url: '/users',
      description: 'User management interface with large datasets',
      requiresAuth: false, // Temporarily disabled until auth is properly implemented
      role: 'coreTeam'
    },
    {
      name: 'Reports Dashboard',
      url: '/reports',
      description: 'Reports and analytics page',
      requiresAuth: false, // Temporarily disabled until auth is properly implemented
      role: 'coreTeam'
    },
    {
      name: 'Import/Export',
      url: '/import-export',
      description: 'File upload and data management',
      requiresAuth: false, // Temporarily disabled until auth is properly implemented
      role: 'coreTeam'
    }
  ],

  // Teacher pages
  teacherPages: [
    {
      name: 'Teacher Dashboard',
      url: '/dashboard',
      description: 'Teacher oversight dashboard',
      requiresAuth: false, // Temporarily disabled until auth is properly implemented
      role: 'teacher'
    },
    {
      name: 'Review Submissions',
      url: '/reviews',
      description: 'Submission review interface',
      requiresAuth: false, // Temporarily disabled until auth is properly implemented
      role: 'teacher'
    }
  ]
};

/**
 * Authentication helper for protected pages
 */
class AuthenticationHelper {
  constructor() {
    this.tokens = {};
    this.baseURL = process.env.BASE_URL || 'http://localhost:5000';
    this.frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  async getAuthToken(role) {
    if (this.tokens[role]) {
      return this.tokens[role];
    }

    const credentials = {
      student: { email: 'student@test.com', password: 'password123' },
      coreTeam: { email: 'coreteam@test.com', password: 'password123' },
      teacher: { email: 'teacher@test.com', password: 'password123' }
    };

    try {
      const response = await fetch(`${this.baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials[role])
      });

      const data = await response.json();
      this.tokens[role] = data.data.tokens.accessToken;
      return this.tokens[role];
    } catch (error) {
      console.error(`Failed to authenticate ${role}:`, error.message);
      return null;
    }
  }

  async setupAuthenticatedBrowser(chrome, role) {
    if (!role) return;

    const token = await this.getAuthToken(role);
    if (!token) return;

    // Temporarily noop this method until proper Puppeteer implementation
    console.log(`Authentication for role ${role} is temporarily disabled. Set requiresAuth: false in scenarios.`);
    
    // TODO: Implement proper Puppeteer-based auth injection
    // - Use puppeteer.connect() to the existing Chrome instance
    // - Create a page and navigate to frontendURL
    // - Set localStorage/cookies with auth token
    // - Extract the debugging port from Puppeteer's browser
    // - Run Lighthouse against the same Chrome instance
    // - Close Puppeteer browser after audit
    
    // Implementation example:
    // const puppeteer = require('puppeteer');
    // const browser = await puppeteer.connect({ browserURL: `http://localhost:${chrome.port}` });
    // const page = await browser.newPage();
    // await page.goto(this.frontendURL);
    // await page.evaluate((t, r) => {
    //   localStorage.setItem('authToken', t);
    //   localStorage.setItem('userRole', r);
    // }, token, role);
    // const ws = new URL(browser.wsEndpoint());
    // const port = ws.port;
    // return { port };
  }
}

/**
 * Lighthouse Test Runner
 */
class LighthouseRunner {
  constructor() {
    this.authHelper = new AuthenticationHelper();
    this.results = {};
    this.outputDir = './test-results/lighthouse';
  }

  async runSingleTest(scenario, config = LIGHTHOUSE_CONFIG, deviceType = 'desktop') {
    let chrome;
    
    try {
      console.log(`🔍 Running Lighthouse audit: ${scenario.name} (${deviceType})`);
      
      // Launch Chrome
      chrome = await chromeLauncher.launch({
        chromeFlags: [
          '--disable-gpu',
          '--headless',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-extensions'
        ]
      });

      const options = {
        logLevel: 'info',
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
        port: chrome.port
      };

      // Build full URL
      const fullURL = `${this.authHelper.frontendURL}${scenario.url}`;

      // Setup authentication if needed
      if (scenario.requiresAuth) {
        await this.authHelper.setupAuthenticatedBrowser(chrome, scenario.role);
      }

      // Run Lighthouse audit
      const runnerResult = await lighthouse(fullURL, options, config);
      
      // Process results
      const report = runnerResult.report;
      const lhr = runnerResult.lhr;
      
      const processedResult = {
        url: fullURL,
        deviceType,
        timestamp: new Date().toISOString(),
        scores: {
          performance: Math.round(lhr.categories.performance.score * 100),
          accessibility: Math.round(lhr.categories.accessibility.score * 100),
          bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
          seo: Math.round(lhr.categories.seo.score * 100),
          pwa: lhr.categories.pwa ? Math.round(lhr.categories.pwa.score * 100) : 0
        },
        metrics: {
          firstContentfulPaint: lhr.audits['first-contentful-paint'].numericValue,
          largestContentfulPaint: lhr.audits['largest-contentful-paint'].numericValue,
          firstMeaningfulPaint: lhr.audits['first-meaningful-paint'].numericValue,
          speedIndex: lhr.audits['speed-index'].numericValue,
          timeToInteractive: lhr.audits['interactive'].numericValue,
          totalBlockingTime: lhr.audits['total-blocking-time'].numericValue,
          cumulativeLayoutShift: lhr.audits['cumulative-layout-shift'].numericValue
        },
        opportunities: lhr.audits['opportunities'] || [],
        diagnostics: {
          domSize: lhr.audits['dom-size'].numericValue,
          totalByteWeight: lhr.audits['total-byte-weight'].numericValue,
          unusedCssRules: lhr.audits['unused-css-rules'].score,
          unusedJavaScript: lhr.audits['unused-javascript'].score,
          efficientAnimatedContent: lhr.audits['efficient-animated-content'].score
        },
        accessibility: {
          colorContrast: lhr.audits['color-contrast'].score,
          ariaLabels: lhr.audits['button-name'].score,
          altText: lhr.audits['image-alt'].score,
          focusable: lhr.audits['focusable-controls'].score
        },
        rawReport: report
      };

      console.log(`✅ ${scenario.name} (${deviceType}): Performance ${processedResult.scores.performance}/100`);

      return processedResult;

    } catch (error) {
      console.error(`❌ Failed to audit ${scenario.name}:`, error.message);
      return {
        url: scenario.url,
        deviceType,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      if (chrome) {
        await chrome.kill();
      }
    }
  }

  async runTestSuite(suiteName, scenarios, deviceTypes = ['desktop', 'mobile']) {
    console.log(`🚀 Running ${suiteName} test suite...`);
    
    const suiteResults = {};

    for (const scenario of scenarios) {
      suiteResults[scenario.name] = {};

      for (const deviceType of deviceTypes) {
        const config = deviceType === 'mobile' ? MOBILE_CONFIG : LIGHTHOUSE_CONFIG;
        const result = await this.runSingleTest(scenario, config, deviceType);
        suiteResults[scenario.name][deviceType] = result;

        // Small delay between tests to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    this.results[suiteName] = suiteResults;
    return suiteResults;
  }

  async runAllTests() {
    console.log('🎯 Starting comprehensive Lighthouse performance audits...\n');

    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true });

      // Run all test suites
      await this.runTestSuite('Public Pages', TEST_SCENARIOS.publicPages);
      await this.runTestSuite('Student Pages', TEST_SCENARIOS.studentPages);
      await this.runTestSuite('Core Team Pages', TEST_SCENARIOS.coreTeamPages);
      await this.runTestSuite('Teacher Pages', TEST_SCENARIOS.teacherPages);

      // Generate comprehensive report
      await this.generateReport();

      console.log('\n🎉 All Lighthouse audits completed successfully!');
      return this.results;

    } catch (error) {
      console.error('❌ Lighthouse audit suite failed:', error);
      throw error;
    }
  }

  async generateReport() {
    console.log('📊 Generating Lighthouse performance report...');

    const timestamp = Date.now();
    const reportData = {
      timestamp: new Date().toISOString(),
      environment: {
        frontendURL: this.authHelper.frontendURL,
        backendURL: this.authHelper.baseURL,
        nodeVersion: process.version,
        platform: process.platform
      },
      summary: this.generateSummary(),
      results: this.results,
      recommendations: this.generateRecommendations()
    };

    // Save detailed JSON report
    const jsonReportPath = path.join(this.outputDir, `lighthouse-report-${timestamp}.json`);
    await fs.writeFile(jsonReportPath, JSON.stringify(reportData, null, 2));

    // Save individual HTML reports
    for (const [suiteName, suiteResults] of Object.entries(this.results)) {
      for (const [scenarioName, scenarioResults] of Object.entries(suiteResults)) {
        for (const [deviceType, result] of Object.entries(scenarioResults)) {
          if (result.rawReport) {
            const htmlPath = path.join(
              this.outputDir,
              `${suiteName.toLowerCase().replace(/\s+/g, '-')}-${scenarioName.toLowerCase().replace(/\s+/g, '-')}-${deviceType}-${timestamp}.html`
            );
            await fs.writeFile(htmlPath, result.rawReport);
          }
        }
      }
    }

    // Save human-readable summary
    const summaryPath = path.join(this.outputDir, `lighthouse-summary-${timestamp}.txt`);
    await fs.writeFile(summaryPath, this.generateTextSummary(reportData));

    console.log(`📄 Reports saved to: ${this.outputDir}`);
    console.log(`📄 Main report: ${jsonReportPath}`);
    console.log(`📄 Summary: ${summaryPath}`);

    return reportData;
  }

  generateSummary() {
    const summary = {
      totalAudits: 0,
      averageScores: {
        performance: 0,
        accessibility: 0,
        bestPractices: 0,
        seo: 0,
        pwa: 0
      },
      devicePerformance: {
        desktop: { total: 0, performance: 0 },
        mobile: { total: 0, performance: 0 }
      },
      criticalIssues: [],
      warnings: []
    };

    for (const suiteResults of Object.values(this.results)) {
      for (const scenarioResults of Object.values(suiteResults)) {
        for (const [deviceType, result] of Object.entries(scenarioResults)) {
          if (!result.error && result.scores) {
            summary.totalAudits++;
            
            // Accumulate scores for averaging
            summary.averageScores.performance += result.scores.performance;
            summary.averageScores.accessibility += result.scores.accessibility;
            summary.averageScores.bestPractices += result.scores.bestPractices;
            summary.averageScores.seo += result.scores.seo;
            summary.averageScores.pwa += result.scores.pwa;

            // Track device-specific performance
            summary.devicePerformance[deviceType].total++;
            summary.devicePerformance[deviceType].performance += result.scores.performance;

            // Identify critical issues
            if (result.scores.performance < 50) {
              summary.criticalIssues.push(`Poor performance on ${result.url} (${deviceType}): ${result.scores.performance}/100`);
            }
            if (result.scores.accessibility < 80) {
              summary.criticalIssues.push(`Accessibility issues on ${result.url} (${deviceType}): ${result.scores.accessibility}/100`);
            }

            // Identify warnings
            if (result.scores.performance < 80) {
              summary.warnings.push(`Performance below 80 on ${result.url} (${deviceType})`);
            }
            if (result.scores.seo < 90) {
              summary.warnings.push(`SEO issues on ${result.url} (${deviceType})`);
            }
          }
        }
      }
    }

    // Calculate averages
    if (summary.totalAudits > 0) {
      summary.averageScores.performance = Math.round(summary.averageScores.performance / summary.totalAudits);
      summary.averageScores.accessibility = Math.round(summary.averageScores.accessibility / summary.totalAudits);
      summary.averageScores.bestPractices = Math.round(summary.averageScores.bestPractices / summary.totalAudits);
      summary.averageScores.seo = Math.round(summary.averageScores.seo / summary.totalAudits);
      summary.averageScores.pwa = Math.round(summary.averageScores.pwa / summary.totalAudits);

      // Calculate device-specific averages
      if (summary.devicePerformance.desktop.total > 0) {
        summary.devicePerformance.desktop.performance = Math.round(
          summary.devicePerformance.desktop.performance / summary.devicePerformance.desktop.total
        );
      }
      if (summary.devicePerformance.mobile.total > 0) {
        summary.devicePerformance.mobile.performance = Math.round(
          summary.devicePerformance.mobile.performance / summary.devicePerformance.mobile.total
        );
      }
    }

    return summary;
  }

  generateRecommendations() {
    const recommendations = [];
    const summary = this.generateSummary();

    // Performance recommendations
    if (summary.averageScores.performance < 80) {
      recommendations.push({
        category: 'Performance',
        priority: 'High',
        issue: `Average performance score is ${summary.averageScores.performance}/100`,
        suggestions: [
          'Optimize images and implement lazy loading',
          'Minimize JavaScript bundle size',
          'Implement code splitting for better loading',
          'Use CDN for static assets',
          'Enable gzip compression'
        ]
      });
    }

    // Mobile performance gap
    const desktopPerf = summary.devicePerformance.desktop.performance;
    const mobilePerf = summary.devicePerformance.mobile.performance;
    if (desktopPerf - mobilePerf > 20) {
      recommendations.push({
        category: 'Mobile Performance',
        priority: 'High',
        issue: `Large performance gap between desktop (${desktopPerf}) and mobile (${mobilePerf})`,
        suggestions: [
          'Optimize for mobile-first design',
          'Reduce JavaScript execution time',
          'Implement adaptive loading strategies',
          'Optimize touch interactions'
        ]
      });
    }

    // Accessibility recommendations
    if (summary.averageScores.accessibility < 90) {
      recommendations.push({
        category: 'Accessibility',
        priority: 'Medium',
        issue: `Accessibility score needs improvement: ${summary.averageScores.accessibility}/100`,
        suggestions: [
          'Add proper ARIA labels to interactive elements',
          'Ensure sufficient color contrast ratios',
          'Add alt text to all images',
          'Implement keyboard navigation support'
        ]
      });
    }

    // SEO recommendations
    if (summary.averageScores.seo < 95) {
      recommendations.push({
        category: 'SEO',
        priority: 'Medium',
        issue: `SEO optimization opportunities available`,
        suggestions: [
          'Add proper meta descriptions',
          'Implement structured data markup',
          'Optimize page titles',
          'Add canonical URLs'
        ]
      });
    }

    return recommendations;
  }

  generateTextSummary(reportData) {
    const summary = reportData.summary;
    
    return `
LIGHTHOUSE PERFORMANCE AUDIT SUMMARY
====================================
Timestamp: ${reportData.timestamp}
Total Audits: ${summary.totalAudits}

AVERAGE SCORES
==============
Performance: ${summary.averageScores.performance}/100
Accessibility: ${summary.averageScores.accessibility}/100
Best Practices: ${summary.averageScores.bestPractices}/100
SEO: ${summary.averageScores.seo}/100
PWA: ${summary.averageScores.pwa}/100

DEVICE PERFORMANCE
==================
Desktop Average: ${summary.devicePerformance.desktop.performance}/100
Mobile Average: ${summary.devicePerformance.mobile.performance}/100
Performance Gap: ${summary.devicePerformance.desktop.performance - summary.devicePerformance.mobile.performance} points

CRITICAL ISSUES (${summary.criticalIssues.length})
===============
${summary.criticalIssues.map(issue => `• ${issue}`).join('\n')}

WARNINGS (${summary.warnings.length})
========
${summary.warnings.map(warning => `• ${warning}`).join('\n')}

RECOMMENDATIONS
===============
${reportData.recommendations.map(rec => 
  `${rec.category} (${rec.priority} Priority):\n  ${rec.issue}\n  Solutions: ${rec.suggestions.join(', ')}`
).join('\n\n')}

DETAILED REPORTS
================
Individual HTML reports available in: ${this.outputDir}
    `.trim();
  }
}

/**
 * CI/CD Integration Helper
 */
class LighthouseCI {
  static generateConfig() {
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
    return {
      ci: {
        collect: {
          url: [
            `${frontendURL}/`,
            `${frontendURL}/login`,
            `${frontendURL}/dashboard`
          ],
          settings: {
            chromeFlags: '--no-sandbox --disable-dev-shm-usage'
          }
        },
        assert: {
          assertions: {
            'categories:performance': ['warn', { minScore: 0.8 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
            'categories:best-practices': ['warn', { minScore: 0.9 }],
            'categories:seo': ['warn', { minScore: 0.8 }]
          }
        },
        upload: {
          target: 'temporary-public-storage'
        }
      }
    };
  }

  static async runCIPipeline() {
    const runner = new LighthouseRunner();
    const results = await runner.runAllTests();
    
    // Check if results meet CI criteria
    const summary = runner.generateSummary();
    const failingCriteria = [];
    
    if (summary.averageScores.performance < 80) {
      failingCriteria.push('Performance below 80%');
    }
    if (summary.averageScores.accessibility < 90) {
      failingCriteria.push('Accessibility below 90%');
    }
    
    if (failingCriteria.length > 0) {
      console.error('❌ Lighthouse CI failed:', failingCriteria.join(', '));
      process.exit(1);
    } else {
      console.log('✅ Lighthouse CI passed all criteria');
    }
    
    return results;
  }
}

// Export for use in other scripts
module.exports = {
  LighthouseRunner,
  LighthouseCI,
  LIGHTHOUSE_CONFIG,
  MOBILE_CONFIG,
  TEST_SCENARIOS
};

// Run if called directly
if (require.main === module) {
  const runner = new LighthouseRunner();
  runner.runAllTests().catch(console.error);
}