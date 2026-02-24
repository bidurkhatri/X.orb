import mongoose from 'mongoose';
import { performance } from 'perf_hooks';

/**
 * Database Performance Tests
 * Tests database operations under various load conditions
 */

describe('Database Performance Tests', () => {
  let connection: typeof mongoose;
  const DB_CONNECTION_STRING = process.env.TEST_DB_URL || 'mongodb://localhost:27017/sylos_test';
  const CONCURRENT_USERS = 1000;
  const TEST_DURATION = 60000; // 1 minute

  beforeAll(async () => {
    // Connect to test database
    connection = await mongoose.connect(DB_CONNECTION_STRING, {
      bufferCommands: false,
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    // Create indexes for testing
    await createTestIndexes();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
    
    // Close database connection
    await connection.close();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await clearTestCollections();
  });

  describe('Connection Pool Performance', () => {
    it('should handle concurrent connections efficiently', async () => {
      const startTime = performance.now();
      const connections = [];
      const connectionCount = 100;

      // Create multiple concurrent connections
      for (let i = 0; i < connectionCount; i++) {
        const conn = await mongoose.createConnection(DB_CONNECTION_STRING, {
          bufferCommands: false,
          maxPoolSize: 10,
        }).asPromise();
        connections.push(conn);
      }

      const endTime = performance.now();
      const connectionTime = endTime - startTime;

      expect(connectionTime).toBeLessThan(5000); // Should connect within 5 seconds
      expect(connections).toHaveLength(connectionCount);

      // Clean up connections
      for (const conn of connections) {
        await conn.close();
      }
    });

    it('should maintain performance under high connection load', async () => {
      const startTime = performance.now();
      const queries = [];
      
      // Simulate high connection load
      for (let i = 0; i < 500; i++) {
        const queryPromise = executeTestQuery();
        queries.push(queryPromise);
      }

      await Promise.all(queries);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(queries).toHaveLength(500);
    });
  });

  describe('Read Performance Tests', () => {
    beforeEach(async () => {
      await seedTestData(10000); // Seed 10k documents
    });

    it('should handle large dataset queries efficiently', async () => {
      const startTime = performance.now();
      
      // Query large dataset
      const results = await TestUserModel.find({
        createdAt: { $gte: new Date(Date.now() - 86400000) } // Last 24 hours
      }).sort({ score: -1 }).limit(1000);
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(1000);
    });

    it('should perform aggregation operations efficiently', async () => {
      const startTime = performance.now();
      
      // Complex aggregation
      const results = await TestUserModel.aggregate([
        {
          $group: {
            _id: '$tier',
            count: { $sum: 1 },
            avgScore: { $avg: '$score' },
            totalBalance: { $sum: '$sylosBalance' }
          }
        },
        {
          $sort: { avgScore: -1 }
        }
      ]);
      
      const endTime = performance.now();
      const aggTime = endTime - startTime;

      expect(aggTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle text search efficiently', async () => {
      await TestUserModel.createIndexes(); // Create text index
      
      const startTime = performance.now();
      
      // Text search
      const results = await TestUserModel.find({
        $text: { $search: 'blockchain wallet' }
      }).limit(100);
      
      const endTime = performance.now();
      const searchTime = endTime - startTime;

      expect(searchTime).toBeLessThan(500); // Should complete within 500ms
      expect(results).toBeDefined();
    });

    it('should handle complex queries with multiple conditions', async () => {
      const startTime = performance.now();
      
      // Complex multi-condition query
      const results = await TestUserModel.find({
        score: { $gte: 5000, $lte: 15000 },
        tier: { $in: ['Gold', 'Diamond'] },
        sylosBalance: { $gt: 1000 },
        'preferences.notifications': true
      }).populate('transactions').sort({ lastActivity: -1 }).limit(500);
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      expect(queryTime).toBeLessThan(1500);
      expect(results).toBeDefined();
    });
  });

  describe('Write Performance Tests', () => {
    it('should handle bulk inserts efficiently', async () => {
      const testData = generateTestUsers(1000);
      const startTime = performance.now();
      
      // Bulk insert
      const result = await TestUserModel.insertMany(testData, { 
        ordered: false,
        batchSize: 100 
      });
      
      const endTime = performance.now();
      const insertTime = endTime - startTime;

      expect(insertTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result).toHaveLength(1000);
    });

    it('should handle concurrent writes efficiently', async () => {
      const writePromises = [];
      const concurrentWrites = 500;

      const startTime = performance.now();
      
      // Concurrent writes
      for (let i = 0; i < concurrentWrites; i++) {
        const user = new TestUserModel(generateTestUser());
        writePromises.push(user.save());
      }

      await Promise.all(writePromises);
      const endTime = performance.now();
      const writeTime = endTime - startTime;

      expect(writeTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(writePromises).toHaveLength(concurrentWrites);
    });

    it('should handle updates efficiently', async () => {
      // Seed test data
      await seedTestData(5000);
      
      const startTime = performance.now();
      
      // Batch update
      const result = await TestUserModel.updateMany(
        { tier: { $in: ['Bronze', 'Silver'] } },
        { 
          $inc: { score: 100 },
          $set: { lastActivity: new Date() }
        }
      );
      
      const endTime = performance.now();
      const updateTime = endTime - startTime;

      expect(updateTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(result.modifiedCount).toBeGreaterThan(0);
    });

    it('should handle delete operations efficiently', async () => {
      // Seed test data
      await seedTestData(2000);
      
      const startTime = performance.now();
      
      // Batch delete
      const result = await TestUserModel.deleteMany({
        createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Older than 7 days
      });
      
      const endTime = performance.now();
      const deleteTime = endTime - startTime;

      expect(deleteTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Index Performance Tests', () => {
    it('should demonstrate index efficiency improvement', async () => {
      // Seed large dataset
      await seedTestData(10000);
      
      // Test without index
      const startTime1 = performance.now();
      await TestUserModel.find({ score: { $gte: 5000 } }).explain('executionStats');
      const timeWithoutIndex = performance.now() - startTime1;
      
      // Create index
      await TestUserModel.createIndex({ score: 1 });
      
      // Test with index
      const startTime2 = performance.now();
      await TestUserModel.find({ score: { $gte: 5000 } }).explain('executionStats');
      const timeWithIndex = performance.now() - startTime2;
      
      // Index should improve performance
      expect(timeWithIndex).toBeLessThan(timeWithoutIndex);
    });

    it('should handle compound indexes efficiently', async () => {
      // Create compound index
      await TestUserModel.createIndex({ 
        tier: 1, 
        score: -1, 
        sylosBalance: 1 
      });
      
      const startTime = performance.now();
      
      // Query using compound index
      const results = await TestUserModel.find({
        tier: 'Gold',
        score: { $gte: 8000 },
        sylosBalance: { $gt: 1000 }
      }).limit(100);
      
      const queryTime = performance.now() - startTime;
      
      expect(queryTime).toBeLessThan(500);
      expect(results).toBeDefined();
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not cause memory leaks during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const results = await TestUserModel.find().limit(100).lean();
        results.length; // Force memory usage
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });

    it('should handle large result sets efficiently', async () => {
      // Seed large dataset
      await seedTestData(50000);
      
      const startTime = performance.now();
      
      // Stream large result set
      const cursor = TestUserModel.find().cursor();
      let count = 0;
      
      for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        count++;
        if (count >= 1000) break; // Limit for testing
      }
      
      const endTime = performance.now();
      const streamTime = endTime - startTime;
      
      expect(streamTime).toBeLessThan(2000);
      expect(count).toBe(1000);
    });
  });

  describe('Stress Tests', () => {
    it('should maintain performance under sustained load', async () => {
      const startTime = performance.now();
      const operations = [];
      const duration = 10000; // 10 seconds
      
      // Simulate sustained load
      const interval = setInterval(async () => {
        if (performance.now() - startTime > duration) {
          clearInterval(interval);
          return;
        }
        
        // Mix of read and write operations
        const operation = Math.random() > 0.5 
          ? TestUserModel.findOne().lean()
          : TestUserModel.create(generateTestUser());
        
        operations.push(operation);
      }, 10); // Every 10ms
      
      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, duration + 1000));
      
      const results = await Promise.all(operations);
      const totalOperations = operations.length;
      
      expect(totalOperations).toBeGreaterThan(500); // Should handle many operations
      expect(results).toBeDefined();
    });

    it('should handle concurrent mixed operations efficiently', async () => {
      // Seed test data
      await seedTestData(1000);
      
      const operations = [];
      const operationCount = 200;
      
      // Mix of different operations
      for (let i = 0; i < operationCount; i++) {
        const operationType = Math.random();
        
        if (operationType < 0.3) {
          // Read operations
          operations.push(TestUserModel.findOne().lean());
        } else if (operationType < 0.6) {
          // Update operations
          operations.push(
            TestUserModel.updateOne(
              { _id: { $exists: true } },
              { $inc: { score: 1 } }
            )
          );
        } else {
          // Write operations
          operations.push(TestUserModel.create(generateTestUser()));
        }
      }
      
      const startTime = performance.now();
      await Promise.all(operations);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Connection Recovery Tests', () => {
    it('should handle connection interruptions gracefully', async () => {
      // Simulate connection interruption
      await connection.close();
      
      const startTime = performance.now();
      
      try {
        await TestUserModel.findOne();
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
      
      // Reconnect
      await mongoose.connect(DB_CONNECTION_STRING);
      
      const recoveryTime = performance.now() - startTime;
      expect(recoveryTime).toBeLessThan(10000); // Should recover within 10 seconds
      
      // Verify connection works
      const result = await TestUserModel.findOne();
      expect(result).toBeDefined();
    });
  });
});

// Test schemas and models
const TestUserSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  walletAddress: { type: String, required: true, index: true },
  score: { type: Number, default: 0, index: true },
  tier: { type: String, enum: ['Bronze', 'Silver', 'Gold', 'Diamond'], index: true },
  sylosBalance: { type: Number, default: 0, index: true },
  lastActivity: { type: Date, default: Date.now, index: true },
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TestTransaction' }],
  preferences: {
    notifications: { type: Boolean, default: true },
    theme: { type: String, default: 'dark' },
    language: { type: String, default: 'en' }
  },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

const TestTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  hash: { type: String, required: true, unique: true },
  type: { type: String, enum: ['transfer', 'stake', 'unstake'], required: true },
  amount: { type: Number, required: true },
  gasUsed: { type: Number, required: true },
  blockNumber: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const TestUserModel = mongoose.models.TestUser || mongoose.model('TestUser', TestUserSchema);
const TestTransactionModel = mongoose.models.TestTransaction || mongoose.model('TestTransaction', TestTransactionSchema);

// Helper functions
async function createTestIndexes() {
  await TestUserModel.createIndexes();
  await TestTransactionModel.createIndexes();
}

async function cleanupTestData() {
  await TestUserModel.deleteMany({});
  await TestTransactionModel.deleteMany({});
}

async function clearTestCollections() {
  await TestUserModel.deleteMany({});
  await TestTransactionModel.deleteMany({});
}

async function seedTestData(count: number) {
  const users = generateTestUsers(count);
  await TestUserModel.insertMany(users, { ordered: false });
}

function generateTestUsers(count: number) {
  const users = [];
  const tiers = ['Bronze', 'Silver', 'Gold', 'Diamond'];
  
  for (let i = 0; i < count; i++) {
    users.push(generateTestUser(i));
  }
  
  return users;
}

function generateTestUser(index: number = 0) {
  return {
    userId: `test_user_${index}_${Date.now()}`,
    walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
    score: Math.floor(Math.random() * 20000),
    tier: ['Bronze', 'Silver', 'Gold', 'Diamond'][Math.floor(Math.random() * 4)],
    sylosBalance: Math.floor(Math.random() * 100000) / 100,
    lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    preferences: {
      notifications: Math.random() > 0.2,
      theme: Math.random() > 0.5 ? 'dark' : 'light',
      language: ['en', 'es', 'fr', 'de', 'zh'][Math.floor(Math.random() * 5)]
    },
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
  };
}

async function executeTestQuery() {
  return TestUserModel.findOne({ score: { $gte: 1000 } }).lean();
}
