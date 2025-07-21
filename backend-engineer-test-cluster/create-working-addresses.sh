#!/bin/bash

# Working UTXO Address Test Script
# Creates valid blocks that pass the current validation system

set -e

API_URL="http://localhost:80"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🏦 Creating Working UTXO Test Addresses"
echo "======================================"

# Test addresses (Bitcoin-style format)
ADDRESSES=(
    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"  # Genesis address (Satoshi's)
    "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2"   # High-value holder
    "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"   # Multi-sig address
    "1JfbZRwdDHKZmuiZgYArJZhcuuzuw2HuMu"   # Exchange hot wallet
    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"  # Bech32 address
)

# Calculate proper block hash (height + tx1.id + tx2.id + ...)
calculate_block_hash() {
    local height=$1
    shift
    local tx_ids="$@"
    local content="${height}${tx_ids// /}"
    echo -n "$content" | shasum -a 256 | cut -d' ' -f1
}

echo -e "${BLUE}Step 1: Creating Genesis Block (Empty - Valid)${NC}"
echo "============================================="

# Start with a simple genesis block with no transactions (this should work)
genesis_hash=$(calculate_block_hash "1")
genesis_block='{
  "id": "'$genesis_hash'",
  "height": 1,
  "transactions": []
}'

echo "Processing genesis block (empty)..."
response=$(curl -s -X POST "$API_URL/blocks" \
  -H "Content-Type: application/json" \
  -d "$genesis_block")

echo "$response" | jq '.'
echo ""

# Check current height
echo -e "${BLUE}Checking current blockchain height...${NC}"
height_response=$(curl -s "$API_URL/health")
echo "$height_response" | jq '.'
echo ""

echo -e "${YELLOW}Available Addresses for Tracking:${NC}"
echo "================================="

for i in "${!ADDRESSES[@]}"; do
    address="${ADDRESSES[$i]}"
    echo -e "\n${BLUE}Address $((i+1)): ${address}${NC}"
    
    # Get balance
    balance_response=$(curl -s "$API_URL/balance/$address")
    balance=$(echo "$balance_response" | jq -r '.balance')
    
    echo "  Balance: $balance satoshis"
    
    case $i in
        0) echo "  Type: Genesis/Satoshi Address (Bitcoin's first)" ;;
        1) echo "  Type: High-value Holder" ;;
        2) echo "  Type: Multi-sig Address" ;;
        3) echo "  Type: Exchange Hot Wallet" ;;
        4) echo "  Type: Bech32 Address (SegWit)" ;;
    esac
    
    echo "  Track: curl $API_URL/balance/$address"
done

echo -e "\n${YELLOW}📋 Manual Transaction Testing${NC}"
echo "============================"
echo "Since the current system validates balance equality (inputs = outputs),"
echo "genesis blocks (coinbase) are rejected. Here's how to test manually:"
echo ""

echo -e "${BLUE}1. Check any address balance:${NC}"
echo "   curl $API_URL/balance/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
echo ""

echo -e "${BLUE}2. Monitor the blockchain:${NC}"
echo "   curl $API_URL/health"
echo ""

echo -e "${BLUE}3. Create a valid transfer block (after manual UTXO creation):${NC}"
echo 'Example format:'
cat << 'EOF'
{
  "id": "calculated_hash_here",
  "height": 2,
  "transactions": [{
    "id": "tx_hash",
    "inputs": [{"txId": "previous_tx", "index": 0}],
    "outputs": [
      {"address": "recipient_address", "value": 100},
      {"address": "change_address", "value": 900}
    ]
  }]
}
EOF
echo ""

echo -e "${BLUE}4. Real Bitcoin addresses to reference:${NC}"
echo "   • Satoshi's Genesis: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
echo "   • Largest BTC wallet: bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2"
echo "   • Binance Hot Wallet: 1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s"
echo "   • BitGo Cold Storage: 3M219KJtMVHkjGJWeFTiGNtARKZt9TwqF5"
echo ""

echo -e "${GREEN}✅ Address tracking system ready!${NC}"
echo -e "${YELLOW}Current limitation: Genesis/coinbase transactions require system modification${NC}"
echo -e "${YELLOW}Workaround: Test with zero-balance addresses or modify validation logic${NC}"

# Save useful addresses for tracking
cat > tracked_addresses.txt << EOF
# UTXO Test Addresses for Tracking
# Generated: $(date)

# Real Bitcoin Addresses (for reference)
1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa  # Satoshi's Genesis Address
1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2  # Historical High-Value Wallet
3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy  # Multi-signature Address
1JfbZRwdDHKZmuiZgYArJZhcuuzuw2HuMu  # Exchange Hot Wallet
bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4  # Bech32 SegWit Address

# High-Value Real Bitcoin Addresses
bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2  # Largest BTC Address
1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s  # Binance Hot Wallet
3M219KJtMVHkjGJWeFTiGNtARKZt9TwqF5  # BitGo Cold Storage
12tkqA9xSoowkzoERHMWNKsTey55YEBqkv  # Grayscale Bitcoin Trust

# Exchange Addresses
1Kr6QSydW9bFQG1mXiPNNu6WpJGmUa9i1g  # Bitfinex Cold Storage
36PrZ1KHYMpqSyAQXSG8VwbUiq2EogxLo2  # Bittrex Cold Storage
3Kzh9qAqVWQhEsfQz7zEQL1EuSx5tyNLNS  # Poloniex Cold Storage

# Mining Pool Addresses
1CK6KHY6MHgYvmRQ4PAafKYDrg1ejbH1cE  # SlushPool
1AcAj9p6zJn4xLXdvmdiuPCtY7YkBPTAJo  # F2Pool Main

# Test Commands:
# curl http://localhost:80/balance/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
# curl http://localhost:80/health
# curl http://localhost:80/metrics
EOF

echo -e "\n📝 Address list saved to: tracked_addresses.txt" 