import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { setupTestDatabase, teardownTestDatabase } from './test-setup';

describe('API Endpoints', () => {
  let testDb: any;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase(testDb);
  });

  test('should connect to the test database', async () => {
    const result = await testDb.client.query('SELECT 1 as test');
    expect(result.rows[0].test).toBe(1);
  });
});