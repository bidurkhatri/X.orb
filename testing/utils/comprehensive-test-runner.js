#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * Orchestrates all test types and generates consolidated reports
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configurations
const testConfigs = {
  unit: {
    command: 'npm run test:unit',
    timeout: 300000, // 5 minutes
    critical: true,
  },
  integration: {
    command: 'npm run test:integration',
    timeout: 300000,
    critical: true,
  },
  'cross-chain': {
    command: 'npm run test:cross-chain',
    timeout: 600000, // 10 minutes
    critical: true,
  },
  accessibility: {
    command: 'npm run test:accessibility:report',
    timeout: 600000,
    critical: true,
  },
  'database-performance': {
    command: 'npm run test:database:perf',
    timeout: 900000, // 15 minutes
    critical: true,
  },
  'error-scenarios': {
    command: 'npm run test:error:scenarios',
    timeout: 600000,
    critical: true,
  },
  'e2e-web': {
    command: 'npm run test:e2e:web',
    timeout: 900000,
    critical: true,
  },
  'visual-regression': {
    command: 'npm run test:visual:regression',
    timeout: 600000,
    critical: false, // Non-blocking
  },
  performance: {
    command: 'npm run test:performance',
    timeout: 900000,
    critical: false, // Non-blocking
  },
  scalability: {
    command: 'npm run test:scalability:report',
    timeout: 1800000, // 30 minutes
    critical: false, // Non-blocking
  },
  'real-devices': {
    command: 'npm run test:real:devices',
    timeout: 1800000,
    critical: false, // Requires real devices
    environment: 'real-device',
  },
};

class ComprehensiveTestRunner {
  constructor() {
    this.results = {};
    this.startTime = Date.now();
    this.testSuite = process.argv[2] || 'all';
    this.parallel = process.argv.includes('--parallel');
    this.generateReports = !process.argv.includes('--no-reports');
  }

  async run() {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log(`📋 Test Suite: ${this.testSuite}`);
    console.log(`⚡ Parallel Mode: ${this.parallel}`);
    console.log(`📊 Generate Reports: ${this.generateReports}`);
    console.log('=' .repeat(80));

    // Parse test suite selection
    const selectedTests = this.getSelectedTests();

    if (this.parallel) {
      await this.runTestsParallel(selectedTests);
    } else {
      await this.runTestsSequential(selectedTests);
    }

    // Generate consolidated report
    if (this.generateReports) {
      await this.generateConsolidatedReport();
    }

    // Print final summary
    this.printFinalSummary();

    // Exit with appropriate code
    const hasCriticalFailures = Object.values(this.results)
      .some(result => result.critical && result.status === 'failed');
    
    process.exit(hasCriticalFailures ? 1 : 0);
  }

  getSelectedTests() {
    if (this.testSuite === 'all') {
      return Object.keys(testConfigs);
    }
    
    if (this.testSuite === 'critical') {
      return Object.keys(testConfigs).filter(test => testConfigs[test].critical);
    }
    
    if (this.testSuite === 'quick') {
      return ['unit', 'integration', 'error-scenarios'];
    }
    
    // Parse comma-separated list
    return this.testSuite.split(',').map(test => test.trim());
  }

  async runTestsSequential(tests) {
    for (const test of tests) {
      await this.runTest(test, testConfigs[test]);
    }
  }

  async runTestsParallel(tests) {
    const batches = this.createBatches(tests, 3); // Max 3 parallel tests
    
    for (const batch of batches) {
      const promises = batch.map(test => this.runTest(test, testConfigs[test]));
      await Promise.allSettled(promises);
    }
  }

  createBatches(tests, maxConcurrent) {
    const batches = [];
    for (let i = 0; i < tests.length; i += maxConcurrent) {
      batches.push(tests.slice(i, i + maxConcurrent));
    }
    return batches;
  }

