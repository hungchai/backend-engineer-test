#!/bin/bash

# UTXO Address Generation and Tracking Script
# Creates realistic blockchain addresses and transactions for testing

set -e

API_URL="http://localhost:80"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🏦 Creating Test UTXO Addresses and Transactions"
echo "==============================================="

# Test addresses (realistic format)
ADDRESSES=(
    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"  # Genesis address (Satoshi's first address)
    "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2"   # High-value holder
    "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"   # Multi-sig address
    "1JfbZRwdDHKZmuiZgYArJZhcuuzuw2HuMu"   # Exchange hot wallet
    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"  # Bech32 address
    "1MK7jjQ2raUQAeXou6Wb7oTDYYuT8Q2Sii"   # Mining pool address
    "1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX"   # DeFi protocol address
    "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s"   # Cold storage address
)

# Generate block hash for each block
generate_block_hash() {
    local height=$1
    local prev_hash=$2
    echo -n "${height}${prev_hash}" | shasum -a 256 | cut -d' ' -f1
}

# Generate transaction hash
generate_tx_hash() {
    local inputs="$1"
    local outputs="$2"
    local nonce="$3"
    echo -n "${inputs}${outputs}${nonce}" | shasum -a 256 | cut -d' ' -f1
}

echo -e "${BLUE}Step 1: Creating Genesis Block with Initial UTXOs${NC}"
echo "================================================"

# Genesis block - distributing initial coins to multiple addresses
genesis_tx_hash=$(generate_tx_hash "genesis" "initial_distribution" "1")
genesis_block_hash=$(generate_block_hash "1" "0000000000000000000000000000000000000000000000000000000000000000")

genesis_block='{
  "id": "'$genesis_block_hash'",
  "height": 1,
  "transactions": [{
    "id": "'$genesis_tx_hash'",
    "inputs": [],
    "outputs": [
      {"address": "'${ADDRESSES[0]}'", "value": 5000000},
      {"address": "'${ADDRESSES[1]}'", "value": 1000000},
      {"address": "'${ADDRESSES[2]}'", "value": 750000},
      {"address": "'${ADDRESSES[3]}'", "value": 500000},
      {"address": "'${ADDRESSES[4]}'", "value": 250000}
    ]
  }]
}'

echo "Processing genesis block..."
curl -s -X POST "$API_URL/blocks" \
  -H "Content-Type: application/json" \
  -d "$genesis_block" | jq '.'

sleep 2

echo -e "\n${BLUE}Step 2: Creating Transfer Transactions${NC}"
echo "====================================="

# Block 2: Large transfer and fee payment
tx2_hash=$(generate_tx_hash "${genesis_tx_hash}_0" "large_transfer" "2")
block2_hash=$(generate_block_hash "2" "$genesis_block_hash")

block2='{
  "id": "'$block2_hash'",
  "height": 2,
  "transactions": [{
    "id": "'$tx2_hash'",
    "inputs": [{"txId": "'$genesis_tx_hash'", "index": 0}],
    "outputs": [
      {"address": "'${ADDRESSES[5]}'", "value": 3000000},
      {"address": "'${ADDRESSES[6]}'", "value": 1500000},
      {"address": "'${ADDRESSES[0]}'", "value": 480000}
    ]
  }]
}'

echo "Processing block 2 (large transfers)..."
curl -s -X POST "$API_URL/blocks" \
  -H "Content-Type: application/json" \
  -d "$block2" | jq '.'

sleep 2

# Block 3: Multiple small transactions
tx3a_hash=$(generate_tx_hash "${genesis_tx_hash}_1" "small_tx_a" "3a")
tx3b_hash=$(generate_tx_hash "${genesis_tx_hash}_2" "small_tx_b" "3b")
block3_hash=$(generate_block_hash "3" "$block2_hash")

