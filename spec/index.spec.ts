import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { setupTestDatabase, teardownTestDatabase } from './test-setup';

describe('API Endpoints', () => {
  let testDb: any;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase(testDb);
  });

  test('should connect to the test database', () => {
    expect(testDb).toBeDefined();
    expect(testDb.client).toBeDefined();
  });
});