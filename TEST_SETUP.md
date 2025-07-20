# Test Setup Guide

This project has been configured to run tests smoothly on any new computer with minimal setup.

## Quick Start (Recommended)

```bash
# Run the setup script
./setup-test.sh

# Run tests
bun test
```

## What the setup does

The test setup automatically tries different database options in order:

1. **Local PostgreSQL** (if you have PostgreSQL installed locally)
2. **Docker PostgreSQL** (if Docker is available)
3. **SQLite** (fallback - no setup required)

## Manual Setup

If you prefer to set up manually:

### 1. Install Bun (if not installed)
```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Install dependencies
```bash
bun install
```

### 3. Run tests
```bash
bun test
```

## Database Options

### Option 1: Local PostgreSQL (Fastest)
```bash
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Option 2: Docker PostgreSQL
```bash
# Install Docker Desktop or Docker Engine
# Tests will automatically use Docker containers
```

### Option 3: SQLite (No setup required)
- Works out of the box
- Uses in-memory database for tests
- No installation needed

## Available Commands

```bash
bun test          # Run tests once
bun test --watch  # Run tests in watch mode
```

The test setup will automatically detect which database is available and use the best option for your environment. 