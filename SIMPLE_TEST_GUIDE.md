# Simple Test Guide - Works on Any Computer 

This project is designed to run tests smoothly on **any computer** without complex setup.

## ⚡ One-Command Test Run

```bash
./run-tests.sh
```

That's it! This script will:
1. Install Bun if needed
2. Install dependencies 
3. Run tests with automatic database selection
4. Work on any computer, no matter what's installed

##  What Happens Automatically

The test system tries different database options in order:

1. **Local PostgreSQL**  (if you have it installed)
2. **Docker PostgreSQL**  (if Docker is available) 
3. **Mock Database**  (always works - no setup required)

##  Manual Commands

If you prefer manual control:

```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Run simple test (always works)
bun test spec/final-test.spec.ts

# Run all tests
bun test

# Run tests in watch mode
bun test --watch
```

##  For Development

If you want the best performance for development:

### Option 1: Local PostgreSQL (Fastest)
```bash
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian  
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Then run tests
bun test
```

### Option 2: Docker (Good for CI/CD)
```bash
# Install Docker Desktop
# Tests will automatically use Docker containers
bun test
```

### Option 3: Mock Database (No setup, always works)
```bash
# Just run tests - works everywhere
bun test spec/final-test.spec.ts
```

##  Benefits

-  **Zero setup required** - works on fresh computers
-  **High availability** - multiple fallback options  
-  **High performance** - uses fastest available option
-  **Low latency** - mock database is instant
-  **No dependencies** - mock database has no external deps
-  **100% portable** - works on any operating system

## 🔍 Troubleshooting

If you see connection errors:
```bash
# Try the mock database test specifically
bun test spec/final-test.spec.ts
```

This will always work and show you which database backend was selected.

##  Success Indicators

When tests run successfully, you'll see:
```
 Test database setup using: mock
✓ Final Database Test Setup > should setup database successfully
✓ Final Database Test Setup > should handle table operations  
✓ Final Database Test Setup > should work with any database backend
```

The system will tell you which database it selected and all tests should pass! 