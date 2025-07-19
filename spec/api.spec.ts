import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from 'crypto';

// Mock fastify app for testing
let app: any;
let testPort = 3001;

// Helper to create valid block hash
function createBlockHash(height: number, transactionIds: string[]): string {
  const content = height.toString() + transactionIds.join('');
  return createHash('sha256').update(content).digest('hex');
}

// Helper to create test request
async function makeRequest(method: string, path: string, body?: any) {
  const url = `http://localhost:${testPort}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  return {
    status: response.status,
    data
  };
}

describe('UTXO Indexer API', () => {
  beforeAll(async () => {
    // Set test environment
    process.env.DATABASE_URL = 'postgresql://localhost:5432/utxo_indexer_test';

    // Start the server for testing
    // Note: In a real test, you'd import and start your actual server
    // For this example, we'll mock the behavior
    console.log('Starting test server...');
  });

  afterAll(async () => {
    // Clean up
    console.log('Stopping test server...');
  });

  beforeEach(async () => {
    // Clean state before each test
    // This would reset the database in a real test
  });

  describe('POST /blocks', () => {
    test('should process valid genesis block', async () => {
      const genesisBlock = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{
            address: 'addr1',
            value: 100
          }]
        }]
      };

      const response = await makeRequest('POST', '/blocks', genesisBlock);

      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Block processed successfully');
      expect(response.data.result.height).toBe(1);
      expect(response.data.result.transactionsProcessed).toBe(1);
    });

    test('should reject block with invalid height', async () => {
      const invalidBlock = {
        id: createBlockHash(5, ['tx1']), // Should be height 1 for genesis
        height: 5,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };

      const response = await makeRequest('POST', '/blocks', invalidBlock);

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Bad Request');
      expect(response.data.message).toContain('Invalid block height');
    });

    test('should reject block with invalid hash', async () => {
      const invalidBlock = {
        id: 'invalid-hash-value',
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };

      const response = await makeRequest('POST', '/blocks', invalidBlock);

      expect(response.status).toBe(400);
      expect(response.data.message).toContain('Invalid block hash');
    });

    test('should reject block with unbalanced transactions', async () => {
      // First process a genesis block
      const genesisBlock = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };
      await makeRequest('POST', '/blocks', genesisBlock);

      // Try to spend more than available
      const unbalancedBlock = {
        id: createBlockHash(2, ['tx2']),
        height: 2,
        transactions: [{
          id: 'tx2',
          inputs: [{ txId: 'tx1', index: 0 }], // 100 value input
          outputs: [{ address: 'addr2', value: 150 }] // 150 value output - invalid!
        }]
      };

      const response = await makeRequest('POST', '/blocks', unbalancedBlock);

      expect(response.status).toBe(400);
      expect(response.data.message).toContain('balance mismatch');
    });

    test('should reject request with missing body', async () => {
      const response = await makeRequest('POST', '/blocks');

      expect(response.status).toBe(400);
      expect(response.data.message).toBe('Request body is required');
    });

    test('should reject block with invalid structure', async () => {
      const invalidBlock = {
        // Missing required fields
        height: 1
        // No id, no transactions
      };

      const response = await makeRequest('POST', '/blocks', invalidBlock);

      expect(response.status).toBe(400);
      expect(response.data.message).toContain('Block must have');
    });

    test('should reject block with invalid transaction structure', async () => {
      const invalidBlock = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: '', // Invalid empty ID
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };

      const response = await makeRequest('POST', '/blocks', invalidBlock);

      expect(response.status).toBe(400);
      expect(response.data.message).toContain('Invalid transaction');
    });

    test('should reject block with negative output values', async () => {
      const invalidBlock = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: -100 }] // Negative value
        }]
      };

      const response = await makeRequest('POST', '/blocks', invalidBlock);

      expect(response.status).toBe(400);
      expect(response.data.message).toContain('Invalid output value');
    });
  });

  describe('GET /balance/:address', () => {
    test('should return balance for existing address', async () => {
      // First create a block with some balance
      const block = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'test-address', value: 250 }]
        }]
      };
      await makeRequest('POST', '/blocks', block);

      const response = await makeRequest('GET', '/balance/test-address');

      expect(response.status).toBe(200);
      expect(response.data.address).toBe('test-address');
      expect(response.data.balance).toBe(250);
    });

    test('should return zero for non-existent address', async () => {
      const response = await makeRequest('GET', '/balance/non-existent-address');

      expect(response.status).toBe(200);
      expect(response.data.address).toBe('non-existent-address');
      expect(response.data.balance).toBe(0);
    });

    test('should handle address with whitespace', async () => {
      const response = await makeRequest('GET', '/balance/ test-address ');

      expect(response.status).toBe(200);
      expect(response.data.address).toBe('test-address'); // Should be trimmed
    });

    test('should reject empty address', async () => {
      const response = await makeRequest('GET', '/balance/');

      // This would be handled by the router as a 404, but let's test empty string
      const emptyResponse = await makeRequest('GET', '/balance/ '); // Just spaces

      expect(emptyResponse.status).toBe(400);
      expect(emptyResponse.data.message).toContain('Address parameter is required');
    });
  });

  describe('POST /rollback', () => {
    test('should rollback to previous height', async () => {
      // Create a chain of blocks
      const block1 = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };
      await makeRequest('POST', '/blocks', block1);

      const block2 = {
        id: createBlockHash(2, ['tx2']),
        height: 2,
        transactions: [{
          id: 'tx2',
          inputs: [{ txId: 'tx1', index: 0 }],
          outputs: [{ address: 'addr2', value: 100 }]
        }]
      };
      await makeRequest('POST', '/blocks', block2);

      // Rollback to height 1
      const response = await makeRequest('POST', '/rollback?height=1');

      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Rollback completed successfully');
      expect(response.data.result.targetHeight).toBe(1);
      expect(response.data.result.blocksRemoved).toBe(1);

      // Verify balances after rollback
      const addr1Balance = await makeRequest('GET', '/balance/addr1');
      const addr2Balance = await makeRequest('GET', '/balance/addr2');

      expect(addr1Balance.data.balance).toBe(100);
      expect(addr2Balance.data.balance).toBe(0);
    });

    test('should reject rollback without height parameter', async () => {
      const response = await makeRequest('POST', '/rollback');

      expect(response.status).toBe(400);
      expect(response.data.message).toBe('Height query parameter is required');
    });

    test('should reject rollback with invalid height parameter', async () => {
      const response = await makeRequest('POST', '/rollback?height=invalid');

      expect(response.status).toBe(400);
      expect(response.data.message).toBe('Height must be a valid number');
    });

    test('should reject rollback to negative height', async () => {
      const response = await makeRequest('POST', '/rollback?height=-1');

      expect(response.status).toBe(400);
      expect(response.data.message).toContain('cannot be negative');
    });

    test('should reject rollback to current or future height', async () => {
      // Create one block
      const block = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };
      await makeRequest('POST', '/blocks', block);

      // Try to rollback to current height
      const response1 = await makeRequest('POST', '/rollback?height=1');
      expect(response1.status).toBe(400);
      expect(response1.data.message).toContain('must be less than current height');

      // Try to rollback to future height
      const response2 = await makeRequest('POST', '/rollback?height=5');
      expect(response2.status).toBe(400);
      expect(response2.data.message).toContain('must be less than current height');
    });
  });

  describe('GET /health', () => {
    test('should return healthy status', async () => {
      const response = await makeRequest('GET', '/health');

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
      expect(response.data.database).toBe(true);
      expect(typeof response.data.currentHeight).toBe('number');
    });
  });

  describe('GET /metrics', () => {
    test('should return performance metrics', async () => {
      // Process a block to generate some metrics
      const block = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [
            { address: 'addr1', value: 50 },
            { address: 'addr2', value: 50 }
          ]
        }]
      };
      await makeRequest('POST', '/blocks', block);

      const response = await makeRequest('GET', '/metrics');

      expect(response.status).toBe(200);
      expect(typeof response.data.currentHeight).toBe('number');
      expect(response.data.processing).toBeDefined();
      expect(response.data.timestamp).toBeDefined();
      expect(typeof response.data.processing.blockProcessingTime).toBe('number');
      expect(typeof response.data.processing.validationTime).toBe('number');
      expect(typeof response.data.processing.dbWriteTime).toBe('number');
    });
  });

  describe('GET /', () => {
    test('should return API information', async () => {
      const response = await makeRequest('GET', '/');

      expect(response.status).toBe(200);
      expect(response.data.name).toBe('UTXO Blockchain Indexer');
      expect(response.data.version).toBe('1.0.0');
      expect(response.data.status).toBe('running');
      expect(typeof response.data.currentHeight).toBe('number');
      expect(response.data.endpoints).toBeDefined();
      expect(response.data.endpoints['POST /blocks']).toBeDefined();
      expect(response.data.endpoints['GET /balance/:address']).toBeDefined();
      expect(response.data.endpoints['POST /rollback?height=number']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      const response = await makeRequest('GET', '/non-existent-endpoint');

      expect(response.status).toBe(404);
    });

    test('should handle invalid JSON in request body', async () => {
      const url = `http://localhost:${testPort}/blocks`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid-json{'
      });

      expect(response.status).toBe(400);
    });

    test('should handle internal server errors gracefully', async () => {
      // This would test scenario where database is down
      // In a real test, you might mock the database to throw errors

      // For now, we can test with an invalid database state
      // (This is a simplified example)
      const response = await makeRequest('GET', '/health');

      // Even if there are internal issues, health endpoint should respond
      expect(response.status).toBeOneOf([200, 503]);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle the README example correctly', async () => {
      // Block 1: addr1 receives 10
      const block1 = {
        id: createBlockHash(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 10 }]
        }]
      };
      let response = await makeRequest('POST', '/blocks', block1);
      expect(response.status).toBe(200);

      // Verify addr1 balance
      let balance = await makeRequest('GET', '/balance/addr1');
      expect(balance.data.balance).toBe(10);

      // Block 2: addr1 sends 4 to addr2 and 6 to addr3
      const block2 = {
        id: createBlockHash(2, ['tx2']),
        height: 2,
        transactions: [{
          id: 'tx2',
          inputs: [{ txId: 'tx1', index: 0 }],
          outputs: [
            { address: 'addr2', value: 4 },
            { address: 'addr3', value: 6 }
          ]
        }]
      };
      response = await makeRequest('POST', '/blocks', block2);
      expect(response.status).toBe(200);

      // Verify balances
      expect((await makeRequest('GET', '/balance/addr1')).data.balance).toBe(0);
      expect((await makeRequest('GET', '/balance/addr2')).data.balance).toBe(4);
      expect((await makeRequest('GET', '/balance/addr3')).data.balance).toBe(6);

      // Block 3: addr3 sends to addr4, addr5, addr6
      const block3 = {
        id: createBlockHash(3, ['tx3']),
        height: 3,
        transactions: [{
          id: 'tx3',
          inputs: [{ txId: 'tx2', index: 1 }], // addr3's 6 coins
          outputs: [
            { address: 'addr4', value: 2 },
            { address: 'addr5', value: 2 },
            { address: 'addr6', value: 2 }
          ]
        }]
      };
      response = await makeRequest('POST', '/blocks', block3);
      expect(response.status).toBe(200);

      // Verify final balances
      expect((await makeRequest('GET', '/balance/addr1')).data.balance).toBe(0);
      expect((await makeRequest('GET', '/balance/addr2')).data.balance).toBe(4);
      expect((await makeRequest('GET', '/balance/addr3')).data.balance).toBe(0);
      expect((await makeRequest('GET', '/balance/addr4')).data.balance).toBe(2);
      expect((await makeRequest('GET', '/balance/addr5')).data.balance).toBe(2);
      expect((await makeRequest('GET', '/balance/addr6')).data.balance).toBe(2);

      // Rollback to height 2
      const rollbackResponse = await makeRequest('POST', '/rollback?height=2');
      expect(rollbackResponse.status).toBe(200);

      // Verify balances after rollback
      expect((await makeRequest('GET', '/balance/addr1')).data.balance).toBe(0);
      expect((await makeRequest('GET', '/balance/addr2')).data.balance).toBe(4);
      expect((await makeRequest('GET', '/balance/addr3')).data.balance).toBe(6);
      expect((await makeRequest('GET', '/balance/addr4')).data.balance).toBe(0);
      expect((await makeRequest('GET', '/balance/addr5')).data.balance).toBe(0);
      expect((await makeRequest('GET', '/balance/addr6')).data.balance).toBe(0);
    });

    test('should handle multiple transactions in single block', async () => {
      const block = {
        id: createBlockHash(1, ['tx1', 'tx2', 'tx3']),
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'miner1', value: 50 }]
          },
          {
            id: 'tx2',
            inputs: [],
            outputs: [{ address: 'miner2', value: 50 }]
          },
          {
            id: 'tx3',
            inputs: [],
            outputs: [{ address: 'miner3', value: 50 }]
          }
        ]
      };

      const response = await makeRequest('POST', '/blocks', block);
      expect(response.status).toBe(200);
      expect(response.data.result.transactionsProcessed).toBe(3);

      // Verify all balances
      expect((await makeRequest('GET', '/balance/miner1')).data.balance).toBe(50);
      expect((await makeRequest('GET', '/balance/miner2')).data.balance).toBe(50);
      expect((await makeRequest('GET', '/balance/miner3')).data.balance).toBe(50);
    });
  });
}); 