  async runTest(testName, config) {
    const startTime = Date.now();
    console.log(`\n🧪 Running ${testName} tests...`);
    
    try {
      const result = await this.executeTestCommand(config.command, config.timeout);
      const duration = Date.now() - startTime;
      
      this.results[testName] = {
        status: 'passed',
        duration,
        command: config.command,
        critical: config.critical,
        output: result.output,
        error: null,
      };
      
      console.log(`✅ ${testName} tests passed (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results[testName] = {
        status: 'failed',
        duration,
        command: config.command,
        critical: config.critical,
        output: error.output,
        error: error.message,
      };
      
      const icon = config.critical ? '❌' : '⚠️';
      console.log(`${icon} ${testName} tests failed (${duration}ms)`);
      if (error.message) {
        console.log(`   Error: ${error.message}`);
      }
    }
  }

  executeTestCommand(command, timeout) {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        stdio: ['inherit', 'pipe', 'pipe'],
        timeout,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ output: stdout, stderr });
        } else {
          reject({
            code,
            output: stdout,
            stderr,
            message: `Command failed with exit code ${code}`,
          });
        }
      });

      child.on('error', (error) => {
        reject({
          message: `Failed to execute command: ${error.message}`,
        });
      });
    });
  }

  async generateConsolidatedReport() {
    console.log('\n📊 Generating consolidated test report...');
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        testSuite: this.testSuite,
        executionMode: this.parallel ? 'parallel' : 'sequential',
        totalDuration: Date.now() - this.startTime,
      },
      summary: {
        total: Object.keys(this.results).length,
        passed: Object.values(this.results).filter(r => r.status === 'passed').length,
        failed: Object.values(this.results).filter(r => r.status === 'failed').length,
        passRate: 0,
        criticalFailures: Object.values(this.results)
          .filter(r => r.critical && r.status === 'failed').length,
      },
      results: this.results,
      recommendations: this.generateRecommendations(),
    };

    report.summary.passRate = (report.summary.passed / report.summary.total) * 100;

    // Write report to file
    const reportPath = path.join(__dirname, '../reports/consolidated-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report);
    const htmlPath = path.join(__dirname, '../reports/consolidated-test-report.html');
    fs.writeFileSync(htmlPath, htmlReport);

    console.log(`📄 Report saved to: ${reportPath}`);
    console.log(`🌐 HTML report saved to: ${htmlPath}`);
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SylOS Comprehensive Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #1a1a1a; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #1a1a1a; }
        .metric-label { color: #666; margin-top: 5px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .critical { background: #fff3cd; }
        .test-results { margin-top: 30px; }
        .test-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #eee; }
        .test-item:last-child { border-bottom: none; }
        .test-name { font-weight: 600; }
        .test-duration { color: #666; font-size: 0.9em; }
        .status { padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .recommendations { background: #e3f2fd; padding: 20px; border-radius: 6px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 SylOS Comprehensive Test Report</h1>
            <p>Generated: ${report.metadata.timestamp}</p>
            <p>Test Suite: ${report.metadata.testSuite} | Mode: ${report.metadata.executionMode}</p>
        </div>
        
        <div style="padding: 30px;">
            <h2>📊 Summary</h2>
            <div class="summary">
                <div class="metric">
                    <div class="metric-value">${report.summary.total}</div>
                    <div class="metric-label">Total Tests</div>
                </div>
                <div class="metric">
                    <div class="metric-value passed">${report.summary.passed}</div>
                    <div class="metric-label">Passed</div>
                </div>
                <div class="metric">
                    <div class="metric-value failed">${report.summary.failed}</div>
                    <div class="metric-label">Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${report.summary.passRate.toFixed(1)}%</div>
                    <div class="metric-label">Pass Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${Math.round(report.metadata.totalDuration / 1000)}s</div>
                    <div class="metric-label">Total Duration</div>
                </div>
            </div>

            <h2>🧪 Test Results</h2>
            <div class="test-results">
                ${Object.entries(report.results).map(([testName, result]) => `
                    <div class="test-item ${result.critical ? 'critical' : ''}">
                        <div>
                            <div class="test-name">${testName}</div>
                            <div class="test-duration">${Math.round(result.duration / 1000)}s</div>
                        </div>
                        <div class="status ${result.status === 'passed' ? 'status-passed' : 'status-failed'}">
                            ${result.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
                        </div>
                    </div>
                `).join('')}
            </div>

            ${report.summary.criticalFailures > 0 ? `
                <div class="recommendations">
                    <h3>🚨 Critical Failures Detected</h3>
                    <p>There are ${report.summary.criticalFailures} critical test failures that require immediate attention.</p>
                </div>
            ` : ''}

            <div class="recommendations">
                <h3>💡 Recommendations</h3>
                <ul>
                    ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  generateRecommendations() {
    const recommendations = [];
    
    const failedTests = Object.entries(this.results).filter(([_, result]) => result.status === 'failed');
    const slowTests = Object.entries(this.results).filter(([_, result]) => result.duration > 600000); // > 10 minutes
    
    if (failedTests.length > 0) {
      recommendations.push('Review failed test logs and fix underlying issues');
    }
    
    if (slowTests.length > 0) {
      recommendations.push('Optimize slow-running tests for better performance');
    }
    
    if (this.results['accessibility']?.status === 'failed') {
      recommendations.push('Address accessibility issues to ensure WCAG 2.1 compliance');
    }
    
    if (this.results['database-performance']?.status === 'failed') {
      recommendations.push('Optimize database queries and add missing indexes');
    }
    
    if (this.results['error-scenarios']?.status === 'failed') {
      recommendations.push('Improve error handling and recovery mechanisms');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All tests passed! Consider adding more comprehensive test coverage');
      recommendations.push('Implement real device testing for better coverage');
      recommendations.push('Set up automated test reporting in CI/CD pipeline');
    }
    
    return recommendations;
  }

  printFinalSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL TEST SUMMARY');
    console.log('='.repeat(80));
    
    const summary = this.results;
    const passed = Object.values(summary).filter(r => r.status === 'passed').length;
    const failed = Object.values(summary).filter(r => r.status === 'failed').length;
    const total = Object.keys(summary).length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${Math.round((Date.now() - this.startTime) / 1000)}s`);
    
    const criticalFailures = Object.values(summary)
      .filter(r => r.critical && r.status === 'failed').length;
    
    if (criticalFailures > 0) {
      console.log(`\n🚨 CRITICAL FAILURES: ${criticalFailures}`);
      console.log('   These failures require immediate attention before deployment.');
    } else {
      console.log('\n✅ All critical tests passed!');
    }
    
    console.log('='.repeat(80));
  }
}

// CLI interface
if (require.main === module) {
  const runner = new ComprehensiveTestRunner();
  runner.run().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveTestRunner;
