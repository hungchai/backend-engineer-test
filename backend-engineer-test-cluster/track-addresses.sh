#!/bin/bash

# UTXO Address Tracking Script
# Real-time monitoring of Bitcoin addresses in the UTXO indexer

API_URL="http://localhost:80"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Famous Bitcoin addresses to track
ADDRESSES=(
    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"   # Satoshi's Genesis Address
    "bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2"  # Largest BTC Address (200k+ BTC)
    "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s"   # Binance Hot Wallet
    "3M219KJtMVHkjGJWeFTiGNtARKZt9TwqF5"   # BitGo Cold Storage
    "12tkqA9xSoowkzoERHMWNKsTey55YEBqkv"   # Grayscale Bitcoin Trust
    "1Kr6QSydW9bFQG1mXiPNNu6WpJGmUa9i1g"   # Bitfinex Cold Storage
    "36PrZ1KHYMpqSyAQXSG8VwbUiq2EogxLo2"   # Bittrex Cold Storage
    "1CK6KHY6MHgYvmRQ4PAafKYDrg1ejbH1cE"   # SlushPool Mining
    "1AcAj9p6zJn4xLXdvmdiuPCtY7YkBPTAJo"   # F2Pool Mining
    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"  # Bech32 Example
)

DESCRIPTIONS=(
    "Satoshi's Genesis Address"
    "Largest Bitcoin Address"
    "Binance Hot Wallet"
    "BitGo Cold Storage"
    "Grayscale Bitcoin Trust"
    "Bitfinex Cold Storage"
    "Bittrex Cold Storage"
    "SlushPool Mining"
    "F2Pool Mining"
    "Bech32 SegWit Example"
)

print_header() {
    clear
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    🏦 UTXO Address Tracking Dashboard 🏦                    ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Get blockchain status
    local status_response=$(curl -s "$API_URL/health" 2>/dev/null)
    if [ $? -eq 0 ]; then
        local current_height=$(echo "$status_response" | jq -r '.currentHeight // 0')
        local db_status=$(echo "$status_response" | jq -r '.database // false')
        
        echo -e "${BLUE}📊 Blockchain Status:${NC} Height: ${GREEN}$current_height${NC} | Database: ${GREEN}$db_status${NC}"
        echo -e "${BLUE}🌐 API Endpoint:${NC} $API_URL"
        echo -e "${BLUE}⏰ Last Updated:${NC} $(date)"
    else
        echo -e "${RED}❌ API Connection Failed${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════${NC}"
}

track_single_address() {
    local address=$1
    local description=$2
    
    local response=$(curl -s "$API_URL/balance/$address" 2>/dev/null)
    if [ $? -eq 0 ]; then
        local balance=$(echo "$response" | jq -r '.balance // 0')
        local balance_btc=$(echo "scale=8; $balance / 100000000" | bc -l 2>/dev/null || echo "0.00000000")
        
        printf "%-35s %-30s %15s %15s\n" \
            "${address:0:35}" \
            "$description" \
            "$balance satoshis" \
            "$balance_btc BTC"
    else
        printf "%-35s %-30s %15s %15s\n" \
            "${address:0:35}" \
            "$description" \
            "ERROR" \
            "N/A"
    fi
}

track_all_addresses() {
    echo -e "${BLUE}📋 Address Balances:${NC}"
    echo -e "${YELLOW}─────────────────────────────────────────────────────────────────────────────────────────────────${NC}"
    printf "%-35s %-30s %15s %15s\n" "ADDRESS" "DESCRIPTION" "SATOSHIS" "BTC"
    echo -e "${YELLOW}─────────────────────────────────────────────────────────────────────────────────────────────────${NC}"
    
    for i in "${!ADDRESSES[@]}"; do
        track_single_address "${ADDRESSES[$i]}" "${DESCRIPTIONS[$i]}"
    done
    
    echo -e "${YELLOW}─────────────────────────────────────────────────────────────────────────────────────────────────${NC}"
}

show_menu() {
    echo ""
    echo -e "${CYAN}📋 Available Commands:${NC}"
    echo -e "${GREEN}1.${NC} Auto-refresh (10s intervals) - Press 'a'"
    echo -e "${GREEN}2.${NC} Refresh once - Press 'r'"
    echo -e "${GREEN}3.${NC} Track specific address - Press 't'"
    echo -e "${GREEN}4.${NC} View blockchain status - Press 's'"
    echo -e "${GREEN}5.${NC} View API metrics - Press 'm'"
    echo -e "${GREEN}6.${NC} Export tracking data - Press 'e'"
    echo -e "${GREEN}7.${NC} Quit - Press 'q'"
    echo ""
}

