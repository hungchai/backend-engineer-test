import Fastify from 'fastify';
import config, { configManager } from './config.js';
import { UTXOIndexer } from './indexer.js';
import { createRedisClient } from './redis.js';
import type {
  APIError,
  BalanceResponse,
  Block
} from './types.js';

const fastify = Fastify({
  logger: {
    level: config.logging.level,
    transport: config.logging.prettyPrint ? {
      target: 'pino-pretty'
    } : undefined
  },
  // Optimize for performance
  caseSensitive: true,
  ignoreTrailingSlash: true
});

let indexer: UTXOIndexer;

// POST /blocks - Process a new block
fastify.post<{ Body: Block }>('/blocks', async (request, reply) => {
  try {
    if (!request.body) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request body is required'
      } as APIError);
    }

    const result = await indexer.processBlock(request.body);

    return reply.status(200).send({
      message: 'Block processed successfully',
      result
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Determine appropriate status code based on error type
    let statusCode = 500;
    if (errorMessage.includes('validation failed') ||
      errorMessage.includes('Invalid') ||
      errorMessage.includes('structure')) {
      statusCode = 400;
    }

    return reply.status(statusCode).send({
      statusCode,
      error: statusCode === 400 ? 'Bad Request' : 'Internal Server Error',
      message: errorMessage
    } as APIError);
  }
});

// GET /balance/:address - Get address balance
fastify.get<{ Params: { address: string } }>('/balance/:address', async (request, reply) => {
  try {
    const { address } = request.params;

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Address parameter is required and must be a non-empty string'
      } as APIError);
    }

    const balance = await indexer.getBalance(address.trim());

    return reply.status(200).send({
      address: address.trim(),
      balance
    } as BalanceResponse);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: errorMessage
    } as APIError);
  }
});

// POST /rollback?height=number - Rollback to specified height
fastify.post<{ Querystring: { height: string } }>('/rollback', async (request, reply) => {
  try {
    const heightStr = request.query.height;

    if (!heightStr) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Height query parameter is required'
      } as APIError);
    }

    const height = parseInt(heightStr, 10);
    if (isNaN(height)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Height must be a valid number'
      } as APIError);
    }

    const result = await indexer.rollback(height);

    return reply.status(200).send({
      message: 'Rollback completed successfully',
      result
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes('Target height') ||
      errorMessage.includes('cannot be negative') ||
      errorMessage.includes('exceeds maximum')) {
      statusCode = 400;
    }

    return reply.status(statusCode).send({
      statusCode,
      error: statusCode === 400 ? 'Bad Request' : 'Internal Server Error',
      message: errorMessage
    } as APIError);
  }
});

// GET /health - Health check endpoint
fastify.get('/health', async (request, reply) => {
  try {
    const health = await indexer.healthCheck();

    return reply.status(health.status === 'healthy' ? 200 : 503).send(health);
  } catch (error) {
    return reply.status(503).send({
      status: 'unhealthy',
      database: false,
      currentHeight: 0,
      errors: [error instanceof Error ? error.message : 'Health check failed']
    });
  }
});

// GET /metrics - Performance metrics (optional)
fastify.get('/metrics', async (request, reply) => {
  try {
    if (!config.enableMetrics) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Metrics endpoint is disabled'
      } as APIError);
    }

    const metrics = await indexer.getMetrics();
    const currentHeight = await indexer.getCurrentHeight();

    return reply.status(200).send({
      currentHeight,
      processing: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get metrics'
    } as APIError);
  }
});

// GET /config - Show current configuration (development/debugging)
fastify.get('/config', async (request, reply) => {
  if (configManager.getEnvironment() === 'production') {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Configuration endpoint not available in production'
    } as APIError);
  }

  return reply.status(200).send({
    environment: configManager.getEnvironment(),
    config: {
      server: config.server,
      database: {
        ...config.database,
        connectionString: config.database.connectionString.replace(/\/\/.*:.*@/, '//***:***@')
      },
      cache: config.cache,
      indexer: {
        maxRollbackDepth: config.maxRollbackDepth,
        batchSize: config.batchSize,
        enableMetrics: config.enableMetrics
      },
      logging: config.logging
    }
  });
});

// GET / - Basic API info
fastify.get('/', async (request, reply) => {
  const currentHeight = await indexer.getCurrentHeight();

  return {
    name: 'UTXO Blockchain Indexer',
    version: '1.0.0',
    status: 'running',
    environment: configManager.getEnvironment(),
    currentHeight,
    endpoints: {
      'POST /blocks': 'Process a new block',
      'GET /balance/:address': 'Get address balance',
      'POST /rollback?height=number': 'Rollback to specified height',
      'GET /health': 'Health check',
      'GET /metrics': 'Performance metrics',
      'GET /config': 'Current configuration (non-production only)'
    }
  };
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  return reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  } as APIError);
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await indexer.close();
    await fastify.close();
    process.exit(0);
  } catch (error) {
    fastify.log.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Bootstrap function
async function bootstrap() {
  try {
    // Validate configuration
    const configErrors = configManager.validate();
    if (configErrors.length > 0) {
      fastify.log.error('Configuration validation failed:');
      configErrors.forEach(error => fastify.log.error(`  - ${error}`));
      process.exit(1);
    }

    fastify.log.info(`Starting UTXO Blockchain Indexer in ${configManager.getEnvironment()} mode...`);
    fastify.log.info(`Server will listen on ${config.server.host}:${config.server.port}`);

    // Create Redis client if cache is enabled
    const redis = config.cache.enabled ? createRedisClient(config.redis.url) : undefined;

    // Initialize indexer
    indexer = new UTXOIndexer(config, redis);
    await indexer.initialize();

    fastify.log.info('Database initialized successfully');

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: config.server.host
    });

    fastify.log.info(`UTXO Blockchain Indexer is running on ${config.server.host}:${config.server.port}`);

  } catch (error) {
    fastify.log.error('Failed to start server:', error);
    console.error('Full error details:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

// Start the application
bootstrap();