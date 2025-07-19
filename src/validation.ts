import { createHash } from 'crypto';
import type { Database } from './database.js';
import type {
  Block,
  BlockValidationContext,
  Input,
  Transaction,
  ValidationError
} from './types.js';

export class BlockValidator {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async validateBlock(block: Block): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    try {
      // Create validation context
      const context = await this.createValidationContext(block);

      // Run all validations
      const heightError = await this.validateHeight(block, context);
      if (heightError) errors.push(heightError);

      const hashError = this.validateBlockHash(block);
      if (hashError) errors.push(hashError);

      const balanceError = await this.validateTransactionBalances(block, context);
      if (balanceError) errors.push(balanceError);

      const utxoErrors = await this.validateUTXOs(block, context);
      errors.push(...utxoErrors);

    } catch (error) {
      errors.push({
        type: 'VALIDATION',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      });
    }

    return errors;
  }

  private async createValidationContext(block: Block): Promise<BlockValidationContext> {
    const currentHeight = await this.database.getCurrentHeight();

    // Collect all inputs from all transactions
    const allInputs: Input[] = [];
    for (const tx of block.transactions) {
      allInputs.push(...tx.inputs);
    }

    // Fetch all referenced UTXOs in one batch
    const existingUTXOs = await this.database.getUTXOsForInputs(allInputs);

    // Calculate total input and output values
    let totalInputValue = 0;
    let totalOutputValue = 0;

    for (const tx of block.transactions) {
      for (const input of tx.inputs) {
        const utxo = existingUTXOs.get(`${input.txId}:${input.index}`);
        if (utxo) {
          totalInputValue += Number(utxo.value);
        }
      }

      for (const output of tx.outputs) {
        totalOutputValue += output.value;
      }
    }

    return {
      currentHeight,
      existingUTXOs,
      totalInputValue,
      totalOutputValue
    };
  }

  private async validateHeight(block: Block, context: BlockValidationContext): Promise<ValidationError | null> {
    const expectedHeight = context.currentHeight + 1;

    if (block.height !== expectedHeight) {
      return {
        type: 'HEIGHT_VALIDATION',
        message: `Invalid block height. Expected ${expectedHeight}, got ${block.height}`,
        details: {
          expected: expectedHeight,
          actual: block.height,
          currentHeight: context.currentHeight
        }
      };
    }

    return null;
  }

  private validateBlockHash(block: Block): ValidationError | null {
    const expectedHash = this.calculateBlockHash(block);

    if (block.id !== expectedHash) {
      return {
        type: 'HASH_VALIDATION',
        message: `Invalid block hash. Expected ${expectedHash}, got ${block.id}`,
        details: {
          expected: expectedHash,
          actual: block.id,
          height: block.height,
          transactionIds: block.transactions.map(tx => tx.id)
        }
      };
    }

    return null;
  }

  private calculateBlockHash(block: Block): string {
    // SHA256(height + transaction1.id + transaction2.id + ... + transactionN.id)
    const content = block.height.toString() + block.transactions.map(tx => tx.id).join('');
    return createHash('sha256').update(content).digest('hex');
  }

  private async validateTransactionBalances(
    block: Block,
    context: BlockValidationContext
  ): Promise<ValidationError | null> {
    if (context.totalInputValue !== context.totalOutputValue) {
      return {
        type: 'BALANCE_VALIDATION',
        message: `Transaction balance mismatch. Inputs: ${context.totalInputValue}, Outputs: ${context.totalOutputValue}`,
        details: {
          totalInputValue: context.totalInputValue,
          totalOutputValue: context.totalOutputValue,
          difference: context.totalOutputValue - context.totalInputValue
        }
      };
    }

    return null;
  }

  private async validateUTXOs(block: Block, context: BlockValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const tx of block.transactions) {
      for (const input of tx.inputs) {
        const utxoKey = `${input.txId}:${input.index}`;
        const utxo = context.existingUTXOs.get(utxoKey);

        // Check if UTXO exists
        if (!utxo) {
          errors.push({
            type: 'UTXO_VALIDATION',
            message: `Referenced UTXO not found: ${input.txId}:${input.index}`,
            details: {
              txId: input.txId,
              index: input.index,
              referencingTransaction: tx.id
            }
          });
          continue;
        }

        // Check if UTXO is already spent
        if (utxo.spent) {
          errors.push({
            type: 'UTXO_VALIDATION',
            message: `UTXO already spent: ${input.txId}:${input.index}`,
            details: {
              txId: input.txId,
              index: input.index,
              spentInTx: utxo.spent_in_tx,
              referencingTransaction: tx.id
            }
          });
        }
      }

      // Validate transaction structure
      const txError = this.validateTransaction(tx);
      if (txError) {
        errors.push(txError);
      }
    }

    return errors;
  }

  private validateTransaction(tx: Transaction): ValidationError | null {
    // Validate transaction ID format
    if (!tx.id || typeof tx.id !== 'string' || tx.id.length === 0) {
      return {
        type: 'UTXO_VALIDATION',
        message: `Invalid transaction ID: ${tx.id}`,
        details: { transactionId: tx.id }
      };
    }

    // Validate inputs structure
    for (let i = 0; i < tx.inputs.length; i++) {
      const input = tx.inputs[i];
      if (!input.txId || typeof input.txId !== 'string' || input.txId.length === 0) {
        return {
          type: 'UTXO_VALIDATION',
          message: `Invalid input txId at index ${i}`,
          details: { transactionId: tx.id, inputIndex: i, input }
        };
      }

      if (typeof input.index !== 'number' || input.index < 0) {
        return {
          type: 'UTXO_VALIDATION',
          message: `Invalid input index at input ${i}`,
          details: { transactionId: tx.id, inputIndex: i, input }
        };
      }
    }

    // Validate outputs structure
    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i];
      if (!output.address || typeof output.address !== 'string' || output.address.length === 0) {
        return {
          type: 'UTXO_VALIDATION',
          message: `Invalid output address at index ${i}`,
          details: { transactionId: tx.id, outputIndex: i, output }
        };
      }

      if (typeof output.value !== 'number' || output.value < 0) {
        return {
          type: 'UTXO_VALIDATION',
          message: `Invalid output value at index ${i}`,
          details: { transactionId: tx.id, outputIndex: i, output }
        };
      }
    }

    return null;
  }

  // Validate block structure before detailed validation
  validateBlockStructure(block: any): ValidationError | null {
    if (!block || typeof block !== 'object') {
      return {
        type: 'VALIDATION',
        message: 'Block must be an object',
        details: { received: typeof block }
      };
    }

    if (!block.id || typeof block.id !== 'string') {
      return {
        type: 'VALIDATION',
        message: 'Block must have a valid id',
        details: { id: block.id }
      };
    }

    if (typeof block.height !== 'number' || block.height < 1) {
      return {
        type: 'HEIGHT_VALIDATION',
        message: 'Block height must be a positive number',
        details: { height: block.height }
      };
    }

    if (!Array.isArray(block.transactions)) {
      return {
        type: 'VALIDATION',
        message: 'Block must have a transactions array',
        details: { transactions: block.transactions }
      };
    }

    // Validate each transaction structure
    for (let i = 0; i < block.transactions.length; i++) {
      const tx = block.transactions[i];
      if (!tx || typeof tx !== 'object') {
        return {
          type: 'VALIDATION',
          message: `Transaction at index ${i} must be an object`,
          details: { transactionIndex: i, transaction: tx }
        };
      }

      if (!Array.isArray(tx.inputs)) {
        return {
          type: 'VALIDATION',
          message: `Transaction at index ${i} must have an inputs array`,
          details: { transactionIndex: i, inputs: tx.inputs }
        };
      }

      if (!Array.isArray(tx.outputs)) {
        return {
          type: 'VALIDATION',
          message: `Transaction at index ${i} must have an outputs array`,
          details: { transactionIndex: i, outputs: tx.outputs }
        };
      }
    }

    return null;
  }
} 