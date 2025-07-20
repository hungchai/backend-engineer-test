import { setupTestDatabase, teardownTestDatabase } from './spec/test-setup';

async function main() {
  console.log('Running test setup directly...');
  let testDb;
  try {
    testDb = await setupTestDatabase();
    console.log('✅ Test setup complete');
  } catch (error) {
    console.error('❌ Test setup failed', error);
  } finally {
    if (testDb) {
      await teardownTestDatabase(testDb);
      console.log('✅ Test teardown complete');
    }
  }
}

main(); 