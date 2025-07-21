# UTXO Blockchain Indexer

## Overview
A high-performance, stateless blockchain indexer for tracking UTXO (Unspent Transaction Output) balances. Designed for reliability, low latency, and easy examination.

## Quick Start
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd backend-engineer-test
   ```
2. **Start services (Docker recommended):**
   ```bash
   docker-compose up -d --build
   ```
3. **Check API health:**
   ```bash
   curl http://localhost:3000/health
   ```

## Configuration
- All configuration files are in the `config/` directory.
- Main settings:
  - `application.json` (base)
  - `application-development.json`, `application-production.json`, `application-test.json` (overrides)
- Key blocks:
  - `database`: PostgreSQL connection
  - `redis`: Redis connection (used for cache and distributed locks)
  - `cache`: Cache settings (TTL, memory)

## Code Structure & Explanations
- **src/indexer.ts**: Main UTXOIndexer class. Handles block processing, validation, balance queries, and rollback. Injects a Database and uses Redis for distributed locking.
- **src/database.ts**: Database abstraction. Manages all PostgreSQL operations, UTXO state, and soft deletes (via `voided` column). Uses Redis for address-level distributed locks.
- **src/redis.ts**: Redis helpers. Provides distributed lock (`withAddressLock`), cache helpers (`setCache`, `getCache`, `delCache`), and a Redis client factory.
- **spec/**: Test suite. Includes tests for all endpoints, validation, rollback, and distributed lock logic. Uses isolated Redis clients for lock tests.

## API Endpoints
| Method | Endpoint                | Description                  |
|--------|-------------------------|------------------------------|
| POST   | `/blocks`               | Process a new block          |
| GET    | `/balance/:address`     | Get address balance          |
| POST   | `/rollback?height=N`    | Rollback to specific height  |
| GET    | `/health`               | System health check          |
| GET    | `/metrics`              | Performance metrics          |

## Testing
1. **Start dependencies (if not running):**
   ```bash
   docker-compose up -d db redis
   ```
2. **Run all tests:**
   ```bash
   bun test
   ```
3. **Run tests in watch mode:**
   ```bash
   bun test:watch
   ```

### Test Coverage
- **Block Processing:** Validates and processes blocks, including all schema and business rules.
- **Balance Queries:** Ensures correct balance calculation for any address.
- **Rollback:** Verifies rollback to a specific height and state restoration.
- **Validation:** Tests for invalid heights, hashes, and unbalanced transactions.
- **Distributed Lock:** Confirms Redis-based address-level locking works and prevents race conditions.
- **Test Isolation:** Distributed lock tests use a dedicated Redis client for clean teardown.

## Mapping to Challenge Requirements (from Question_Readme.md)
- **POST /blocks**: Fully implemented with all required validations (height, input/output sum, block hash).
- **GET /balance/:address**: Returns current balance for any address.
- **POST /rollback?height=N**: Rolls back state to the given height, recalculates balances.
- **Tests**: All operations above are covered, including error and edge cases. Distributed lock and cache logic are also tested.
- **Error Handling**: All endpoints return appropriate status codes and messages for invalid input or state.

## Design Decisions
### Redis-based Caching & Locking
- Redis is used for distributed caching and address-level distributed locks.
- Cache helpers in `src/redis.ts`: `setCache`, `getCache`, `delCache`.
- Lock helpers: `withAddressLock` ensures safe concurrent balance updates.

### Soft Deletes
- Instead of deleting records, a `voided` column marks rollbacked data for auditability and safety.

### Test Isolation
- Distributed lock tests use a separate Redis client to avoid teardown conflicts and ensure robust, isolated test runs.

## Contact
For questions or support, please contact the project maintainer. 