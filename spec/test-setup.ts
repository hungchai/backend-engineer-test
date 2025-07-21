import { Client } from 'pg';

export async function setupTestDatabase() {
  console.log('Connecting to existing test database...');

  try {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'utxo_indexer',
      user: 'postgres',
      password: 'password',
    });

    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS utxos (
        id SERIAL PRIMARY KEY,
        txid VARCHAR(64) NOT NULL,
        vout INT NOT NULL,
        address VARCHAR(255) NOT NULL,
        amount BIGINT NOT NULL,
        height INT NOT NULL,
        UNIQUE(txid, vout)
      );
    `);

    console.log('✅ Test database setup complete');
    return { client };
  } catch (error) {
    console.error('Failed to connect to test database', error);
    throw error;
  }
}

export async function teardownTestDatabase(testSetup: any) {
  if (testSetup && testSetup.client) {
    await testSetup.client.end();
  }
} 