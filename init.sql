-- Database initialization script for UTXO Blockchain Indexer
-- This script runs automatically when PostgreSQL container starts

-- Create tables
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  height BIGINT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  voided BIGINT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  block_height BIGINT NOT NULL,
  voided BIGINT
);

CREATE TABLE IF NOT EXISTS utxos (
  tx_id TEXT NOT NULL,
  output_index INTEGER NOT NULL,
  address TEXT NOT NULL,
  value BIGINT NOT NULL,
  spent BOOLEAN DEFAULT FALSE,
  spent_in_tx TEXT,
  block_height BIGINT NOT NULL,
  voided BIGINT,
  PRIMARY KEY (tx_id, output_index)
);

CREATE TABLE IF NOT EXISTS address_balances (
  address TEXT PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0,
  last_updated_height BIGINT NOT NULL DEFAULT 0
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_utxos_address ON utxos(address);
CREATE INDEX IF NOT EXISTS idx_utxos_spent ON utxos(spent);
CREATE INDEX IF NOT EXISTS idx_utxos_block_height ON utxos(block_height);
CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);
CREATE INDEX IF NOT EXISTS idx_transactions_block_height ON transactions(block_height);
CREATE INDEX IF NOT EXISTS idx_utxos_spent_lookup ON utxos(tx_id, output_index, spent);
CREATE INDEX IF NOT EXISTS idx_address_balances_height ON address_balances(last_updated_height);

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'UTXO Blockchain Indexer database initialized successfully';
END $$; 