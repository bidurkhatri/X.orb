#!/usr/bin/env node

/**
 * Performance Profiling Tool
 * Comprehensive performance monitoring and profiling for Node.js applications
 */

const fs = require('fs');
const path = require('path');
const { performance, PerformanceObserver } = require('perf_hooks');
const { getHeapStatistics, getHeapSpaceStatistics } = require('v8');

class PerformanceProfiler {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './reports/performance',
      reportFormat: options.reportFormat || 'json',
      monitorInterval: options.monitorInterval || 1000,
      maxRecords: options.maxRecords || 1000,
      enableCPUProfiling: options.enableCPUProfiling !== false,
      enableMemoryProfiling: options.enableMemoryProfiling !== false,
      enableAsyncProfiling: options.enableAsyncProfiling !== false,
      ...options
    };

    this.records = [];
    this.observers = [];
    this.startTime = performance.now();
    this.isMonitoring = false;

    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Start performance monitoring
   */
  start() {
    if (this.isMonitoring) {
      console.log('Performance profiling is already running');
      return;
    }

    this.isMonitoring = true;
    this.startTime = performance.now();
    
    console.log('🚀 Starting performance profiling...');
    console.log(`Output directory: ${this.outputDir}`);
    console.log(`Monitor interval: ${this.options.monitorInterval}ms`);

    if (this.options.enableCPUProfiling) {
      this.startCPUProfiling();
    }
    
    if (this.options.enableMemoryProfiling) {
      this.startMemoryProfiling();
    }
    
    if (this.options.enableAsyncProfiling) {
      this.startAsyncProfiling();
    }

    // Periodic monitoring
    this.monitorInterval = setInterval(() => {
      this.recordSystemMetrics();
    }, this.options.monitorInterval);

    // Graceful shutdown
    process.on('exit', () => this.stop());
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    clearInterval(this.monitorInterval);
    
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    console.log('🛑 Performance profiling stopped');
    
    this.generateReport();
  }

  /**
   * Start CPU profiling
   */
  startCPUProfiling() {
    const cpuObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'FunctionCall') {
          this.recordFunctionCall(entry);
        }
      }
    });

    try {
      cpuObserver.observe({ entryTypes: ['function'] });
      this.observers.push(cpuObserver);
      console.log('✅ CPU profiling enabled');
    } catch (error) {
      console.warn('⚠️  CPU profiling not available:', error.message);
    }
  }

  /**
   * Start memory profiling
   */
  startMemoryProfiling() {
    const memoryObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          this.recordMemoryMeasurement(entry);
        }
      }
    });

    try {
      memoryObserver.observe({ entryTypes: ['measure'] });
      this.observers.push(memoryObserver);
      console.log('✅ Memory profiling enabled');
    } catch (error) {
      console.warn('⚠️  Memory profiling not available:', error.message);
    }
  }

  /**
   * Start async operation profiling
   */
  startAsyncProfiling() {
    const asyncObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure' || entry.entryType === 'mark') {
          this.recordAsyncOperation(entry);
        }
      }
    });

    try {
      asyncObserver.observe({ entryTypes: ['measure', 'mark'] });
      this.observers.push(asyncObserver);
      console.log('✅ Async profiling enabled');
    } catch (error) {
      console.warn('⚠️  Async profiling not available:', error.message);
    }
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics() {
    const usage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    const heapStats = getHeapStatistics();
    const heapSpaces = getHeapSpaceStatistics();

    const metrics = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      cpu: {
        user: usage.user,
        system: usage.system,
        usage: performance.getEntriesByType('cpu').length
      },
      memory: {
        ...memUsage,
        formatted: this.formatMemory(memUsage),
        heapStats: {
          ...heapStats,
          formatted: this.formatMemory({
            total_heap_size: heapStats.total_heap_size,
            used_heap_size: heapStats.used_heap_size,
            heap_size_limit: heapStats.heap_size_limit
          })
        },
        heapSpaces: heapSpaces.map(space => ({
          name: space.space_name,
          size: space.size,
          used: space.used_size,
          available: space.available_size,
          formatted: {
            size: this.formatMemory({ size: space.size }).split(' ')[0] + ' MB',
            used: this.formatMemory({ size: space.used_size }).split(' ')[0] + ' MB'
          }
        }))
      },
      eventLoop: this.getEventLoopStats(),
      gc: this.getGCStats(),
      performance: {
        marks: performance.getEntriesByType('mark').length,
        measures: performance.getEntriesByType('measure').length,
        resources: performance.getEntriesByType('resource').length
      }
    };

    this.records.push(metrics);

    // Limit records to prevent memory issues
    if (this.records.length > this.options.maxRecords) {
      this.records.shift();
    }

    // Log significant changes
    this.logMetrics(metrics);
  }

  /**
   * Log significant metrics
   */
  logMetrics(metrics) {
    const lastRecord = this.records[this.records.length - 2];
    
    if (lastRecord) {
      const heapGrowth = metrics.memory.heapUsed - lastRecord.memory.heapUsed;
      const cpuUsage = metrics.cpu.user - lastRecord.cpu.user;
      
      if (Math.abs(heapGrowth) > 1024 * 1024) { // 1MB
        console.log(`📊 Heap growth: ${this.formatMemory({ size: heapGrowth }).size} ${heapGrowth > 0 ? '↗️' : '↘️'}`);
      }
      
      if (Math.abs(cpuUsage) > 100000) { // 100ms
        console.log(`💻 CPU usage: ${(cpuUsage / 1000).toFixed(1)}ms ${cpuUsage > 0 ? '↗️' : '↘️'}`);
      }
    }
  }

  /**
   * Record function call
   */
  recordFunctionCall(entry) {
    this.records.push({
      timestamp: Date.now(),
      type: 'function-call',
      name: entry.name || 'anonymous',
      duration: entry.duration,
      startTime: entry.startTime,
      endTime: entry.startTime + entry.duration
    });
  }

  /**
   * Record memory measurement
   */
  recordMemoryMeasurement(entry) {
    this.records.push({
      timestamp: Date.now(),
      type: 'memory-measure',
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
      endTime: entry.startTime + entry.duration
    });
  }

  /**
   * Record async operation
   */
  recordAsyncOperation(entry) {
    this.records.push({
      timestamp: Date.now(),
      type: 'async-operation',
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
      endTime: entry.startTime + entry.duration,
      entryType: entry.entryType
    });
  }

  /**
   * Get event loop statistics
   */
  getEventLoopStats() {
    const start = performance.now();
    
    return {
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length,
      delay: performance.now() - start
    };
  }

  /**
   * Get garbage collection statistics
   */
  getGCStats() {
    try {
      // This is a simplified approach
      const memoryUsage = process.memoryUsage();
      const heapStats = getHeapStatistics();
      
      return {
        type: 'unknown', // V8 doesn't expose this directly
        totalTime: 0, // Would need V8 flags to get this
        collections: 0, // Would need V8 flags to get this
        efficiency: heapStats.total_heap_size > 0 ? 
          (heapStats.used_heap_size / heapStats.total_heap_size) : 0
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  /**
   * Mark performance point
   */
  markPerformancePoint(name) {
    performance.mark(name);
  }

  /**
   * Measure performance between marks
   */
  measurePerformance(startMark, endMark, measurementName) {
    performance.measure(measurementName, startMark, endMark);
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    if (this.records.length === 0) {
      console.log('No performance data collected');
      return;
    }

    const endTime = performance.now();
    const duration = endTime - this.startTime;
    
    const summary = this.analyzePerformance();
    const report = {
      metadata: {
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration: `${(duration / 1000).toFixed(2)} seconds`,
        totalRecords: this.records.length,
        recordsPerSecond: (this.records.length / (duration / 1000)).toFixed(2)
      },
      summary,
      records: this.records,
      recommendations: this.generateRecommendations(summary)
    };

    // Save report
    const filename = `performance-report-${Date.now()}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Performance report saved: ${filepath}`);

    // Console summary
    this.printConsoleSummary(summary, duration);

    // Generate additional reports
    this.generateHTMLReport(report);
    this.generateCSVReport(report);
  }

  /**
   * Analyze performance data
   */
  analyzePerformance() {
    if (this.records.length === 0) return {};

    const memoryRecords = this.records.filter(r => r.memory);
    const cpuRecords = this.records.filter(r => r.cpu);
    const functionRecords = this.records.filter(r => r.type === 'function-call');
    const asyncRecords = this.records.filter(r => r.type === 'async-operation');

    return {
      memory: {
        min: Math.min(...memoryRecords.map(r => r.memory.heapUsed)),
        max: Math.max(...memoryRecords.map(r => r.memory.heapUsed)),
        average: memoryRecords.reduce((sum, r) => sum + r.memory.heapUsed, 0) / memoryRecords.length,
        formatted: {
          min: this.formatMemory({ size: Math.min(...memoryRecords.map(r => r.memory.heapUsed)) }),
          max: this.formatMemory({ size: Math.max(...memoryRecords.map(r => r.memory.heapUsed)) }),
          average: this.formatMemory({ size: memoryRecords.reduce((sum, r) => sum + r.memory.heapUsed, 0) / memoryRecords.length })
        },
        growth: memoryRecords.length > 1 ? 
          memoryRecords[memoryRecords.length - 1].memory.heapUsed - memoryRecords[0].memory.heapUsed : 0
      },
      cpu: {
        total: cpuRecords.reduce((sum, r) => sum + r.cpu.user + r.cpu.system, 0),
        average: cpuRecords.length > 0 ? 
          cpuRecords.reduce((sum, r) => sum + r.cpu.user + r.cpu.system, 0) / cpuRecords.length : 0,
        formatted: {
          total: this.formatTime(cpuRecords.reduce((sum, r) => sum + r.cpu.user + r.cpu.system, 0)),
          average: this.formatTime(cpuRecords.length > 0 ? 
            cpuRecords.reduce((sum, r) => sum + r.cpu.user + r.cpu.system, 0) / cpuRecords.length : 0)
        }
      },
      eventLoop: {
        avgDelay: memoryRecords.reduce((sum, r) => sum + r.eventLoop.delay, 0) / memoryRecords.length,
        maxDelay: Math.max(...memoryRecords.map(r => r.eventLoop.delay)),
        avgHandles: memoryRecords.reduce((sum, r) => sum + r.eventLoop.activeHandles, 0) / memoryRecords.length,
        maxHandles: Math.max(...memoryRecords.map(r => r.eventLoop.activeHandles))
      },
      functions: {
        total: functionRecords.length,
        avgDuration: functionRecords.length > 0 ? 
          functionRecords.reduce((sum, r) => sum + r.duration, 0) / functionRecords.length : 0,
        slowFunctions: functionRecords
          .filter(r => r.duration > 16) // Functions taking > 16ms
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
      },
      asyncOperations: {
        total: asyncRecords.length,
        avgDuration: asyncRecords.length > 0 ? 
          asyncRecords.reduce((sum, r) => sum + r.duration, 0) / asyncRecords.length : 0,
        slowAsync: asyncRecords
          .filter(r => r.duration > 16)
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
      }
    };
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(summary) {
    const recommendations = [];

    if (summary.memory) {
      if (summary.memory.growth > 10 * 1024 * 1024) { // 10MB
        recommendations.push('Consider implementing memory cleanup or garbage collection');
      }
      if (summary.memory.max - summary.memory.min > 50 * 1024 * 1024) { // 50MB
        recommendations.push('High memory variance detected - investigate memory leaks');
      }
    }

    if (summary.eventLoop) {
      if (summary.eventLoop.maxDelay > 16) { // 16ms
        recommendations.push('High event loop lag detected - optimize synchronous operations');
      }
      if (summary.eventLoop.maxHandles > 100) {
        recommendations.push('High number of active handles - check for unclosed resources');
      }
    }

    if (summary.functions) {
      if (summary.functions.slowFunctions.length > 0) {
        recommendations.push('Slow functions detected - consider optimization or async operations');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance looks good! Keep monitoring for trends.');
    }

    return recommendations;
  }

  /**
   * Print console summary
   */
  printConsoleSummary(summary, duration) {
    console.log('\n📊 PERFORMANCE PROFILING SUMMARY');
    console.log('================================');
    console.log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`Total Records: ${this.records.length}`);

    if (summary.memory) {
      console.log(`\n💾 Memory:`);
      console.log(`   Range: ${summary.memory.formatted.min} - ${summary.memory.formatted.max}`);
      console.log(`   Average: ${summary.memory.formatted.average}`);
      console.log(`   Growth: ${this.formatMemory({ size: summary.memory.growth })}`);
    }

    if (summary.cpu) {
      console.log(`\n💻 CPU:`);
      console.log(`   Total: ${summary.cpu.formatted.total}`);
      console.log(`   Average: ${summary.cpu.formatted.average}`);
    }

    if (summary.eventLoop) {
      console.log(`\n🔄 Event Loop:`);
      console.log(`   Max Delay: ${summary.eventLoop.maxDelay.toFixed(2)}ms`);
      console.log(`   Max Handles: ${summary.eventLoop.maxHandles}`);
    }

    console.log('\n💡 Recommendations:');
    const recommendations = this.generateRecommendations(summary);
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(report) {
    const html = this.generateHTMLTemplate(report);
    const filename = `performance-report-${Date.now()}.html`;
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, html);
    console.log(`🌐 HTML report saved: ${filepath}`);
  }

  /**
   * Generate CSV report
   */
  generateCSVReport(report) {
    const csv = this.generateCSVTemplate(report);
    const filename = `performance-report-${Date.now()}.csv`;
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, csv);
    console.log(`📊 CSV report saved: ${filepath}`);
  }

  /**
   * Generate HTML template
   */
  generateHTMLTemplate(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>SylOS Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; }
        .warning { background: #fff3cd; }
        .error { background: #f8d7da; }
        .success { background: #d4edda; }
    </style>
</head>
<body>
    <h1>🔍 SylOS Performance Report</h1>
    <p><strong>Generated:</strong> ${report.metadata.endTime}</p>
    <p><strong>Duration:</strong> ${report.metadata.duration}</p>
    
    <h2>📊 Summary</h2>
    <div class="metric">
        <h3>Memory</h3>
        <p>Range: ${report.summary.memory.formatted.min} - ${report.summary.memory.formatted.max}</p>
        <p>Growth: ${this.formatMemory({ size: report.summary.memory.growth })}</p>
    </div>
    
    <h2>💡 Recommendations</h2>
    <ul>
        ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
</body>
</html>`;
  }

  /**
   * Generate CSV template
   */
  generateCSVTemplate(report) {
    const headers = ['Timestamp', 'Type', 'Metric', 'Value'];
    const rows = report.records.map(record => [
      new Date(record.timestamp).toISOString(),
      record.type || 'system',
      'heapUsed',
      record.memory?.heapUsed || ''
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Format memory for display
   */
  formatMemory(memory) {
    if (memory.size === undefined) return memory;
    const bytes = memory.size;
    if (bytes === 0) return { size: '0 Bytes', unit: 'B' };
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    
    return { size: `${value} ${sizes[i]}`, value, unit: sizes[i] };
  }

  /**
   * Format time for display
   */
  formatTime(microseconds) {
    if (microseconds < 1000) {
      return `${microseconds.toFixed(0)}μs`;
    } else {
      return `${(microseconds / 1000).toFixed(2)}ms`;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options = {
    outputDir: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || './reports/performance',
    monitorInterval: parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) || 1000,
    enableCPUProfiling: !args.includes('--no-cpu'),
    enableMemoryProfiling: !args.includes('--no-memory'),
    enableAsyncProfiling: !args.includes('--no-async')
  };

  const profiler = new PerformanceProfiler(options);

  console.log('🔍 SylOS Performance Profiling Tool');
  console.log('===================================\n');

  if (args.includes('--status')) {
    console.log('Current performance status:');
    console.log(profiler.getCurrentStatus());
  } else if (args.includes('--mark')) {
    const markName = args.find(arg => arg.startsWith('--mark='))?.split('=')[1] || 'custom-mark';
    profiler.markPerformancePoint(markName);
    console.log(`Marked performance point: ${markName}`);
  } else {
    profiler.start();
  }
}

module.exports = PerformanceProfiler;