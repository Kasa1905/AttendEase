const autocannon = require('autocannon');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

/**
 * Custom Node.js Performance Benchmarking Suite
 * Provides detailed API and system performance analysis
 */

// Configuration
const CONFIG = {
  baseURL: process.env.BASE_URL || 'http://localhost:5000',
  duration: 30, // seconds
  connections: 10,
  pipelining: 1,
  timeout: 30000,
  outputDir: './test-results/performance'
};

// Test credentials
const TEST_CREDENTIALS = {
  student: { email: 'student@test.com', password: 'password123' },
  coreTeam: { email: 'coreteam@test.com', password: 'password123' },
  teacher: { email: 'teacher@test.com', password: 'password123' }
};

/**
 * Authentication Helper
 */
async function authenticate(credentials) {
  const response = await fetch(`${CONFIG.baseURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  
  const data = await response.json();
  return data.data.tokens.accessToken;
}

/**
 * API Endpoint Benchmarking
 */
class APIBenchmark {
  constructor() {
    this.results = {};
  }

  async runEndpointTest(name, config) {
    console.log(`🚀 Running ${name} benchmark...`);
    
    const startTime = performance.now();
    
    try {
      const instance = autocannon(config);
      const result = await instance;
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.results[name] = {
        ...result,
        testDuration: duration,
        timestamp: new Date().toISOString(),
        success: true
      };
      
      console.log(`✅ ${name} completed`);
      console.log(`   Average latency: ${result.latency.average}ms`);
      console.log(`   Requests/sec: ${result.requests.average}`);
      console.log(`   Total requests: ${result.requests.total}`);
      console.log(`   Error rate: ${((result.errors || 0) / result.requests.total * 100).toFixed(2)}%`);
      
    } catch (error) {
      console.error(`❌ ${name} failed:`, error.message);
      this.results[name] = {
        error: error.message,
        timestamp: new Date().toISOString(),
        success: false
      };
    }
  }

  async benchmarkAuthentication() {
    await this.runEndpointTest('Authentication - Student Login', {
      url: `${CONFIG.baseURL}/api/auth/login`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS.student),
      duration: CONFIG.duration,
      connections: CONFIG.connections
    });

    await this.runEndpointTest('Authentication - Core Team Login', {
      url: `${CONFIG.baseURL}/api/auth/login`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS.coreTeam),
      duration: CONFIG.duration,
      connections: CONFIG.connections
    });
  }

  async benchmarkAttendanceEndpoints() {
    const token = await authenticate(TEST_CREDENTIALS.student);
    
    await this.runEndpointTest('Attendance - Mark Present', {
      url: `${CONFIG.baseURL}/api/attendance`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: 'present_in_class',
        notes: 'Performance test attendance'
      }),
      duration: CONFIG.duration,
      connections: CONFIG.connections
    });

    await this.runEndpointTest('Attendance - Get History', {
      url: `${CONFIG.baseURL}/api/attendance/history`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      duration: CONFIG.duration,
      connections: CONFIG.connections
    });
  }

  async benchmarkUserManagement() {
    const token = await authenticate(TEST_CREDENTIALS.coreTeam);
    
    await this.runEndpointTest('Users - List All', {
      url: `${CONFIG.baseURL}/api/users`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      duration: CONFIG.duration,
      connections: CONFIG.connections
    });

    await this.runEndpointTest('Users - Search', {
      url: `${CONFIG.baseURL}/api/users?search=test&limit=50`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      duration: CONFIG.duration,
      connections: CONFIG.connections
    });
  }

  async benchmarkReportGeneration() {
    const token = await authenticate(TEST_CREDENTIALS.coreTeam);
    
    await this.runEndpointTest('Reports - Attendance Summary', {
      url: `${CONFIG.baseURL}/api/reports/generate`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: 'attendance-summary',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        format: 'json'
      }),
      duration: 15, // Shorter duration for expensive operations
      connections: 5
    });
  }
}

/**
 * Database Performance Testing
 */
class DatabaseBenchmark {
  constructor() {
    this.results = {};
  }

  async benchmarkDatabaseQueries() {
    console.log('🗄️ Running database performance tests...');
    
    const token = await authenticate(TEST_CREDENTIALS.coreTeam);
    
    // Test heavy query operations
    const heavyQueries = [
      {
        name: 'Complex Attendance Report Query',
        endpoint: '/api/reports/detailed-attendance',
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          includeStrikes: true,
          includeLogs: true
        }
      },
      {
        name: 'Cross-Reference User Data',
        endpoint: '/api/users/analytics',
        payload: {
          includeAttendance: true,
          includeStrikes: true,
          includeDutySessions: true
        }
      }
    ];

    for (const query of heavyQueries) {
      const startTime = performance.now();
      
      try {
        const response = await fetch(`${CONFIG.baseURL}${query.endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(query.payload)
        });
        
        const data = await response.json();
        const endTime = performance.now();
        
        this.results[query.name] = {
          responseTime: endTime - startTime,
          dataSize: JSON.stringify(data).length,
          success: response.ok,
          timestamp: new Date().toISOString()
        };
        
        console.log(`✅ ${query.name}: ${(endTime - startTime).toFixed(2)}ms`);
        
      } catch (error) {
        console.error(`❌ ${query.name} failed:`, error.message);
        this.results[query.name] = { error: error.message, success: false };
      }
    }
  }
}

