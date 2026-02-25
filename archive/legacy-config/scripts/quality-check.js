#!/usr/bin/env node

/**
 * Comprehensive Code Quality Checker
 * Orchestrates all quality checks for SylOS applications
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class CodeQualityChecker {
  constructor(options = {}) {
    this.options = {
      parallel: true,
      continueOnError: options.continueOnError || false,
      outputDir: options.outputDir || './reports/quality',
      verbose: options.verbose || false,
      failFast: options.failFast !== false,
      ...options
    };

    this.results = {
      timestamp: new Date().toISOString(),
      checks: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      },
      recommendations: []
    };

    this.outputDir = this.options.outputDir;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Run all quality checks
   */
  async runAllChecks() {
    console.log('🔍 Starting Comprehensive Code Quality Check');
    console.log('==========================================\n');

    const startTime = Date.now();

    const checks = [
      { name: 'ESLint', command: 'npm run lint', parallel: true },
      { name: 'Prettier Format', command: 'npm run format:check', parallel: true },
      { name: 'TypeScript Type Check', command: 'npm run typecheck', parallel: true },
      { name: 'Unit Tests', command: 'npm run test:unit', parallel: true },
      { name: 'Test Coverage', command: 'npm run test:coverage', parallel: false },
      { name: 'Security Audit', command: 'npm run security:audit', parallel: true },
      { name: 'Dependency Check', command: 'npm run deps:audit', parallel: true },
      { name: 'Bundle Analysis', command: 'npm run build:analyze', parallel: false },
      { name: 'Performance Check', command: 'npm run performance:analyze', parallel: false },
      { name: 'Documentation Check', command: 'npm run docs:generate', parallel: false }
    ];

    if (this.options.parallel) {
      await this.runChecksInParallel(checks);
    } else {
      await this.runChecksSequentially(checks);
    }

    const duration = Date.now() - startTime;
    this.results.duration = `${(duration / 1000).toFixed(2)} seconds`;

    this.generateReport();
    this.printSummary();
    this.suggestImprovements();

    return this.getExitCode();
  }

  /**
   * Run checks in parallel
   */
  async runChecksInParallel(checks) {
    const batchSize = 3; // Limit parallel execution
    for (let i = 0; i < checks.length; i += batchSize) {
      const batch = checks.slice(i, i + batchSize);
      const promises = batch.map(check => this.runCheck(check));
      const results = await Promise.allSettled(promises);
      
      // Check if any critical check failed and failFast is enabled
      if (this.options.failFast && results.some(result => 
        result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.passed)
      )) {
        console.log('❌ Fast-failing due to critical check failure');
        break;
      }
    }
  }

  /**
   * Run checks sequentially
   */
  async runChecksSequentially(checks) {
    for (const check of checks) {
      await this.runCheck(check);
      
      // Check if critical check failed and failFast is enabled
      if (this.options.failFast && this.results.checks[check.name] && !this.results.checks[check.name].passed) {
        console.log('❌ Fast-failing due to critical check failure');
        break;
      }
    }
  }

  /**
   * Run a single quality check
   */
  async runCheck(check) {
    const startTime = Date.now();
    console.log(`\n⏳ Running ${check.name}...`);

    try {
      const result = await this.executeCommand(check.command, check.name);
      const duration = Date.now() - startTime;

      this.results.checks[check.name] = {
        command: check.command,
        passed: true,
        duration: `${duration}ms`,
        output: result.stdout,
        error: result.stderr
      };

      this.results.summary.total++;
      this.results.summary.passed++;
      
      if (this.options.verbose) {
        console.log(`✅ ${check.name} passed (${duration}ms)`);
        if (result.stdout) {
          console.log(result.stdout);
        }
      } else {
        console.log(`✅ ${check.name} passed`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.checks[check.name] = {
        command: check.command,
        passed: false,
        duration: `${duration}ms`,
        output: error.stdout || '',
        error: error.stderr || error.message,
        exitCode: error.exitCode
      };

      this.results.summary.total++;
      this.results.summary.failed++;

      console.log(`❌ ${check.name} failed (${duration}ms)`);
      
      if (this.options.verbose || !this.options.continueOnError) {
        console.error(error.stderr || error.message);
      }

      if (!this.options.continueOnError && this.isCriticalCheck(check.name)) {
        throw new Error(`Critical check failed: ${check.name}`);
      }
    }
  }

  /**
   * Execute a command
   */
  executeCommand(command, checkName) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      
      const process = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject({ stdout, stderr, exitCode: code });
        }
      });

      process.on('error', (error) => {
        reject({ stderr: error.message });
      });
    });
  }

  /**
   * Check if a check is critical
   */
  isCriticalCheck(checkName) {
    const criticalChecks = [
      'ESLint',
      'TypeScript Type Check',
      'Unit Tests',
      'Security Audit',
      'Build Check'
    ];
    return criticalChecks.includes(checkName);
  }

  /**
   * Generate quality report
   */
  generateReport() {
    const reportPath = path.join(this.outputDir, `quality-report-${Date.now()}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Quality report saved: ${reportPath}`);

    // Generate HTML report
    this.generateHTMLReport();
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport() {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>SylOS Code Quality Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 40px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .check { padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid; }
        .passed { background: #d4edda; border-color: #28a745; }
        .failed { background: #f8d7da; border-color: #dc3545; }
        .duration { color: #6c757d; font-size: 0.9em; }
        .recommendations { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 SylOS Code Quality Report</h1>
        <p><strong>Generated:</strong> ${this.results.timestamp}</p>
        <p><strong>Duration:</strong> ${this.results.duration}</p>
    </div>
    
    <div class="summary">
        <h2>📊 Summary</h2>
        <p><strong>Total Checks:</strong> ${this.results.summary.total}</p>
        <p><strong>Passed:</strong> ${this.results.summary.passed}</p>
        <p><strong>Failed:</strong> ${this.results.summary.failed}</p>
        <p><strong>Success Rate:</strong> ${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%</p>
    </div>
    
    <div class="checks">
        <h2>🔍 Check Results</h2>
        ${Object.entries(this.results.checks).map(([name, result]) => `
            <div class="check ${result.passed ? 'passed' : 'failed'}">
                <h3>${result.passed ? '✅' : '❌'} ${name}</h3>
                <p class="duration">Duration: ${result.duration}</p>
                ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
            </div>
        `).join('')}
    </div>
    
    ${this.results.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>💡 Recommendations</h2>
            <ul>
                ${this.results.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    ` : ''}
</body>
</html>`;

    const htmlPath = path.join(this.outputDir, `quality-report-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, html);
    console.log(`🌐 HTML report saved: ${htmlPath}`);
  }

  /**
   * Print quality summary
   */
  printSummary() {
    console.log('\n📊 QUALITY CHECK SUMMARY');
    console.log('========================');
    console.log(`Total Checks: ${this.results.summary.total}`);
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    console.log(`⚠️  Warnings: ${this.results.summary.warnings}`);
    console.log(`Duration: ${this.results.duration}`);

    if (this.results.summary.failed === 0) {
      console.log('\n🎉 All quality checks passed!');
    } else {
      console.log('\n⚠️  Some quality checks failed. Please review the results.');
    }
  }

  /**
   * Suggest improvements based on results
   */
  suggestImprovements() {
    const checks = this.results.checks;
    const failedChecks = Object.entries(checks).filter(([_, result]) => !result.passed);
    const recommendations = [];

    // Analyze failed checks and suggest improvements
    failedChecks.forEach(([checkName, result]) => {
      switch (checkName) {
        case 'ESLint':
          recommendations.push('Review ESLint errors and fix code quality issues');
          recommendations.push('Consider running `npm run lint:fix` for auto-fixable issues');
          break;
        case 'Prettier Format':
          recommendations.push('Run `npm run format` to fix formatting issues');
          recommendations.push('Configure your IDE to format on save');
          break;
        case 'TypeScript Type Check':
          recommendations.push('Fix TypeScript type errors in your code');
          recommendations.push('Review type definitions and add missing types');
          break;
        case 'Test Coverage':
          recommendations.push('Add more unit tests to increase coverage');
          recommendations.push('Focus on critical business logic and edge cases');
          break;
        case 'Security Audit':
          recommendations.push('Update vulnerable dependencies');
          recommendations.push('Run `npm audit fix` to apply security patches');
          break;
        case 'Bundle Analysis':
          recommendations.push('Optimize bundle size by implementing code splitting');
          recommendations.push('Review dependencies and remove unused packages');
          break;
        default:
          recommendations.push(`Review and fix issues in ${checkName}`);
      }
    });

    // Add general recommendations
    if (this.results.summary.failed > 0) {
      recommendations.push('Consider running `npm run quality:fix` to auto-fix common issues');
      recommendations.push('Review the detailed HTML report for specific error details');
    } else {
      recommendations.push('Great job! All quality checks passed');
      recommendations.push('Consider setting up pre-commit hooks to maintain quality');
    }

    this.results.recommendations = recommendations;

    if (recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      console.log('==================');
      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
  }

  /**
   * Get exit code for CI/CD
   */
  getExitCode() {
    if (this.results.summary.failed === 0) {
      return 0; // Success
    } else if (this.results.summary.failed <= 2) {
      return 1; // Warning
    } else {
      return 2; // Error
    }
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options = {
    parallel: !args.includes('--sequential'),
    continueOnError: args.includes('--continue'),
    failFast: !args.includes('--no-fail-fast'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    outputDir: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || './reports/quality'
  };

  const checker = new CodeQualityChecker(options);

  console.log('🔍 SylOS Comprehensive Code Quality Checker');
  console.log('==========================================\n');

  checker.runAllChecks()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Quality check failed:', error.message);
      process.exit(1);
    });
}

module.exports = CodeQualityChecker;