block3='{
  "id": "'$block3_hash'",
  "height": 3,
  "transactions": [
    {
      "id": "'$tx3a_hash'",
      "inputs": [{"txId": "'$genesis_tx_hash'", "index": 1}],
      "outputs": [
        {"address": "'${ADDRESSES[7]}'", "value": 600000},
        {"address": "'${ADDRESSES[1]}'", "value": 390000}
      ]
    },
    {
      "id": "'$tx3b_hash'",
      "inputs": [{"txId": "'$genesis_tx_hash'", "index": 2}],
      "outputs": [
        {"address": "'${ADDRESSES[4]}'", "value": 400000},
        {"address": "'${ADDRESSES[2]}'", "value": 340000}
      ]
    }
  ]
}'

echo "Processing block 3 (multiple transactions)..."
curl -s -X POST "$API_URL/blocks" \
  -H "Content-Type: application/json" \
  -d "$block3" | jq '.'

sleep 2

# Block 4: Cross-mixing transactions
tx4_hash=$(generate_tx_hash "${tx2_hash}_2,${tx3a_hash}_1" "mixing" "4")
block4_hash=$(generate_block_hash "4" "$block3_hash")

block4='{
  "id": "'$block4_hash'",
  "height": 4,
  "transactions": [{
    "id": "'$tx4_hash'",
    "inputs": [
      {"txId": "'$tx2_hash'", "index": 2},
      {"txId": "'$tx3a_hash'", "index": 1}
    ],
    "outputs": [
      {"address": "'${ADDRESSES[3]}'", "value": 400000},
      {"address": "'${ADDRESSES[6]}'", "value": 300000},
      {"address": "'${ADDRESSES[5]}'", "value": 150000}
    ]
  }]
}'

echo "Processing block 4 (transaction mixing)..."
curl -s -X POST "$API_URL/blocks" \
  -H "Content-Type: application/json" \
  -d "$block4" | jq '.'

sleep 2

echo -e "\n${GREEN}✅ Test blockchain created successfully!${NC}"
echo -e "\n${YELLOW}📊 UTXO Address Tracking Summary${NC}"
echo "================================="

# Display current balances for all addresses
for i in "${!ADDRESSES[@]}"; do
    address="${ADDRESSES[$i]}"
    echo -e "\n${BLUE}Address $((i+1)): ${address}${NC}"
    
    # Get balance
    balance_response=$(curl -s "$API_URL/balance/$address")
    balance=$(echo "$balance_response" | jq -r '.balance')
    
    echo "  Balance: $balance satoshis"
    
    # Add description based on address type
    case $i in
        0) echo "  Type: Genesis/Satoshi Address" ;;
        1) echo "  Type: High-value Holder" ;;
        2) echo "  Type: Multi-sig Address" ;;
        3) echo "  Type: Exchange Hot Wallet" ;;
        4) echo "  Type: Bech32 Address" ;;
        5) echo "  Type: Mining Pool Address" ;;
        6) echo "  Type: DeFi Protocol Address" ;;
        7) echo "  Type: Cold Storage Address" ;;
    esac
done

echo -e "\n${YELLOW}🔍 Tracking Commands${NC}"
echo "==================="
echo "Monitor any address balance:"
echo "  curl $API_URL/balance/<address>"
echo ""
echo "Check overall blockchain status:"
echo "  curl $API_URL/health"
echo ""
echo "View metrics:"
echo "  curl $API_URL/metrics"
echo ""

echo -e "${GREEN}🎯 Ready for UTXO tracking and analysis!${NC}"

# Save addresses to file for future reference
echo "# UTXO Test Addresses" > tracked_addresses.txt
echo "# Generated on: $(date)" >> tracked_addresses.txt
echo "" >> tracked_addresses.txt

for i in "${!ADDRESSES[@]}"; do
    address="${ADDRESSES[$i]}"
    case $i in
        0) type="Genesis/Satoshi Address" ;;
        1) type="High-value Holder" ;;
        2) type="Multi-sig Address" ;;
        3) type="Exchange Hot Wallet" ;;
        4) type="Bech32 Address" ;;
        5) type="Mining Pool Address" ;;
        6) type="DeFi Protocol Address" ;;
        7) type="Cold Storage Address" ;;
    esac
    
    echo "# $type" >> tracked_addresses.txt
    echo "$address" >> tracked_addresses.txt
    echo "" >> tracked_addresses.txt
done

echo -e "\n📝 Address list saved to: tracked_addresses.txt" 