/**
 * Memory Usage Monitoring
 */
class MemoryBenchmark {
  constructor() {
    this.snapshots = [];
  }

  takeSnapshot(label) {
    const usage = process.memoryUsage();
    const snapshot = {
      label,
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    };
    
    this.snapshots.push(snapshot);
    
    console.log(`📊 Memory snapshot (${label}):`);
    console.log(`   Heap Used: ${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Heap Total: ${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   RSS: ${(usage.rss / 1024 / 1024).toFixed(2)} MB`);
  }

  async memoryStressTest() {
    console.log('🧠 Running memory stress test...');
    
    this.takeSnapshot('baseline');
    
    // Simulate memory-intensive operations
    const token = await authenticate(TEST_CREDENTIALS.coreTeam);
    
    // Generate large dataset requests
    for (let i = 0; i < 10; i++) {
      try {
        const response = await fetch(`${CONFIG.baseURL}/api/reports/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            type: 'detailed-attendance',
            startDate: '2020-01-01',
            endDate: '2024-12-31',
            format: 'json'
          })
        });
        
        const data = await response.json();
        
        if (i % 3 === 0) {
          this.takeSnapshot(`iteration-${i + 1}`);
        }
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
      } catch (error) {
        console.error(`Memory test iteration ${i + 1} failed:`, error.message);
      }
    }
    
    this.takeSnapshot('final');
    
    // Analyze memory growth
    const baseline = this.snapshots[0];
    const final = this.snapshots[this.snapshots.length - 1];
    const growth = {
      heapUsed: final.heapUsed - baseline.heapUsed,
      heapTotal: final.heapTotal - baseline.heapTotal,
      rss: final.rss - baseline.rss
    };
    
    console.log('📈 Memory growth analysis:');
    console.log(`   Heap Used Growth: ${(growth.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   RSS Growth: ${(growth.rss / 1024 / 1024).toFixed(2)} MB`);
    
    return { snapshots: this.snapshots, growth };
  }
}

/**
 * Concurrent User Simulation
 */
class ConcurrencyBenchmark {
  async simulateRealisticUserBehavior() {
    console.log('👥 Running concurrent user simulation...');
    
    const userScenarios = [
      this.studentScenario.bind(this),
      this.coreTeamScenario.bind(this),
      this.teacherScenario.bind(this)
    ];
    
    const concurrentUsers = 15;
    const promises = [];
    
    for (let i = 0; i < concurrentUsers; i++) {
      const scenario = userScenarios[i % userScenarios.length];
      promises.push(this.runUserScenario(scenario, i));
    }
    
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`👥 Concurrent simulation completed:`);
    console.log(`   Successful users: ${successful}`);
    console.log(`   Failed users: ${failed}`);
    console.log(`   Success rate: ${(successful / concurrentUsers * 100).toFixed(2)}%`);
    
    return { successful, failed, total: concurrentUsers };
  }

  async runUserScenario(scenario, userId) {
    const startTime = performance.now();
    try {
      await scenario(userId);
      const endTime = performance.now();
      return { userId, duration: endTime - startTime, success: true };
    } catch (error) {
      const endTime = performance.now();
      return { userId, duration: endTime - startTime, success: false, error: error.message };
    }
  }

  async studentScenario(userId) {
    const token = await authenticate(TEST_CREDENTIALS.student);
    
    // Student workflow: mark attendance, start duty, submit logs
    await this.makeRequest('POST', '/api/attendance', token, {
      type: 'on_club_duty',
      notes: `Concurrent test user ${userId}`
    });
    
    await this.sleep(100);
    
    await this.makeRequest('POST', '/api/duty-sessions', token, {
      type: 'start',
      notes: `User ${userId} duty session`
    });
    
    await this.sleep(200);
    
    await this.makeRequest('POST', '/api/hourly-logs', token, {
      previousWork: `User ${userId} previous work`,
      nextPlan: `User ${userId} next plan`
    });
  }

  async coreTeamScenario(userId) {
    const token = await authenticate(TEST_CREDENTIALS.coreTeam);
    
    // Core team workflow: check stats, review requests, generate reports
    await this.makeRequest('GET', '/api/dashboard/stats', token);
    await this.sleep(150);
    
    await this.makeRequest('GET', '/api/leave-requests?status=pending', token);
    await this.sleep(100);
    
    await this.makeRequest('POST', '/api/reports/generate', token, {
      type: 'daily-summary',
      date: new Date().toISOString().split('T')[0]
    });
  }

  async teacherScenario(userId) {
    const token = await authenticate(TEST_CREDENTIALS.teacher);
    
    // Teacher workflow: review submissions, validate attendance
    await this.makeRequest('GET', '/api/attendance?status=pending', token);
    await this.sleep(200);
    
    await this.makeRequest('GET', '/api/duty-sessions/logs', token);
    await this.sleep(150);
    
    await this.makeRequest('GET', '/api/strikes/overview', token);
  }

  async makeRequest(method, endpoint, token, body = null) {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${CONFIG.baseURL}${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Performance Report Generator
 */
class PerformanceReporter {
  constructor() {
    this.results = {};
  }

  addResults(category, data) {
    this.results[category] = data;
  }

  async generateReport() {
    console.log('📊 Generating performance report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        baseURL: CONFIG.baseURL,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      configuration: CONFIG,
      results: this.results,
      summary: this.generateSummary()
    };
    
    // Ensure output directory exists
    await fs.mkdir(CONFIG.outputDir, { recursive: true });
    
    // Write detailed JSON report
    const reportPath = path.join(CONFIG.outputDir, `performance-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Write human-readable summary
    const summaryPath = path.join(CONFIG.outputDir, `performance-summary-${Date.now()}.txt`);
    await fs.writeFile(summaryPath, this.generateTextSummary(report));
    
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log(`📄 Summary saved to: ${summaryPath}`);
    
    return report;
  }

  generateSummary() {
    const summary = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      averageResponseTime: 0,
      totalRequests: 0,
      errorRate: 0
    };
    
    Object.values(this.results).forEach(category => {
      if (typeof category === 'object' && category !== null) {
        Object.values(category).forEach(result => {
          if (result.success !== undefined) {
            summary.totalTests++;
            if (result.success) {
              summary.passedTests++;
            } else {
              summary.failedTests++;
            }
          }
          
          if (result.latency?.average) {
            summary.averageResponseTime += result.latency.average;
          }
          
          if (result.requests?.total) {
            summary.totalRequests += result.requests.total;
          }
        });
      }
    });
    
    if (summary.totalTests > 0) {
      summary.averageResponseTime = summary.averageResponseTime / summary.totalTests;
      summary.errorRate = (summary.failedTests / summary.totalTests) * 100;
    }
    
    return summary;
  }

  generateTextSummary(report) {
    const summary = report.summary;
    
    return `
PERFORMANCE TEST SUMMARY
========================
Timestamp: ${report.timestamp}
Environment: ${report.environment.baseURL}
Platform: ${report.environment.platform} ${report.environment.arch}

OVERALL RESULTS
===============
Total Tests: ${summary.totalTests}
Passed: ${summary.passedTests}
Failed: ${summary.failedTests}
Success Rate: ${((summary.passedTests / summary.totalTests) * 100).toFixed(2)}%

PERFORMANCE METRICS
===================
Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms
Total Requests: ${summary.totalRequests}
Error Rate: ${summary.errorRate.toFixed(2)}%

RECOMMENDATIONS
===============
${this.generateRecommendations(report)}
    `.trim();
  }

  generateRecommendations(report) {
    const recommendations = [];
    const summary = report.summary;
    
    if (summary.averageResponseTime > 1000) {
      recommendations.push('• Consider optimizing API response times (current: ' + summary.averageResponseTime.toFixed(2) + 'ms)');
    }
    
    if (summary.errorRate > 5) {
      recommendations.push('• High error rate detected (' + summary.errorRate.toFixed(2) + '%). Review error logs and improve error handling.');
    }
    
    if (summary.passedTests < summary.totalTests) {
      recommendations.push('• Some performance tests failed. Review failed test details and optimize accordingly.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('• Performance metrics are within acceptable ranges. Consider load testing with higher concurrency.');
    }
    
    return recommendations.join('\n');
  }
}

/**
 * Main Benchmark Runner
 */
async function runPerformanceBenchmarks() {
  console.log('🎯 Starting comprehensive performance benchmarks...\n');
  
  const reporter = new PerformanceReporter();
  
  try {
    // API Endpoint Benchmarks
    const apiBenchmark = new APIBenchmark();
    await apiBenchmark.benchmarkAuthentication();
    await apiBenchmark.benchmarkAttendanceEndpoints();
    await apiBenchmark.benchmarkUserManagement();
    await apiBenchmark.benchmarkReportGeneration();
    reporter.addResults('api', apiBenchmark.results);
    
    // Database Performance
    const dbBenchmark = new DatabaseBenchmark();
    await dbBenchmark.benchmarkDatabaseQueries();
    reporter.addResults('database', dbBenchmark.results);
    
    // Memory Usage Analysis
    const memoryBenchmark = new MemoryBenchmark();
    const memoryResults = await memoryBenchmark.memoryStressTest();
    reporter.addResults('memory', memoryResults);
    
    // Concurrent User Simulation
    const concurrencyBenchmark = new ConcurrencyBenchmark();
    const concurrencyResults = await concurrencyBenchmark.simulateRealisticUserBehavior();
    reporter.addResults('concurrency', concurrencyResults);
    
    // Generate final report
    const finalReport = await reporter.generateReport();
    
    console.log('\n🎉 Performance benchmarking completed successfully!');
    console.log('\nSUMMARY:');
    console.log(`Total Tests: ${finalReport.summary.totalTests}`);
    console.log(`Success Rate: ${((finalReport.summary.passedTests / finalReport.summary.totalTests) * 100).toFixed(2)}%`);
    console.log(`Average Response Time: ${finalReport.summary.averageResponseTime.toFixed(2)}ms`);
    
  } catch (error) {
    console.error('❌ Performance benchmarking failed:', error);
    process.exit(1);
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  runPerformanceBenchmarks();
}

module.exports = {
  APIBenchmark,
  DatabaseBenchmark,
  MemoryBenchmark,
  ConcurrencyBenchmark,
  PerformanceReporter,
  runPerformanceBenchmarks
};