import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from 'crypto';
import { UTXOIndexer } from '../src/indexer';
import { createRedisClient, withAddressLock } from '../src/redis';
import type { Block, Transaction } from '../src/types';
import { cleanupTestDatabase, initializeTestDatabase } from './db-init';
import { setupTestDatabase, teardownTestDatabase } from './test-setup';

describe('UTXO Blockchain Indexer', () => {
  let indexer: UTXOIndexer;
  let testDb: any;
  let redis: ReturnType<typeof createRedisClient>;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    redis = createRedisClient('redis://localhost:6379');
    const dbConfig = {
      connectionString: 'postgresql://postgres:password@localhost:5432/utxo_indexer',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 5000
    };
    const indexerConfig = { database: dbConfig, redis: { url: 'redis://localhost:6379' }, cache: { enabled: false, ttlSeconds: 300, maxMemoryMB: 100 }, maxRollbackDepth: 2000, batchSize: 1000, enableMetrics: true, server: { port: 3000, host: 'localhost' }, logging: { level: 'info', prettyPrint: true } };
    indexer = new UTXOIndexer(indexerConfig as any, redis);
    await indexer.initialize();
  });

  afterAll(async () => {
    await indexer.close();
    await teardownTestDatabase(testDb);
    try {
      await redis.quit();
    } catch (e) { }
  });

  beforeEach(async () => {
    await initializeTestDatabase(testDb.client);
    const dbConfig = {
      connectionString: 'postgresql://postgres:password@localhost:5432/utxo_indexer',
      maxConnections: 5,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 5000
    };
    const indexerConfig = { database: dbConfig, redis: { url: 'redis://localhost:6379' }, cache: { enabled: false, ttlSeconds: 300, maxMemoryMB: 100 }, maxRollbackDepth: 2000, batchSize: 1000, enableMetrics: true, server: { port: 3000, host: 'localhost' }, logging: { level: 'info', prettyPrint: true } };
    indexer = new UTXOIndexer(indexerConfig as any, redis);
    await cleanupTestDatabase(testDb.client);
  });

  // Helper function to create valid block hash
  function createBlockHash(height: number, transactionIds: string[]): string {
    const content = height.toString() + transactionIds.join('');
    return createHash('sha256').update(content).digest('hex');
  }

  // Helper function to create test block
  function createTestBlock(height: number, transactions: Transaction[]): Block {
    const transactionIds = transactions.map(tx => tx.id);
    const blockId = createBlockHash(height, transactionIds);

    return {
      id: blockId,
      height,
      transactions
    };
  }

  describe('Block Processing', () => {
    test('should process genesis block successfully', async () => {
      const genesisBlock = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{
          address: 'addr1',
          value: 100
        }]
      }]);

      const result = await indexer.processBlock(genesisBlock);

      expect(result.blockId).toBe(genesisBlock.id);
      expect(result.height).toBe(1);
      expect(result.transactionsProcessed).toBe(1);

      const balance = await indexer.getBalance('addr1');
      expect(balance).toBe(100);
    });

    test('should process block with transaction chain', async () => {
      const block1 = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{
          address: 'addr1',
          value: 100
        }]
      }]);
      await indexer.processBlock(block1);

      const block2 = createTestBlock(2, [{
        id: 'tx2',
        inputs: [{
          txId: 'tx1',
          index: 0
        }],
        outputs: [{
          address: 'addr2',
          value: 60
        }, {
          address: 'addr1', // Change address
          value: 40
        }]
      }]);
      const result = await indexer.processBlock(block2);
      expect(result.height).toBe(2);

      expect(await indexer.getBalance('addr1')).toBe(40);
      expect(await indexer.getBalance('addr2')).toBe(60);
    });

    test('should reject block with invalid height', async () => {
      const invalidBlock = createTestBlock(3, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      }]);
      await expect(indexer.processBlock(invalidBlock)).rejects.toThrow('Invalid block height');
    });

    test('should reject block with invalid hash', async () => {
      const block: Block = {
        id: 'invalid-hash',
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };
      await expect(indexer.processBlock(block)).rejects.toThrow('Invalid block hash');
    });

    test('should reject block with unbalanced transactions', async () => {
      const block1 = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      }]);
      await indexer.processBlock(block1);

      const invalidBlock = createTestBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr2', value: 150 }]
      }]);
      await expect(indexer.processBlock(invalidBlock)).rejects.toThrow('Transaction balance mismatch');
    });
  });
});

describe('Distributed Lock (Redis)', () => {
  let redis: ReturnType<typeof createRedisClient>;
  beforeAll(() => {
    redis = createRedisClient('redis://localhost:6379');
  });
  afterAll(async () => {
    try {
      await redis.quit();
    } catch (e) { }
  });
  test('should acquire and release lock for the same address', async () => {
    let lockAcquired = false;
    await withAddressLock(redis, 'test-address', async () => {
      lockAcquired = true;
    });
    expect(lockAcquired).toBe(true);
  });
  test('should not allow concurrent lock for the same address', async () => {
    let firstLock = false;
    let secondLockError: Error | null = null;
    await withAddressLock(redis, 'test-concurrent', async () => {
      firstLock = true;
      try {
        await withAddressLock(redis, 'test-concurrent', async () => { });
      } catch (err) {
        secondLockError = err as Error;
      }
    });
    expect(firstLock).toBe(true);
    expect(secondLockError).not.toBeNull();
    expect(secondLockError?.message).toMatch(/Could not acquire lock/);
  });
}); 