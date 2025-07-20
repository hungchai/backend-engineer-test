import { Pool, type PoolClient } from 'pg';
import type {
  Block,
  DBBlock,
  DBUTXO,
  DatabaseConfig,
  Transaction
} from './types.js';

export class Database {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxConnections,
      idleTimeoutMillis: config.idleTimeoutMs,
      connectionTimeoutMillis: config.connectionTimeoutMs
    });
  }

  async initialize(): Promise<void> {
    await this.createTables();
    await this.createIndexes();
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Blocks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS blocks (
          id TEXT PRIMARY KEY,
          height BIGINT UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Transactions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
          block_height BIGINT NOT NULL
        )
      `);

      // UTXOs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS utxos (
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

      // Address balances table
      await client.query(`
        CREATE TABLE IF NOT EXISTS address_balances (
          address TEXT PRIMARY KEY,
          balance BIGINT NOT NULL DEFAULT 0,
          last_updated_height BIGINT NOT NULL DEFAULT 0
        )
      `);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async createIndexes(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_utxos_address ON utxos(address)',
        'CREATE INDEX IF NOT EXISTS idx_utxos_spent ON utxos(spent)',
        'CREATE INDEX IF NOT EXISTS idx_utxos_block_height ON utxos(block_height)',
        'CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height)',
        'CREATE INDEX IF NOT EXISTS idx_transactions_block_height ON transactions(block_height)',
        'CREATE INDEX IF NOT EXISTS idx_utxos_spent_lookup ON utxos(tx_id, output_index, spent)',
        'CREATE INDEX IF NOT EXISTS idx_address_balances_height ON address_balances(last_updated_height)'
      ];

      for (const indexQuery of indexes) {
        await client.query(indexQuery);
      }
    } finally {
      client.release();
    }
  }

  async getCurrentHeight(): Promise<number> {
    const result = await this.pool.query(
      'SELECT COALESCE(MAX(height), 0) as height FROM blocks'
    );
    return Number(result.rows[0].height);
  }

  async getBlock(height: number): Promise<DBBlock | null> {
    const result = await this.pool.query(
      'SELECT * FROM blocks WHERE height = $1',
      [height]
    );
    return result.rows[0] || null;
  }

  async getUTXO(txId: string, index: number): Promise<DBUTXO | null> {
    const result = await this.pool.query(
      'SELECT * FROM utxos WHERE tx_id = $1 AND output_index = $2',
      [txId, index]
    );
    return result.rows[0] || null;
  }

  async getUTXOsForInputs(inputs: Array<{ txId: string, index: number }>): Promise<Map<string, DBUTXO>> {
    if (inputs.length === 0) return new Map();

    const conditions = inputs.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
    const values = inputs.flatMap(input => [input.txId, input.index]);

    const result = await this.pool.query(
      `SELECT * FROM utxos WHERE (tx_id, output_index) IN (VALUES ${conditions})`,
      values
    );

    const utxoMap = new Map<string, DBUTXO>();
    for (const row of result.rows) {
      const key = `${row.tx_id}:${row.output_index}`;
      utxoMap.set(key, row);
    }

    return utxoMap;
  }

  async getAddressBalance(address: string): Promise<bigint> {
    const result = await this.pool.query(
      'SELECT balance FROM address_balances WHERE address = $1',
      [address]
    );
    return result.rows[0]?.balance || 0n;
  }

  async processBlock(block: Block): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert block record
      await this.insertBlock(client, block);

      // 2. Process all transactions
      for (const tx of block.transactions) {
        await this.processTransaction(client, tx, block.id, block.height);

        // 3. Mark input UTXOs as spent
        for (const input of tx.inputs) {
          await this.markUTXOSpent(client, input.txId, input.index, tx.id);
        }

        // 4. Create new output UTXOs
        for (let i = 0; i < tx.outputs.length; i++) {
          await this.createUTXO(client, tx.id, i, tx.outputs[i], block.height);
        }
      }

      // 5. Update address balances
      await this.updateAddressBalances(client, block);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertBlock(client: PoolClient, block: Block): Promise<void> {
    await client.query(
      'INSERT INTO blocks (id, height) VALUES ($1, $2)',
      [block.id, block.height]
    );
  }

  private async processTransaction(
    client: PoolClient,
    tx: Transaction,
    blockId: string,
    blockHeight: number
  ): Promise<void> {
    // Insert transaction record
    await client.query(
      'INSERT INTO transactions (id, block_id, block_height) VALUES ($1, $2, $3)',
      [tx.id, blockId, blockHeight]
    );
  }

  private async markUTXOSpent(
    client: PoolClient,
    txId: string,
    index: number,
    spentInTx: string
  ): Promise<void> {
    await client.query(
      'UPDATE utxos SET spent = TRUE, spent_in_tx = $1 WHERE tx_id = $2 AND output_index = $3',
      [spentInTx, txId, index]
    );
  }

  private async createUTXO(
    client: PoolClient,
    txId: string,
    index: number,
    output: { address: string; value: number },
    blockHeight: number
  ): Promise<void> {
    await client.query(
      'INSERT INTO utxos (tx_id, output_index, address, value, block_height) VALUES ($1, $2, $3, $4, $5)',
      [txId, index, output.address, output.value, blockHeight]
    );
  }

  private async updateAddressBalances(client: PoolClient, block: Block): Promise<void> {
    // Calculate balance changes for all affected addresses
    const balanceChanges = new Map<string, bigint>();

    for (const tx of block.transactions) {
      // Process inputs (decrease balances)
      for (const input of tx.inputs) {
        const utxo = await client.query(
          'SELECT address, value FROM utxos WHERE tx_id = $1 AND output_index = $2',
          [input.txId, input.index]
        );

        if (utxo.rows[0]) {
          const address = utxo.rows[0].address;
          const value = BigInt(utxo.rows[0].value);
          balanceChanges.set(address, (balanceChanges.get(address) || 0n) - value);
        }
      }

      // Process outputs (increase balances)
      for (const output of tx.outputs) {
        const value = BigInt(output.value);
        balanceChanges.set(output.address, (balanceChanges.get(output.address) || 0n) + value);
      }
    }

    // Apply all balance changes
    for (const [address, deltaValue] of balanceChanges) {
      await this.updateAddressBalance(client, address, deltaValue, block.height);
    }
  }

  private async updateAddressBalance(
    client: PoolClient,
    address: string,
    deltaValue: bigint,
    height: number
  ): Promise<void> {
    await client.query(`
      INSERT INTO address_balances (address, balance, last_updated_height)
      VALUES ($1, $2, $3)
      ON CONFLICT (address)
      DO UPDATE SET
        balance = address_balances.balance + $2,
        last_updated_height = $3
    `, [address, deltaValue, height]);
  }

  async rollbackToHeight(targetHeight: number): Promise<{ blocksRemoved: number, transactionsRemoved: number }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get affected addresses before rollback
      const affectedAddresses = await client.query(
        'SELECT DISTINCT address FROM utxos WHERE block_height > $1',
        [targetHeight]
      );

      // Mark UTXOs as unspent if they were spent in blocks to be removed
      await client.query(`
        UPDATE utxos SET spent = FALSE, spent_in_tx = NULL
        WHERE spent_in_tx IN (
          SELECT id FROM transactions WHERE block_height > $1
        )
      `, [targetHeight]);

      // Delete UTXOs created in blocks to be removed
      await client.query(
        'DELETE FROM utxos WHERE block_height > $1',
        [targetHeight]
      );

      // Count transactions to be removed
      const txResult = await client.query(
        'SELECT COUNT(*) as count FROM transactions WHERE block_height > $1',
        [targetHeight]
      );
      const transactionsRemoved = parseInt(txResult.rows[0].count);

      // Delete transactions
      await client.query(
        'DELETE FROM transactions WHERE block_height > $1',
        [targetHeight]
      );

      // Count blocks to be removed
      const blockResult = await client.query(
        'SELECT COUNT(*) as count FROM blocks WHERE height > $1',
        [targetHeight]
      );
      const blocksRemoved = parseInt(blockResult.rows[0].count);

      // Delete blocks
      await client.query(
        'DELETE FROM blocks WHERE height > $1',
        [targetHeight]
      );

      // Recalculate balances for affected addresses
      for (const row of affectedAddresses.rows) {
        const address = row.address;
        const balanceResult = await client.query(`
          SELECT COALESCE(SUM(
            CASE WHEN spent THEN 0 ELSE value END
          ), 0) as balance
          FROM utxos WHERE address = $1
        `, [address]);

        const newBalance = balanceResult.rows[0].balance;

        await client.query(`
          UPDATE address_balances 
          SET balance = $1, last_updated_height = $2
          WHERE address = $3
        `, [newBalance, targetHeight, address]);
      }

      await client.query('COMMIT');
      return { blocksRemoved, transactionsRemoved };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1');
      return result.rows.length === 1;
    } catch {
      return false;
    }
  }
} 