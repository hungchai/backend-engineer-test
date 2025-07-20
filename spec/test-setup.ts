import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

export async function setupTestDatabase() {
  const container = await new PostgreSqlContainer().start();

  const client = new Client({
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getPassword(),
  });

  await client.connect();

  // You can run any setup SQL here, e.g., creating tables
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

  return {
    client,
    container,
  };
} 