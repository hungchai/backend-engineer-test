# Configuration System

This application uses a Spring Boot-inspired configuration system that allows for flexible, environment-specific configuration management.

## Configuration Files

Configuration files are located in the `config/` directory and use JSON format for easy parsing and validation.

### Configuration File Hierarchy

1. **`application.json`** - Default configuration applied to all environments
2. **`application-{environment}.json`** - Environment-specific overrides
3. **Environment Variables** - Highest priority overrides

### Available Configuration Files

- `application.json` - Base configuration with sensible defaults
- `application-development.json` - Development environment settings
- `application-production.json` - Production-optimized settings  
- `application-test.json` - Test environment configuration

## Setting the Environment

Set the `NODE_ENV` environment variable to control which configuration is loaded:

```bash
# Development (default)
NODE_ENV=development bun start

# Production
NODE_ENV=production bun start

# Test
NODE_ENV=test bun start
```

## Configuration Structure

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "utxo_indexer",
    "username": "postgres",
    "password": "password",
    "poolSize": 10,
    "maxConnections": 20,
    "idleTimeoutMs": 30000,
    "connectionTimeoutMs": 5000
  },
  "cache": {
    "enabled": false,
    "ttlSeconds": 300,
    "maxMemoryMB": 100,
    "redisUrl": "redis://localhost:6379"
  },
  "indexer": {
    "maxRollbackDepth": 2000,
    "batchSize": 1000,
    "enableMetrics": true
  },
  "logging": {
    "level": "info",
    "prettyPrint": true
  }
}
```

## Environment Variable Overrides

Environment variables take precedence over configuration files:

| Environment Variable | Configuration Path | Description |
|---------------------|-------------------|-------------|
| `PORT` | `server.port` | Server port |
| `HOST` | `server.host` | Server host |
| `DATABASE_URL` | `database.connectionString` | Full database connection string |
| `DB_POOL_SIZE` | `database.poolSize` | Database connection pool size |
| `DB_MAX_CONNECTIONS` | `database.maxConnections` | Maximum database connections |
| `DB_IDLE_TIMEOUT` | `database.idleTimeoutMs` | Database idle timeout |
| `DB_CONNECTION_TIMEOUT` | `database.connectionTimeoutMs` | Database connection timeout |
| `CACHE_ENABLED` | `cache.enabled` | Enable/disable caching |
| `CACHE_TTL` | `cache.ttlSeconds` | Cache TTL in seconds |
| `CACHE_MAX_MEMORY` | `cache.maxMemoryMB` | Cache memory limit |
| `REDIS_URL` | `cache.redisUrl` | Redis connection URL |
| `MAX_ROLLBACK_DEPTH` | `indexer.maxRollbackDepth` | Maximum rollback depth |
| `BATCH_SIZE` | `indexer.batchSize` | Processing batch size |
| `ENABLE_METRICS` | `indexer.enableMetrics` | Enable/disable metrics |
| `LOG_LEVEL` | `logging.level` | Log level (debug, info, warn, error) |
| `LOG_PRETTY` | `logging.prettyPrint` | Pretty print logs |

## Environment Examples

### Development
```bash
# Override database for local development
export DATABASE_URL="postgresql://dev:dev@localhost:5432/utxo_dev"
export LOG_LEVEL="debug"
bun dev
```

### Production
```bash
# Production environment with environment variables
export NODE_ENV="production"
export DATABASE_URL="postgresql://prod_user:secure_pass@db.example.com:5432/utxo_prod"
export CACHE_ENABLED="true"
export REDIS_URL="redis://cache.example.com:6379"
export LOG_LEVEL="warn"
bun start
```

### Docker
```dockerfile
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://user:pass@postgres:5432/utxo_indexer
ENV CACHE_ENABLED=true
ENV REDIS_URL=redis://redis:6379
```

## Configuration API

The application provides a configuration endpoint for development and debugging:

```bash
# View current configuration (non-production only)
GET /config
```

This endpoint shows:
- Current environment
- Merged configuration (with sensitive data masked)
- Configuration source hierarchy

## Benefits of This Approach

1. **Environment Separation**: Clear separation between dev, test, and production settings
2. **Override Hierarchy**: Configuration files → Environment-specific files → Environment variables
3. **Type Safety**: TypeScript interfaces ensure configuration validity
4. **Validation**: Built-in configuration validation with helpful error messages
5. **Security**: Sensitive data can be provided via environment variables
6. **Debugging**: Configuration endpoint helps debug configuration issues
7. **Spring Boot Familiarity**: Similar to Spring Boot's application.properties approach

## Configuration Best Practices

1. **Defaults in application.json**: Put sensible defaults that work for local development
2. **Environment-specific overrides**: Use environment files for environment-specific settings
3. **Secrets via environment variables**: Never commit secrets to configuration files
4. **Validate early**: Configuration is validated at startup
5. **Document changes**: Update this README when adding new configuration options

## Adding New Configuration

1. Update the TypeScript interfaces in `src/types.ts`
2. Add default values to `config/application.json`
3. Add environment-specific overrides as needed
4. Add environment variable mapping in `src/config.ts`
5. Update this documentation 