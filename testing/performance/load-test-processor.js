/**
 * Load Test Processor for SylOS Performance Testing
 * Handles custom test logic and data generation
 */

const crypto = require('crypto');
const { performance } = require('perf_hooks');

module.exports = {
  /**
   * Generate random test data for load testing
   */
  generateTestData(context, events, done) {
    // Generate test wallet
    context.vars.testWalletAddress = '0x' + crypto.randomBytes(20).toString('hex');
    context.vars.testPrivateKey = '0x' + crypto.randomBytes(32).toString('hex');
    
    // Generate test IPFS CIDs
    context.vars.testIPFSCIDs = [
      'QmXwN9dYd4T8J2kF3mZpA8hE9xN5vL2qR4mN7bC6dF3gH1jK5mN',
      'QmYf7rEs2R6gQ5hP3xKvT8uJ2nM5pL4kF9dS7wE3rT6yU1iO3pQ',
      'QmZ1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7',
    ];
    
    // Generate test task data
    context.vars.testTasks = [
      'Complete DApp integration',
      'Review smart contracts',
      'User testing and feedback',
      'Performance optimization',
      'Security audit',
      'Documentation update',
      'Mobile app testing',
      'API endpoint testing',
    ];
    
    // Performance tracking
    context.vars.performanceMetrics = {
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      responseTimes: [],
    };
    
    // Custom events for monitoring
    events.emit('counter', 'test_started', 1);
    
    done();
  },

  /**
   * Measure performance metrics
   */
  measurePerformance(context, events, done) {
    const startTime = performance.now();
    
    // Generate unique request ID
    context.vars.requestId = crypto.randomBytes(8).toString('hex');
    
    // Record request start time
    context.vars.performanceMetrics.requests++;
    
    done();
  },

  /**
   * Process response and measure performance
   */
  processResponse(context, events, done) {
    const endTime = performance.now();
    const responseTime = endTime - context.vars.startTime;
    
    // Store response time
    context.vars.performanceMetrics.responseTimes.push(responseTime);
    
    // Check for errors
    if (context.response.statusCode >= 400) {
      context.vars.performanceMetrics.errors++;
    }
    
    // Emit performance metrics
    events.emit('timing', 'response_time', responseTime);
    events.emit('counter', 'requests_total', 1);
    
    if (context.response.statusCode >= 400) {
      events.emit('counter', 'errors_total', 1);
    }
    
    // Check response time thresholds
    if (responseTime > 2000) {
      events.emit('counter', 'slow_responses', 1);
    }
    
    done();
  },

  /**
   * Generate PoP task verification data
   */
  generatePoPVerification(context, events, done) {
    const taskIndex = Math.floor(Math.random() * context.vars.testTasks.length);
    const task = context.vars.testTasks[taskIndex];
    const score = Math.floor(Math.random() * 10000) + 1000;
    const points = Math.floor(Math.random() * 500) + 100;
    
    context.vars.taskData = {
      task_id: crypto.randomBytes(16).toString('hex'),
      task_name: task,
      productivity_score: score,
      points_awarded: points,
      verification_hash: crypto.createHash('sha256').update(task + score).digest('hex'),
      timestamp: Date.now(),
    };
    
    done();
  },

  /**
   * Generate file upload data
   */
  generateFileData(context, events, done) {
    const fileTypes = ['txt', 'json', 'md', 'log'];
    const fileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
    const contentSize = Math.floor(Math.random() * 1024) + 100; // 100-1124 bytes
    
    // Generate random content
    const content = crypto.randomBytes(contentSize).toString('base64');
    
    context.vars.fileData = {
      filename: `test_${Date.now()}.${fileType}`,
      content: content,
      size: contentSize,
      content_type: `text/${fileType}`,
      encrypted: Math.random() > 0.7, // 30% chance of encryption
    };
    
    done();
  },

  /**
   * Generate token transaction data
   */
  generateTransactionData(context, events, done) {
    const tokens = ['SYLOS', 'wSYLOS', 'MATIC', 'USDC'];
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const amount = (Math.random() * 10000).toFixed(2);
    const gasPrice = Math.floor(Math.random() * 50) + 10; // 10-60 gwei
    
    context.vars.transactionData = {
      token: token,
      from: context.vars.testWalletAddress,
      to: '0x' + crypto.randomBytes(20).toString('hex'),
      amount: amount,
      gas_price: gasPrice,
      nonce: Math.floor(Math.random() * 1000),
      chain_id: 137, // Polygon mainnet
    };
    
    done();
  },

  /**
   * Calculate performance statistics
   */
  calculateStats(context, events, done) {
    const metrics = context.vars.performanceMetrics;
    
    if (metrics.responseTimes.length > 0) {
      const sortedTimes = metrics.responseTimes.sort((a, b) => a - b);
      const totalRequests = metrics.requests;
      const errorRate = (metrics.errors / totalRequests) * 100;
      const avgResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / totalRequests;
      const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
      
      // Emit summary metrics
      events.emit('counter', 'total_requests', totalRequests);
      events.emit('counter', 'total_errors', metrics.errors);
      events.emit('counter', 'error_rate', Math.round(errorRate * 100) / 100);
      events.emit('gauge', 'avg_response_time', Math.round(avgResponseTime * 100) / 100);
      events.emit('gauge', 'p95_response_time', Math.round(p95ResponseTime * 100) / 100);
      events.emit('gauge', 'p99_response_time', Math.round(p99ResponseTime * 100) / 100);
    }
    
    done();
  },

  /**
   * Validate response against expected patterns
   */
  validateResponse(context, events, done) {
    const response = context.response;
    const url = context.request.url.toString();
    
    // Common validation checks
    if (response.statusCode >= 500) {
      events.emit('counter', 'server_errors', 1);
      events.emit('log', 'error', `Server error on ${url}: ${response.statusCode}`);
    } else if (response.statusCode >= 400) {
      events.emit('counter', 'client_errors', 1);
      events.emit('log', 'warning', `Client error on ${url}: ${response.statusCode}`);
    }
    
    // Check response time SLA
    const responseTime = context.timings.response;
    if (responseTime > 1000) {
      events.emit('counter', 'sla_violations', 1);
      events.emit('log', 'warning', `SLA violation on ${url}: ${responseTime}ms`);
    }
    
    done();
  },

  /**
   * Simulate blockchain network latency
   */
  addBlockchainLatency(context, events, done) {
    // Simulate blockchain network delay (2-10 seconds)
    const latency = Math.floor(Math.random() * 8000) + 2000;
    
    // Only add latency for blockchain-specific endpoints
    const blockchainEndpoints = ['/api/wallet', '/api/tokens', '/api/pop', '/api/ipfs'];
    const isBlockchainCall = blockchainEndpoints.some(endpoint => 
      context.request.url.toString().includes(endpoint)
    );
    
    if (isBlockchainCall) {
      context.vars.think = Math.max(context.vars.think || 0, latency / 1000);
    }
    
    done();
  },

  /**
   * Generate stress test scenarios
   */
  generateStressTestData(context, events, done) {
    // Simulate high-concurrency scenarios
    context.vars.stressTestData = {
      concurrent_users: Math.floor(Math.random() * 1000) + 100,
      transactions_per_second: Math.floor(Math.random() * 500) + 50,
      data_volume_mb: Math.floor(Math.random() * 100) + 10,
      complexity_level: Math.random() > 0.5 ? 'high' : 'medium',
    };
    
    done();
  },

  /**
   * End test and emit final metrics
   */
  finalizeTest(context, events, done) {
    const duration = Date.now() - context.vars.performanceMetrics.startTime;
    const requestsPerSecond = context.vars.performanceMetrics.requests / (duration / 1000);
    
    events.emit('counter', 'test_duration_seconds', Math.round(duration / 1000));
    events.emit('gauge', 'requests_per_second', Math.round(requestsPerSecond * 100) / 100);
    events.emit('counter', 'test_completed', 1);
    
    // Calculate success rate
    const successRate = ((context.vars.performanceMetrics.requests - context.vars.performanceMetrics.errors) / 
                        context.vars.performanceMetrics.requests) * 100;
    events.emit('gauge', 'success_rate', Math.round(successRate * 100) / 100);
    
    done();
  }
};