#!/bin/bash

echo "🚀 Setting up backend-engineer-test for smooth testing..."

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    source ~/.bashrc 2>/dev/null || source ~/.zshrc 2>/dev/null
fi

# Install dependencies
echo "Installing dependencies..."
bun install

echo "✅ Setup complete! You can now run tests with:"
echo "   bun test"
echo ""
echo "The test setup will automatically:"
echo "1. Try to use local PostgreSQL (if available)"
echo "2. Fall back to Docker PostgreSQL (if Docker is available)"
echo "3. Use SQLite as final fallback (no setup required)"
echo ""
echo "To run tests now:"
echo "   bun test" 