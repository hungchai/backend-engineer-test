# UTXO Blockchain Indexer

## Overview
A high-performance, stateless blockchain indexer for tracking UTXO (Unspent Transaction Output) balances. Designed for reliability, low latency, and easy examination.

## Quick Start
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd backend-engineer-test
   ```

2. **Start database and Redis services:**
   ```bash
   docker-compose up -d db redis
   ```

3. **Important: Clear any conflicting environment variables:**
   ```bash
   unset DATABASE_URL  # If set, this overrides config files
   ```

4. **Run the application:**
   ```bash
   bun run src/index.ts
   # or
   bun start
   ```

5. **Verify the service is running:**
   ```bash
   curl http://localhost:3000/health
   # Expected: {"status":"healthy","database":true,"currentHeight":0}
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

**Note:** Environment variables override configuration files. If you have `DATABASE_URL` set, it will override the database configuration from JSON files.

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
| GET    | `/`                     | API information and available endpoints  |
| GET    | `/health`               | System health check                      |
| GET    | `/metrics`              | Performance metrics                      |
| POST   | `/blocks`               | Process a new block                      |
| GET    | `/balance/:address`     | Get address balance                      |
| POST   | `/rollback?height=N`    | Rollback to specific height              |
| DELETE | `/clear`                | **Development only:** Clear all data     |

## Development Database Reset
- **DELETE /clear**: Resets all blocks, transactions, UTXOs, and address balances. Only available in development mode. Useful for testing and resetting state between test runs.
- Example:
  ```bash
  curl -X DELETE http://localhost:3000/clear
  ```
- Returns count of removed records:
  ```json
  {
    "message": "Database cleared successfully",
    "result": {
      "blocksRemoved": 3,
      "transactionsRemoved": 3,
      "utxosRemoved": 6,
      "addressesRemoved": 6
    }
  }
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

## API Test Results
All API tests pass successfully. Here's a summary of the test workflow:

### Successful Test Flow:
1. **Database Clear** ✅
   ```bash
   DELETE /clear
   # Returns: Database cleared successfully (0 records initially)
   ```

2. **Basic Endpoints** ✅
   ```bash
   GET /          # API info with available endpoints
   GET /health    # {"status":"healthy","database":true,"currentHeight":0}
   GET /metrics   # Performance metrics with zero initial values
   ```

3. **Block Processing** ✅
   ```bash
   POST /blocks   # Genesis block (height 1)
   # Returns: Block processed successfully, 1 transaction, 1 address affected
   
   GET /balance/addr1  # Returns: {"address":"addr1","balance":10}
   ```

4. **Transfer Transaction** ✅
   ```bash
   POST /blocks   # Block 2: Transfer 10 from addr1 to addr2(4) + addr3(6)
   # Returns: Block processed successfully, 1 transaction, 2 addresses affected
   
   # Balances after transfer:
   # addr1: 0 (spent)
   # addr2: 4 (received)
   # addr3: 6 (received)
   ```

5. **Complex Transaction** ✅
   ```bash
   POST /blocks   # Block 3: Split addr3's 6 coins to addr4(2) + addr5(2) + addr6(2)
   # Returns: Block processed successfully, 1 transaction, 3 addresses affected
   
   # Final balances:
   # addr2: 4, addr4: 2, addr5: 2, addr6: 2
   # addr1, addr3: 0 (spent)
   ```

6. **Rollback Functionality** ✅
   ```bash
   POST /rollback?height=2
   # Returns: Rollback completed, 1 block removed, 1 transaction removed, 2 addresses affected
   
   # Balances after rollback:
   # addr2: 4, addr3: 6 (restored)
   # addr4, addr5, addr6: 0 (transactions voided)
   ```

7. **Error Handling** ✅
   ```bash
   # Invalid height: Returns 400 with validation errors
   # Non-existent address: Returns {"address":"...","balance":0}
   # Invalid rollback height: Returns 400 Bad Request
   # 404 endpoints: Returns proper 404 with message
   ```

### Final State:
- **Health Check**: `{"status":"healthy","database":true,"currentHeight":2}`
- **Total Runtime**: All tests complete in ~2-3 seconds
- **Error Handling**: All edge cases properly handled with appropriate HTTP status codes

## API Test Workflow
- Use the [api-test.http](./api-test.http) file with the REST Client extension or similar tools.
- The first request is `DELETE /clear` to reset the database.
- All subsequent requests assume a clean state and use correct block hashes.
- Example workflow:
  1. `DELETE /clear` (reset DB)
  2. `POST /blocks` (add genesis block)
  3. `GET /balance/addr1` (verify balance)
  4. Continue with transfer and rollback tests...

## Testing

### Automated Tests
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

### Manual API Testing
1. **Start the application:**
   ```bash
   docker-compose up -d db redis
   unset DATABASE_URL
   bun run src/index.ts
   ```

2. **Run the API test suite:**
   - Open `api-test.http` in VS Code with REST Client extension
   - Click "Send Request" on each test, starting with `DELETE /clear`
   - All tests should pass with expected responses

3. **Quick manual verification:**
   ```bash
   # Health check
   curl http://localhost:3000/health
   
   # Clear database
   curl -X DELETE http://localhost:3000/clear
   
   # Process a block
   curl -X POST http://localhost:3000/blocks \
     -H "Content-Type: application/json" \
     -d '{"id":"d1582b9e2cac15e170c39ef2e85855ffd7e6a820550a8ca16a2f016d366503dc","height":1,"transactions":[{"id":"tx1","inputs":[],"outputs":[{"address":"addr1","value":10}]}]}'
   
   # Check balance
   curl http://localhost:3000/balance/addr1
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

## Troubleshooting

### Common Issues:
1. **Database connection failed**: 
   - Ensure PostgreSQL is running: `docker-compose up -d db`
   - Check for conflicting `DATABASE_URL` environment variable: `unset DATABASE_URL`

2. **Service won't start**:
   - Verify dependencies: `docker-compose up -d db redis`
   - Check port 3000 isn't in use: `lsof -i :3000`

3. **Tests failing**:
   - Restart services: `docker-compose down && docker-compose up -d db redis`
   - Clear any cached data: `curl -X DELETE http://localhost:3000/clear`

## Contact
For questions or support, please contact the project maintainer. 