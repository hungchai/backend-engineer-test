import type Redis from 'ioredis';
import { Database } from './database.js';
import type {
  Block,
  BlockProcessingResult,
  IndexerConfig,
  ProcessingMetrics,
  RollbackResult
} from './types.js';
import { BlockValidator } from './validation.js';

export class UTXOIndexer {
  private database: Database;
  private validator: BlockValidator;
  private config: IndexerConfig;
  private metrics: ProcessingMetrics = {
    blockProcessingTime: 0,
    validationTime: 0,
    dbWriteTime: 0,
    cacheUpdateTime: 0,
    utxosProcessed: 0,
    balancesUpdated: 0
  };

  constructor(config: IndexerConfig, redis?: Redis) {
    this.config = config;
    this.database = new Database(config.database, redis!);
    this.validator = new BlockValidator(this.database);
  }

  async initialize(): Promise<void> {
    await this.database.initialize();
  }

  async processBlock(block: Block): Promise<BlockProcessingResult> {
    const startTime = performance.now();

    try {
      // Step 1: Structure validation
      const structureError = this.validator.validateBlockStructure(block);
      if (structureError) {
        throw new Error(`Block structure validation failed: ${structureError.message}`);
      }

      // Step 2: Business logic validation
      const validationStart = performance.now();
      const validationErrors = await this.validator.validateBlock(block);
      this.metrics.validationTime = performance.now() - validationStart;

      if (validationErrors.length > 0) {
        const errorMessages = validationErrors.map(e => e.message).join('; ');
        throw new Error(`Block validation failed: ${errorMessages}`);
      }

      // Step 3: Process block
      const dbWriteStart = performance.now();
      await this.database.processBlock(block);
      this.metrics.dbWriteTime = performance.now() - dbWriteStart;

      // Step 4: Update metrics
      this.updateProcessingMetrics(block);
      this.metrics.blockProcessingTime = performance.now() - startTime;

      return {
        blockId: block.id,
        height: block.height,
        transactionsProcessed: block.transactions.length,
        addressesAffected: this.countUniqueAddresses(block)
      };

    } catch (error) {
      throw new Error(`Block processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBalance(address: string): Promise<number> {
    try {
      const balance = await this.database.getAddressBalance(address);
      return Number(balance);
    } catch (error) {
      throw new Error(`Failed to get balance for address ${address}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async rollback(targetHeight: number): Promise<RollbackResult> {
    try {
      const currentHeight = await this.database.getCurrentHeight();

      // Validate rollback depth
      if (currentHeight - targetHeight > this.config.maxRollbackDepth) {
        throw new Error(`Rollback depth exceeds maximum allowed (${this.config.maxRollbackDepth} blocks)`);
      }

      // Validate target height
      if (targetHeight < 0) {
        throw new Error('Target height cannot be negative');
      }

      if (targetHeight >= currentHeight) {
        throw new Error(`Target height (${targetHeight}) must be less than current height (${currentHeight})`);
      }

      // Perform rollback
      const result = await this.database.rollbackToHeight(targetHeight);

      // Count affected addresses (we can't get this from the database result directly)
      // For now, we'll estimate based on the assumption that each transaction affects ~2 addresses
      const addressesAffected = Math.min(result.transactionsRemoved * 2, 1000); // Cap for performance

      return {
        targetHeight,
        blocksRemoved: result.blocksRemoved,
        transactionsRemoved: result.transactionsRemoved,
        addressesAffected
      };

    } catch (error) {
      throw new Error(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCurrentHeight(): Promise<number> {
    return await this.database.getCurrentHeight();
  }

  async getMetrics(): Promise<ProcessingMetrics> {
    return { ...this.metrics };
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    database: boolean;
    currentHeight: number;
    errors?: string[];
  }> {
    const errors: string[] = [];
    let databaseHealthy = false;
    let currentHeight = 0;

    try {
      databaseHealthy = await this.database.ping();
      if (!databaseHealthy) {
        errors.push('Database connection failed');
      }
    } catch (error) {
      errors.push(`Database health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      currentHeight = await this.database.getCurrentHeight();
    } catch (error) {
      errors.push(`Failed to get current height: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      status: errors.length === 0 ? 'healthy' : 'unhealthy',
      database: databaseHealthy,
      currentHeight,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private updateProcessingMetrics(block: Block): void {
    let utxosProcessed = 0;
    const addressesSet = new Set<string>();

    for (const tx of block.transactions) {
      utxosProcessed += tx.inputs.length; // UTXOs spent
      utxosProcessed += tx.outputs.length; // UTXOs created

      for (const output of tx.outputs) {
        addressesSet.add(output.address);
      }
    }

    this.metrics.utxosProcessed += utxosProcessed;
    this.metrics.balancesUpdated += addressesSet.size;
  }

  private countUniqueAddresses(block: Block): number {
    const addresses = new Set<string>();

    for (const tx of block.transactions) {
      for (const output of tx.outputs) {
        addresses.add(output.address);
      }
    }

    return addresses.size;
  }

  async close(): Promise<void> {
    await this.database.close();
  }

  async clearAll(): Promise<{ blocksRemoved: number, transactionsRemoved: number, utxosRemoved: number, addressesRemoved: number }> {
    try {
      return await this.database.clearAll();
    } catch (error) {
      throw new Error(`Failed to clear all data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 