track_specific_address() {
    echo -e "${BLUE}Enter Bitcoin address to track:${NC}"
    read -r custom_address
    
    if [ -n "$custom_address" ]; then
        echo -e "\n${BLUE}Tracking address: ${custom_address}${NC}"
        track_single_address "$custom_address" "Custom Address"
        
        echo -e "\n${YELLOW}Real-time monitoring (press Ctrl+C to stop):${NC}"
        while true; do
            sleep 3
            local response=$(curl -s "$API_URL/balance/$custom_address" 2>/dev/null)
            if [ $? -eq 0 ]; then
                local balance=$(echo "$response" | jq -r '.balance // 0')
                echo "$(date +'%H:%M:%S') - Balance: $balance satoshis"
            else
                echo "$(date +'%H:%M:%S') - API Error"
            fi
        done
    fi
}

show_blockchain_status() {
    echo -e "\n${BLUE}🔗 Blockchain Status:${NC}"
    echo -e "${YELLOW}─────────────────────${NC}"
    
    local health_response=$(curl -s "$API_URL/health")
    echo "$health_response" | jq '.'
    
    echo -e "\n${BLUE}📊 API Metrics:${NC}"
    echo -e "${YELLOW}─────────────────${NC}"
    curl -s "$API_URL/metrics" | head -20
}

auto_refresh() {
    echo -e "${YELLOW}🔄 Auto-refresh enabled (every 10 seconds). Press Ctrl+C to stop.${NC}"
    echo ""
    
    while true; do
        print_header
        track_all_addresses
        echo -e "\n${CYAN}Next refresh in 10 seconds...${NC}"
        sleep 10
    done
}

export_data() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local filename="utxo_tracking_$timestamp.json"
    
    echo -e "${BLUE}📁 Exporting tracking data to: $filename${NC}"
    
    echo '{"addresses": [' > "$filename"
    
    for i in "${!ADDRESSES[@]}"; do
        local address="${ADDRESSES[$i]}"
        local description="${DESCRIPTIONS[$i]}"
        local response=$(curl -s "$API_URL/balance/$address" 2>/dev/null)
        
        if [ $i -gt 0 ]; then echo "," >> "$filename"; fi
        
        echo "  {" >> "$filename"
        echo "    \"address\": \"$address\"," >> "$filename"
        echo "    \"description\": \"$description\"," >> "$filename"
        echo "    \"balance\": $(echo "$response" | jq -r '.balance // 0')," >> "$filename"
        echo "    \"timestamp\": \"$(date -Iseconds)\"" >> "$filename"
        echo -n "  }" >> "$filename"
    done
    
    echo '' >> "$filename"
    echo ']}' >> "$filename"
    
    echo -e "${GREEN}✅ Data exported successfully!${NC}"
    echo -e "View with: ${YELLOW}cat $filename | jq '.'${NC}"
}

main() {
    # Check if API is available
    if ! curl -s "$API_URL/health" >/dev/null 2>&1; then
        echo -e "${RED}❌ Error: UTXO Indexer API not available at $API_URL${NC}"
        echo -e "${YELLOW}💡 Make sure the cluster is running: docker-compose -f docker-compose.simple.yml up -d${NC}"
        exit 1
    fi
    
    # Check for jq and bc
    if ! command -v jq >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Installing jq for JSON parsing...${NC}"
        if command -v brew >/dev/null 2>&1; then
            brew install jq
        else
            echo -e "${RED}Please install jq: https://jqlang.github.io/jq/download/${NC}"
            exit 1
        fi
    fi
    
    if ! command -v bc >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Installing bc for calculations...${NC}"
        if command -v brew >/dev/null 2>&1; then
            brew install bc
        fi
    fi
    
    # Initial display
    print_header
    track_all_addresses
    show_menu
    
    # Interactive mode
    while true; do
        echo -e "${CYAN}Enter command (a/r/t/s/m/e/q):${NC} "
        read -r -n 1 cmd
        echo ""
        
        case $cmd in
            a|A)
                auto_refresh
                ;;
            r|R)
                print_header
                track_all_addresses
                show_menu
                ;;
            t|T)
                track_specific_address
                print_header
                track_all_addresses
                show_menu
                ;;
            s|S)
                show_blockchain_status
                echo -e "\n${YELLOW}Press any key to continue...${NC}"
                read -r -n 1
                print_header
                track_all_addresses
                show_menu
                ;;
            m|M)
                echo -e "\n${BLUE}📊 API Metrics:${NC}"
                curl -s "$API_URL/metrics"
                echo -e "\n${YELLOW}Press any key to continue...${NC}"
                read -r -n 1
                print_header
                track_all_addresses
                show_menu
                ;;
            e|E)
                export_data
                echo -e "\n${YELLOW}Press any key to continue...${NC}"
                read -r -n 1
                print_header
                track_all_addresses
                show_menu
                ;;
            q|Q)
                echo -e "${GREEN}👋 Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid command. Try again.${NC}"
                ;;
        esac
    done
}

# Trap Ctrl+C for clean exit
trap 'echo -e "\n${GREEN}👋 Tracking stopped.${NC}"; exit 0' INT

# Run main function
main 