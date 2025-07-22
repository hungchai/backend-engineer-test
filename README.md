# UTXO Blockchain Indexer

## Overview
A high-performance, stateless blockchain indexer for tracking UTXO (Unspent Transaction Output) balances. Designed for reliability, low latency, and easy examination.

## Quick Start
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd backend-engineer-test
   ```
2. **Start only database and redis services:**
   ```bash
   docker-compose up -d db redis
   ```
3. **Run the app:**
   ```bash
   bun run src/index.ts
   # or
   bun start
   ```
4. **Check API health:**
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

## Code Tour
- **src/indexer.ts**: Main UTXOIndexer class. Handles block processing, validation, balance queries, and rollback. Injects a Database and uses Redis for distributed locking.
- **src/database.ts**: Database abstraction. Manages all PostgreSQL operations, UTXO state, and soft deletes (via `voided` column). Uses Redis for address-level distributed locks.
- **src/redis.ts**: Redis helpers. Provides distributed lock (`withAddressLock`), cache helpers (`setCache`, `getCache`, `delCache`), and a Redis client factory.
- **spec/**: Test suite. Includes tests for all endpoints, validation, rollback, and distributed lock logic. Uses isolated Redis clients for lock tests.
- **config/**: All environment and service configuration.
- **docker-compose.yaml**: Local development and test orchestration for DB, Redis, and API.

## API Endpoints
| Method | Endpoint                | Description                              |
|--------|-------------------------|------------------------------------------|
| POST   | `/blocks`               | Process a new block                      |
| GET    | `/balance/:address`     | Get address balance                      |
| POST   | `/rollback?height=N`    | Rollback to specific height              |
| GET    | `/health`               | System health check                      |
| GET    | `/metrics`              | Performance metrics                      |
| DELETE | `/clear`                | **Development only:** Clear all data     |

## Development Database Reset
- **DELETE /clear**: Resets all blocks, transactions, UTXOs, and address balances. Only available in development mode. Useful for testing and resetting state between test runs.
- Example:
  ```bash
  curl -X DELETE http://localhost:3000/clear
  ```
- This endpoint is used at the start of `api-test.http` to ensure a clean state for tests.

## Block Hash Calculation for Tests
- Block hash is calculated as: `SHA256(height + tx1.id + tx2.id + ...)`
- For example, for a genesis block with height 1 and transaction id "tx1":
  ```js
  // Node.js
  require('crypto').createHash('sha256').update('1tx1').digest('hex')
  // => d1582b9e2cac15e170c39ef2e85855ffd7e6a820550a8ca16a2f016d366503dc
  ```
- All block hashes in `api-test.http` are precomputed using this method.

## API Test Workflow
- Use the [api-test.http](./api-test.http) file with the REST Client extension or similar tools.
- The first request is `DELETE /clear` to reset the database.
- All subsequent requests assume a clean state and use correct block hashes.
- Example workflow:
  1. `DELETE /clear` (reset DB)
  2. `POST /blocks` (add genesis block)
  3. `GET /balance/addr1` (verify balance)
  4. Continue with other tests...

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
4. **Run the app for manual testing:**
   ```bash
   bun run src/index.ts
   # or
   bun start
   ```

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