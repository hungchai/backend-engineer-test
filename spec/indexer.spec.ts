import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from 'crypto';
import { Database } from '../src/database.js';
import { UTXOIndexer } from '../src/indexer.js';
import type { Block, IndexerConfig, Transaction } from '../src/types.js';

// Test configuration
const testConfig: IndexerConfig = {
  database: {
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/utxo_indexer_test',
    poolSize: 5,
    maxConnections: 10,
    idleTimeoutMs: 10000,
    connectionTimeoutMs: 5000
  },
  cache: {
    enabled: false,
    ttlSeconds: 300,
    maxMemoryMB: 100
  },
  maxRollbackDepth: 100,
  batchSize: 1000,
  enableMetrics: true
};

let indexer: UTXOIndexer;
let database: Database;

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

describe('UTXO Blockchain Indexer', () => {
  beforeAll(async () => {
    indexer = new UTXOIndexer(testConfig);
    database = new Database(testConfig.database);
    await indexer.initialize();
  });

  afterAll(async () => {
    await indexer.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    const client = await database['pool'].connect();
    try {
      await client.query('TRUNCATE TABLE address_balances, utxos, transactions, blocks CASCADE');
    } finally {
      client.release();
    }
  });

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
      expect(result.addressesAffected).toBe(1);

      // Verify balance
      const balance = await indexer.getBalance('addr1');
      expect(balance).toBe(100);
    });

    test('should process block with transaction chain', async () => {
      // Genesis block
      const block1 = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{
          address: 'addr1',
          value: 100
        }]
      }]);

      await indexer.processBlock(block1);

      // Transfer transaction
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
          address: 'addr3',
          value: 40
        }]
      }]);

      const result = await indexer.processBlock(block2);

      expect(result.height).toBe(2);

      // Verify balances
      expect(await indexer.getBalance('addr1')).toBe(0);
      expect(await indexer.getBalance('addr2')).toBe(60);
      expect(await indexer.getBalance('addr3')).toBe(40);
    });

    test('should reject block with invalid height', async () => {
      const invalidBlock = createTestBlock(3, [{ // Should be height 1
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
      // First create a UTXO
      const block1 = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      }]);
      await indexer.processBlock(block1);

      // Try to spend more than available
      const invalidBlock = createTestBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }], // 100 value
        outputs: [{ address: 'addr2', value: 150 }] // 150 value - invalid!
      }]);

      await expect(indexer.processBlock(invalidBlock)).rejects.toThrow('balance mismatch');
    });

    test('should reject block with non-existent UTXO reference', async () => {
      const invalidBlock = createTestBlock(1, [{
        id: 'tx1',
        inputs: [{ txId: 'non-existent', index: 0 }],
        outputs: [{ address: 'addr1', value: 100 }]
      }]);

      await expect(indexer.processBlock(invalidBlock)).rejects.toThrow('Referenced UTXO not found');
    });

    test('should reject block with already spent UTXO', async () => {
      // Create and spend a UTXO
      const block1 = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      }]);
      await indexer.processBlock(block1);

      const block2 = createTestBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr2', value: 100 }]
      }]);
      await indexer.processBlock(block2);

      // Try to spend the same UTXO again
      const invalidBlock = createTestBlock(3, [{
        id: 'tx3',
        inputs: [{ txId: 'tx1', index: 0 }], // Already spent!
        outputs: [{ address: 'addr3', value: 100 }]
      }]);

      await expect(indexer.processBlock(invalidBlock)).rejects.toThrow('UTXO already spent');
    });
  });

  describe('Balance Queries', () => {
    test('should return zero for non-existent address', async () => {
      const balance = await indexer.getBalance('non-existent-address');
      expect(balance).toBe(0);
    });

    test('should handle address with multiple UTXOs', async () => {
      const block = createTestBlock(1, [
        {
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 50 }]
        },
        {
          id: 'tx2',
          inputs: [],
          outputs: [{ address: 'addr1', value: 30 }]
        }
      ]);

      await indexer.processBlock(block);
      const balance = await indexer.getBalance('addr1');
      expect(balance).toBe(80);
    });

    test('should handle empty address parameter', async () => {
      await expect(indexer.getBalance('')).rejects.toThrow();
    });
  });

  describe('Rollback Operations', () => {
    test('should rollback to previous height', async () => {
      // Create chain of blocks
      const block1 = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      }]);
      await indexer.processBlock(block1);

      const block2 = createTestBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr2', value: 100 }]
      }]);
      await indexer.processBlock(block2);

      expect(await indexer.getBalance('addr1')).toBe(0);
      expect(await indexer.getBalance('addr2')).toBe(100);

      // Rollback to height 1
      const rollbackResult = await indexer.rollback(1);

      expect(rollbackResult.targetHeight).toBe(1);
      expect(rollbackResult.blocksRemoved).toBe(1);
      expect(rollbackResult.transactionsRemoved).toBe(1);

      // Check balances after rollback
      expect(await indexer.getBalance('addr1')).toBe(100);
      expect(await indexer.getBalance('addr2')).toBe(0);
    });

    test('should reject rollback to negative height', async () => {
      await expect(indexer.rollback(-1)).rejects.toThrow('cannot be negative');
    });

    test('should reject rollback to current or future height', async () => {
      const block = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      }]);
      await indexer.processBlock(block);

      await expect(indexer.rollback(1)).rejects.toThrow('must be less than current height');
      await expect(indexer.rollback(2)).rejects.toThrow('must be less than current height');
    });

    test('should reject rollback beyond maximum depth', async () => {
      // The test config has maxRollbackDepth: 100
      // We can't easily create 100+ blocks in this test, so we'll test the logic

      const block = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      }]);
      await indexer.processBlock(block);

      // Mock a scenario where current height - target > maxRollbackDepth
      // This would happen if we had 102 blocks and tried to rollback to height 1
      // For now, we test with a smaller depth by creating a new indexer with smaller limit
      const smallDepthConfig = { ...testConfig, maxRollbackDepth: 0 };
      const smallDepthIndexer = new UTXOIndexer(smallDepthConfig);
      await smallDepthIndexer.initialize();

      const smallBlock = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      }]);
      await smallDepthIndexer.processBlock(smallBlock);

      await expect(smallDepthIndexer.rollback(0)).rejects.toThrow('exceeds maximum allowed');

      await smallDepthIndexer.close();
    });
  });

  describe('Health Check', () => {
    test('should report healthy status', async () => {
      const health = await indexer.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.database).toBe(true);
      expect(health.currentHeight).toBeGreaterThanOrEqual(0);
      expect(health.errors).toBeUndefined();
    });
  });

  describe('Metrics', () => {
    test('should track processing metrics', async () => {
      const block = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [
          { address: 'addr1', value: 50 },
          { address: 'addr2', value: 50 }
        ]
      }]);

      await indexer.processBlock(block);
      const metrics = await indexer.getMetrics();

      expect(metrics.blockProcessingTime).toBeGreaterThan(0);
      expect(metrics.validationTime).toBeGreaterThan(0);
      expect(metrics.dbWriteTime).toBeGreaterThan(0);
      expect(metrics.utxosProcessed).toBe(2); // 2 outputs created
      expect(metrics.balancesUpdated).toBe(2); // 2 unique addresses
    });
  });

  describe('Edge Cases', () => {
    test('should handle transaction with no inputs (coinbase)', async () => {
      const coinbaseBlock = createTestBlock(1, [{
        id: 'coinbase1',
        inputs: [], // No inputs - like a coinbase transaction
        outputs: [{ address: 'miner', value: 50 }]
      }]);

      const result = await indexer.processBlock(coinbaseBlock);
      expect(result.transactionsProcessed).toBe(1);
      expect(await indexer.getBalance('miner')).toBe(50);
    });

    test('should handle transaction with multiple inputs and outputs', async () => {
      // Setup: Create multiple UTXOs
      const setupBlock = createTestBlock(1, [
        { id: 'tx1', inputs: [], outputs: [{ address: 'addr1', value: 100 }] },
        { id: 'tx2', inputs: [], outputs: [{ address: 'addr2', value: 200 }] }
      ]);
      await indexer.processBlock(setupBlock);

      // Complex transaction: Multiple inputs and outputs
      const complexBlock = createTestBlock(2, [{
        id: 'complex-tx',
        inputs: [
          { txId: 'tx1', index: 0 },
          { txId: 'tx2', index: 0 }
        ],
        outputs: [
          { address: 'addr3', value: 150 },
          { address: 'addr4', value: 100 },
          { address: 'addr5', value: 50 }
        ]
      }]);

      await indexer.processBlock(complexBlock);

      expect(await indexer.getBalance('addr1')).toBe(0);
      expect(await indexer.getBalance('addr2')).toBe(0);
      expect(await indexer.getBalance('addr3')).toBe(150);
      expect(await indexer.getBalance('addr4')).toBe(100);
      expect(await indexer.getBalance('addr5')).toBe(50);
    });

    test('should handle zero-value outputs', async () => {
      const zeroBlock = createTestBlock(1, [{
        id: 'zero-tx',
        inputs: [],
        outputs: [
          { address: 'addr1', value: 0 },
          { address: 'addr2', value: 100 }
        ]
      }]);

      await indexer.processBlock(zeroBlock);
      expect(await indexer.getBalance('addr1')).toBe(0);
      expect(await indexer.getBalance('addr2')).toBe(100);
    });

    test('should reject invalid transaction structure', async () => {
      const invalidTransactionBlock: any = {
        id: 'invalid',
        height: 1,
        transactions: [{
          id: '', // Invalid empty ID
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };

      await expect(indexer.processBlock(invalidTransactionBlock)).rejects.toThrow();
    });

    test('should reject invalid output structure', async () => {
      const invalidOutputBlock: any = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{
            address: '', // Invalid empty address
            value: 100
          }]
        }]
      };

      await expect(indexer.processBlock(invalidOutputBlock)).rejects.toThrow();
    });

    test('should reject negative values', async () => {
      const negativeValueBlock: any = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{
            address: 'addr1',
            value: -100 // Invalid negative value
          }]
        }]
      };

      await expect(indexer.processBlock(negativeValueBlock)).rejects.toThrow();
    });
  });

  describe('Current Height', () => {
    test('should return correct current height', async () => {
      expect(await indexer.getCurrentHeight()).toBe(0);

      const block1 = createTestBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      }]);
      await indexer.processBlock(block1);

      expect(await indexer.getCurrentHeight()).toBe(1);

      const block2 = createTestBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr2', value: 100 }]
      }]);
      await indexer.processBlock(block2);

      expect(await indexer.getCurrentHeight()).toBe(2);
    });
  });
}); 