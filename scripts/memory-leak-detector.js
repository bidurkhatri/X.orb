#!/usr/bin/env node

/**
 * Memory Leak Detection Tool
 * Detects potential memory leaks in Node.js applications
 */

const fs = require('fs');
const path = require('path');
const v8 = require('v8');

class MemoryLeakDetector {
  constructor(options = {}) {
    this.options = {
      threshold: options.threshold || 50 * 1024 * 1024, // 50MB
      interval: options.interval || 5000, // 5 seconds
      snapshotsDir: options.snapshotsDir || './reports/memory-snapshots',
      maxSnapshots: options.maxSnapshots || 10,
      ...options
    };
    
    this.snapshots = [];
    this.baseline = null;
    this.isMonitoring = false;
    
    this.ensureSnapshotsDir();
  }

  ensureSnapshotsDir() {
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }

  /**
   * Start monitoring for memory leaks
   */
  start() {
    if (this.isMonitoring) {
      console.log('Memory leak detection is already running');
      return;
    }

    this.isMonitoring = true;
    console.log('🔍 Starting memory leak detection...');
    console.log(`Threshold: ${this.formatBytes(this.options.threshold)}`);
    console.log(`Interval: ${this.options.interval}ms`);
    console.log(`Snapshots directory: ${this.snapshotsDir}`);

    // Take initial baseline
    this.takeSnapshot('baseline');
    
    // Start monitoring loop
    this.monitorInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.options.interval);

    // Process monitoring
    process.on('exit', () => this.stop());
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    clearInterval(this.monitorInterval);
    console.log('🛑 Memory leak detection stopped');
    
