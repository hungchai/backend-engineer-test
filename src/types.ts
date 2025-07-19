// Core types for UTXO Blockchain Indexer
// Optimized for high performance and low GC pressure

export interface Output {
  address: string;
  value: number;
}

export interface Input {
  txId: string;
  index: number;
}

export interface Transaction {
  id: string;
  inputs: Input[];
  outputs: Output[];
}

export interface Block {
  id: string;
  height: number;
  transactions: Transaction[];
}

// Database entity types
export interface DBBlock {
  id: string;
  height: bigint;
  created_at: Date;
}

export interface DBTransaction {
  id: string;
  block_id: string;
  block_height: bigint;
}

export interface DBUTXO {
  tx_id: string;
  output_index: number;
  address: string;
  value: bigint;
  spent: boolean;
  spent_in_tx: string | null;
  block_height: bigint;
}

export interface DBAddressBalance {
  address: string;
  balance: bigint;
  last_updated_height: bigint;
}

// API Response types
export interface BalanceResponse {
  address: string;
  balance: number;
}

export interface BlockProcessingResult {
  blockId: string;
  height: number;
  transactionsProcessed: number;
  addressesAffected: number;
}

export interface RollbackResult {
  targetHeight: number;
  blocksRemoved: number;
  transactionsRemoved: number;
  addressesAffected: number;
}

// Error types
export interface ValidationError {
  type: 'HEIGHT_VALIDATION' | 'HASH_VALIDATION' | 'BALANCE_VALIDATION' | 'UTXO_VALIDATION' | 'VALIDATION';
  message: string;
  details?: any;
}

export interface APIError {
  statusCode: number;
  message: string;
  error?: string;
  validation?: ValidationError;
}

// Validation context for processing
export interface BlockValidationContext {
  currentHeight: number;
  existingUTXOs: Map<string, DBUTXO>; // key: txId:index
  totalInputValue: number;
  totalOutputValue: number;
}

// Performance monitoring types
export interface ProcessingMetrics {
  blockProcessingTime: number;
  validationTime: number;
  dbWriteTime: number;
  cacheUpdateTime: number;
  utxosProcessed: number;
  balancesUpdated: number;
}

// Configuration types
export interface ServerConfig {
  port: number;
  host: string;
}

export interface DatabaseConfig {
  connectionString: string;
  poolSize: number;
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
}

export interface CacheConfig {
  enabled: boolean;
  redisUrl?: string;
  ttlSeconds: number;
  maxMemoryMB: number;
}

export interface LoggingConfig {
  level: string;
  prettyPrint: boolean;
}

export interface IndexerConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  cache: CacheConfig;
  maxRollbackDepth: number;
  batchSize: number;
  enableMetrics: boolean;
  logging: LoggingConfig;
} 