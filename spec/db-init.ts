import { Client } from 'pg';

export async function initializeTestDatabase(client: Client): Promise<void> {
  // Drop all existing tables
  await client.query('DROP TABLE IF EXISTS utxos, transactions, blocks, address_balances CASCADE');

  // Create blocks table
  await client.query(`
    CREATE TABLE blocks (
      id TEXT PRIMARY KEY,
      height BIGINT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Create transactions table
  await client.query(`
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
      block_height BIGINT NOT NULL
    )
  `);

  // Create utxos table
  await client.query(`
    CREATE TABLE utxos (
      tx_id TEXT NOT NULL,
      output_index INTEGER NOT NULL,
      address TEXT NOT NULL,
      value BIGINT NOT NULL,
      spent BOOLEAN DEFAULT FALSE,
      spent_in_tx TEXT,
      block_height BIGINT NOT NULL,
      PRIMARY KEY (tx_id, output_index)
    )
  `);

  // Create address_balances table
  await client.query(`
    CREATE TABLE address_balances (
      address TEXT PRIMARY KEY,
      balance BIGINT NOT NULL DEFAULT 0,
      last_updated_height BIGINT NOT NULL DEFAULT 0
    )
  `);
}

export async function cleanupTestDatabase(client: Client): Promise<void> {
  await client.query('TRUNCATE TABLE utxos, transactions, blocks, address_balances CASCADE');
} 