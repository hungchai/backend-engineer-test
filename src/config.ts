import * as fs from 'fs';
import * as path from 'path';
import type { IndexerConfig } from './types.js';

interface ConfigFile {
  server?: {
    port?: number;
    host?: string;
  };
  database?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    poolSize?: number;
    maxConnections?: number;
    idleTimeoutMs?: number;
    connectionTimeoutMs?: number;
  };
  cache?: {
    enabled?: boolean;
    ttlSeconds?: number;
    maxMemoryMB?: number;
    redisUrl?: string;
  };
  indexer?: {
    maxRollbackDepth?: number;
    batchSize?: number;
    enableMetrics?: boolean;
  };
  logging?: {
    level?: string;
    prettyPrint?: boolean;
  };
  redis?: {
    url?: string;
  };
}

class ConfigurationManager {
  private config: IndexerConfig;
  private environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): IndexerConfig {
    const defaultConfig = this.loadConfigFile('application.json');
    const envConfig = this.loadConfigFile(`application-${this.environment}.json`);

    // Merge configurations: default < environment-specific < environment variables
    const merged = this.deepMerge(defaultConfig, envConfig);
    return this.applyEnvironmentVariables(merged);
  }

  private loadConfigFile(filename: string): ConfigFile {
    const configPath = path.join(process.cwd(), 'config', filename);

    if (!fs.existsSync(configPath)) {
      console.warn(`Configuration file not found: ${configPath}`);
      return {};
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading configuration file ${filename}:`, error);
      return {};
    }
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  private applyEnvironmentVariables(config: ConfigFile): IndexerConfig {
    // Build database connection string
    const dbConfig = config.database || {};
    const redisConfig = config.redis || {};
    const connectionString = process.env.DATABASE_URL ||
      `postgresql://${dbConfig.username || 'postgres'}:${dbConfig.password || 'password'}@${dbConfig.host || 'localhost'}:${dbConfig.port || 5432}/${dbConfig.database || 'utxo_indexer'}`;

    return {
      server: {
        port: parseInt(process.env.PORT || '') || config.server?.port || 3000,
        host: process.env.HOST || config.server?.host || '0.0.0.0'
      },
      database: {
        connectionString,
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '') || dbConfig.maxConnections || 20,
        idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '') || dbConfig.idleTimeoutMs || 30000,
        connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT || '') || dbConfig.connectionTimeoutMs || 5000
      },
      redis: {
        url: process.env.REDIS_URL || redisConfig.url || 'redis://localhost:6379'
      },
      cache: {
        enabled: process.env.CACHE_ENABLED === 'true' || config.cache?.enabled || false,
        ttlSeconds: parseInt(process.env.CACHE_TTL || '') || config.cache?.ttlSeconds || 300,
        maxMemoryMB: parseInt(process.env.CACHE_MAX_MEMORY || '') || config.cache?.maxMemoryMB || 100,
        redisUrl: process.env.REDIS_URL || config.cache?.redisUrl
      },
      maxRollbackDepth: parseInt(process.env.MAX_ROLLBACK_DEPTH || '') || config.indexer?.maxRollbackDepth || 2000,
      batchSize: parseInt(process.env.BATCH_SIZE || '') || config.indexer?.batchSize || 1000,
      enableMetrics: process.env.ENABLE_METRICS === 'true' || config.indexer?.enableMetrics || true,
      logging: {
        level: process.env.LOG_LEVEL || config.logging?.level || 'info',
        prettyPrint: process.env.LOG_PRETTY === 'true' || config.logging?.prettyPrint || true
      }
    };
  }

  public getConfig(): IndexerConfig {
    return this.config;
  }

  public getEnvironment(): string {
    return this.environment;
  }

  public reload(): void {
    this.config = this.loadConfiguration();
  }

  // Validation method
  public validate(): string[] {
    const errors: string[] = [];

    if (!this.config.database.connectionString) {
      errors.push('Database connection string is required');
    }

    if (this.config.database.maxConnections <= 0) {
      errors.push('Database max connections must be greater than 0');
    }

    if (this.config.maxRollbackDepth <= 0) {
      errors.push('Max rollback depth must be greater than 0');
    }

    if (this.config.batchSize <= 0) {
      errors.push('Batch size must be greater than 0');
    }

    return errors;
  }
}

// Singleton instance
const configManager = new ConfigurationManager();

export { ConfigurationManager, configManager };
export default configManager.getConfig(); 