    this.generateReport();
  }

  /**
   * Take a memory snapshot
   */
  takeSnapshot(label) {
    const usage = process.memoryUsage();
    const heapInfo = v8.getHeapStatistics();
    
    const snapshot = {
      timestamp: Date.now(),
      label: label || 'snapshot',
      usage: { ...usage },
      heapStats: { ...heapInfo },
      heapSpaceInfo: v8.getHeapSpaceStatistics(),
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      totalJSHeapSize: heapInfo.total_heap_size,
      jsHeapSizeLimit: heapInfo.heap_size_limit
    };

    this.snapshots.push(snapshot);
    
    // Keep only recent snapshots
    if (this.snapshots.length > this.options.maxSnapshots) {
      this.snapshots.shift();
    }

    // Save snapshot to file
    this.saveSnapshotToFile(snapshot);
    
    return snapshot;
  }

  /**
   * Save snapshot to file
   */
  saveSnapshotToFile(snapshot) {
    const filename = `${this.snapshotsDir}/snapshot-${snapshot.timestamp}-${snapshot.label}.json`;
    
    // Clean up circular references for JSON serialization
    const cleanSnapshot = JSON.parse(JSON.stringify(snapshot, (key, value) => {
      if (value instanceof Set) {
        return { __type: 'Set', value: Array.from(value) };
      }
      if (value instanceof Map) {
        return { __type: 'Map', value: Array.from(value) };
      }
      if (typeof value === 'function') {
        return value.toString();
      }
      return value;
    }));

    fs.writeFileSync(filename, JSON.stringify(cleanSnapshot, null, 2));
    console.log(`📸 Snapshot saved: ${filename}`);
  }

  /**
   * Check current memory usage
   */
  checkMemoryUsage() {
    const current = this.takeSnapshot('current');
    
    if (this.baseline) {
      const heapGrowth = current.heapUsed - this.baseline.heapUsed;
      const rssGrowth = current.rss - this.baseline.rss;
      
      console.log(`\n📊 Memory Status:`);
      console.log(`   Heap Used: ${this.formatBytes(current.heapUsed)} (${this.formatBytes(heapGrowth)} from baseline)`);
      console.log(`   RSS: ${this.formatBytes(current.rss)} (${this.formatBytes(rssGrowth)} from baseline)`);
      console.log(`   External: ${this.formatBytes(current.external)}`);
      console.log(`   Array Buffers: ${this.formatBytes(current.arrayBuffers)}`);

      // Check for potential memory leak
      if (Math.abs(heapGrowth) > this.options.threshold) {
        if (heapGrowth > 0) {
          this.detectMemoryLeak(heapGrowth);
        } else {
          console.log('✅ Memory usage decreased (possibly garbage collected)');
        }
      }

      // Trend analysis
      this.analyzeTrends();
    } else {
      this.baseline = current;
      console.log('📏 Baseline established');
    }
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeak(growth) {
    console.log(`\n⚠️  POTENTIAL MEMORY LEAK DETECTED!`);
    console.log(`   Growth: ${this.formatBytes(growth)}`);
    console.log(`   Threshold: ${this.formatBytes(this.options.threshold)}`);

    // Take detailed snapshot
    this.takeSnapshot('leak-detection');

    // Analyze GC history
    this.analyzeGarbageCollection();

    // Generate heap dump if available
    this.generateHeapDump();
  }

  /**
   * Analyze garbage collection patterns
   */
  analyzeGarbageCollection() {
    const gcStats = this.getGCStats();
    
    if (gcStats) {
      console.log(`\n🗑️  GC Analysis:`);
      console.log(`   Total GC time: ${gcStats.totalTime}ms`);
      console.log(`   Collections: ${gcStats.collections}`);
      console.log(`   Avg collection time: ${gcStats.avgTime}ms`);
      
      if (gcStats.collections > 0) {
        const gcEfficiency = (this.baseline.heapUsed - this.snapshots[this.snapshots.length - 1].heapUsed) / gcStats.totalTime;
        console.log(`   GC Efficiency: ${gcEfficiency.toFixed(2)} bytes/ms`);
      }
    }
  }

  /**
   * Get garbage collection statistics
   */
  getGCStats() {
    try {
      // This is a simplified approach - in a real implementation,
      // you might use V8's performance hooks or external libraries
      const current = process.memoryUsage();
      const previous = this.snapshots.length > 1 ? this.snapshots[this.snapshots.length - 2] : null;
      
      if (!previous) return null;

      const growth = current.heapUsed - previous.heapUsed;
      const timeDiff = current.timestamp - previous.timestamp;
      
      return {
        totalTime: timeDiff,
        collections: Math.max(0, -growth / 1024 / 1024) > 1 ? 1 : 0, // Simple heuristic
        avgTime: timeDiff,
        growth: growth
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze memory usage trends
   */
  analyzeTrends() {
    if (this.snapshots.length < 3) return;

    const recent = this.snapshots.slice(-5); // Last 5 snapshots
    const heapGrowths = recent.map((snapshot, index) => {
      if (index === 0) return 0;
      return snapshot.heapUsed - recent[index - 1].heapUsed;
    });

    const avgGrowth = heapGrowths.reduce((sum, growth) => sum + growth, 0) / heapGrowths.length;
    const trendDirection = avgGrowth > 0 ? 'increasing' : 'decreasing';
    
    console.log(`📈 Memory trend (last 5 intervals): ${trendDirection} at ${this.formatBytes(Math.abs(avgGrowth))}/interval`);

    if (Math.abs(avgGrowth) > this.options.threshold / 4) { // 25% of threshold
      console.log(`   ⚠️  Significant trend detected: ${this.formatBytes(Math.abs(avgGrowth))}/interval`);
    }
  }

  /**
   * Generate heap dump
   */
  generateHeapDump() {
    const heapdump = require('heapdump');
    const filename = `${this.snapshotsDir}/heapdump-${Date.now()}.heapsnapshot`;
    
    try {
      heapdump.writeSnapshot(filename);
      console.log(`📋 Heap dump saved: ${filename}`);
    } catch (error) {
      console.log('❌ Failed to generate heap dump:', error.message);
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    if (this.snapshots.length < 2) {
      console.log('Not enough data for report');
      return;
    }

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const duration = (last.timestamp - first.timestamp) / 1000; // seconds
    const totalGrowth = last.heapUsed - first.heapUsed;
    const avgGrowthPerSecond = totalGrowth / duration;

    const report = {
      summary: {
        duration: `${duration.toFixed(2)} seconds`,
        totalMemoryGrowth: this.formatBytes(totalGrowth),
        avgGrowthPerSecond: this.formatBytes(Math.abs(avgGrowthPerSecond)),
        totalSnapshots: this.snapshots.length,
        memoryLeakDetected: Math.abs(totalGrowth) > this.options.threshold
      },
      baseline: {
        timestamp: new Date(first.timestamp).toISOString(),
        heapUsed: this.formatBytes(first.heapUsed),
        rss: this.formatBytes(first.rss),
        external: this.formatBytes(first.external)
      },
      current: {
        timestamp: new Date(last.timestamp).toISOString(),
        heapUsed: this.formatBytes(last.heapUsed),
        rss: this.formatBytes(last.rss),
        external: this.formatBytes(last.external)
      },
      recommendations: this.generateRecommendations(totalGrowth),
      snapshots: this.snapshots.map(s => ({
        timestamp: new Date(s.timestamp).toISOString(),
        label: s.label,
        heapUsed: s.heapUsed,
        rss: s.rss,
        external: s.external
      }))
    };

    // Save report
    const reportPath = `${this.snapshotsDir}/memory-leak-report.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report generated: ${reportPath}`);

    // Console summary
    console.log('\n📊 MEMORY LEAK DETECTION SUMMARY');
    console.log('================================');
    console.log(`Duration: ${report.summary.duration}`);
    console.log(`Total Growth: ${report.summary.totalMemoryGrowth}`);
    console.log(`Avg Growth/sec: ${report.summary.avgGrowthPerSecond}`);
    console.log(`Leak Detected: ${report.summary.memoryLeakDetected ? 'YES' : 'NO'}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(growth) {
    const recommendations = [];

    if (Math.abs(growth) > this.options.threshold) {
      if (growth > 0) {
        recommendations.push('Consider implementing proper cleanup in event handlers');
        recommendations.push('Review global variables and their lifecycle');
        recommendations.push('Check for unclosed resources (files, connections, timers)');
        recommendations.push('Look for event listeners that are not being removed');
        recommendations.push('Investigate large object caches or memory pools');
      } else {
        recommendations.push('Memory usage is within normal bounds');
      }
    }

    if (this.snapshots.length > 5) {
      const recent = this.snapshots.slice(-3);
      const isGrowing = recent.every((snapshot, index) => {
        if (index === 0) return true;
        return snapshot.heapUsed > recent[index - 1].heapUsed;
      });

      if (isGrowing && recent[recent.length - 1].heapUsed - recent[0].heapUsed > this.options.threshold / 2) {
        recommendations.push('Memory growth pattern detected - investigate data structures');
      }
    }

    return recommendations;
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC() {
    if (global.gc) {
      console.log('🗑️  Forcing garbage collection...');
      global.gc();
    } else {
      console.log('❌ Garbage collection not available (run with --expose-gc)');
    }
  }

  /**
   * Get current memory status
   */
  getStatus() {
    const usage = process.memoryUsage();
    return {
      ...usage,
      formatted: {
        heapUsed: this.formatBytes(usage.heapUsed),
        heapTotal: this.formatBytes(usage.heapTotal),
        rss: this.formatBytes(usage.rss),
        external: this.formatBytes(usage.external),
        arrayBuffers: this.formatBytes(usage.arrayBuffers)
      }
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    threshold: parseInt(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1]) || undefined,
    interval: parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) || undefined,
    snapshotsDir: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || undefined,
  };

  // Remove undefined values
  Object.keys(options).forEach(key => {
    if (options[key] === undefined) {
      delete options[key];
    }
  });

  const detector = new MemoryLeakDetector(options);

  console.log('🔍 SylOS Memory Leak Detection Tool');
  console.log('====================================\n');

  if (args.includes('--status')) {
    console.log('Current memory status:');
    console.log(detector.getStatus());
  } else if (args.includes('--force-gc')) {
    detector.forceGC();
  } else {
    detector.start();
  }
}

module.exports = MemoryLeakDetector;