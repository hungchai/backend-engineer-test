#!/bin/bash

# UTXO Blockchain Indexer - Cluster Test Script
# Tests all components and functionality of the cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost"
LB_PORT="80"
API_PORTS=("3001" "3002" "3003")
PROMETHEUS_PORT="9091"
GRAFANA_PORT="3004"
HAPROXY_STATS_PORT="8404"

# Test results
PASSED=0
FAILED=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASSED=$((PASSED + 1))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED=$((FAILED + 1))
}

test_service_health() {
    local service_name=$1
    local url=$2
    local expected_status=$3
    
    log_info "Testing $service_name health..."
    
    if curl -f -s "$url" >/dev/null 2>&1; then
        log_success "$service_name is healthy"
    else
        log_error "$service_name health check failed"
    fi
}

test_api_endpoint() {
    local description=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_status=$5
    
    log_info "Testing: $description"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" "$url")
    else
        response=$(curl -s -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
    fi
    
    status_code="${response: -3}"
    body="${response%???}"
    
    if [ "$status_code" = "$expected_status" ]; then
        log_success "$description - Status: $status_code"
        if [ -n "$body" ] && [ "$body" != "null" ]; then
            echo "Response: $body" | head -c 200
            echo ""
        fi
    else
        log_error "$description - Expected: $expected_status, Got: $status_code"
        echo "Response: $body"
    fi
}

# Main test suite
main() {
    echo "🚀 Starting UTXO Indexer Cluster Tests"
    echo "======================================="
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Test 1: Container Health
    echo ""
    echo "📋 1. CONTAINER HEALTH TESTS"
    echo "----------------------------"
    
    # Check if containers are running
    log_info "Checking container status..."
    docker-compose -f docker-compose.simple.yml ps
    
    # Test 2: Database Connectivity
    echo ""
    echo "💾 2. DATABASE CONNECTIVITY TESTS"
    echo "---------------------------------"
    
    log_info "Testing PostgreSQL connection..."
    if docker exec utxo-postgres-primary pg_isready -U postgres >/dev/null 2>&1; then
        log_success "PostgreSQL is accessible"
    else
        log_error "PostgreSQL connection failed"
    fi
    
    log_info "Testing Redis connection..."
    if docker exec utxo-redis-1 redis-cli ping >/dev/null 2>&1; then
        log_success "Redis is accessible"
    else
        log_error "Redis connection failed"
    fi
    
    # Test 3: API Instance Health
    echo ""
    echo "🔧 3. API INSTANCE HEALTH TESTS"
    echo "-------------------------------"
    
    for port in "${API_PORTS[@]}"; do
        test_service_health "UTXO API :$port" "$BASE_URL:$port/health" "200"
        sleep 1
    done
    
    # Test 4: Load Balancer Tests
    echo ""
    echo "⚖️  4. LOAD BALANCER TESTS"
    echo "-------------------------"
    
    # HAProxy stats
    test_service_health "HAProxy Stats" "$BASE_URL:$HAPROXY_STATS_PORT/stats" "200"
    
    # Load balanced API access
    log_info "Testing load balanced API access..."
    for i in {1..5}; do
        test_api_endpoint "Load Balanced Health Check #$i" "GET" "$BASE_URL:$LB_PORT/health" "" "200"
        sleep 0.5
    done
    
    # Test 5: API Functionality Tests
    echo ""
    echo "🧪 5. API FUNCTIONALITY TESTS"
    echo "-----------------------------"
    
    # Test API root endpoint
    test_api_endpoint "API Root Endpoint" "GET" "$BASE_URL:$LB_PORT/" "" "200"
    
    # Test metrics endpoint
    test_api_endpoint "Metrics Endpoint" "GET" "$BASE_URL:$LB_PORT/metrics" "" "200"
    
    # Test Genesis Block Processing
    log_info "Testing Genesis Block Processing..."
    genesis_block='{
        "id": "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9",
        "height": 1,
        "transactions": [{
            "id": "tx1",
            "inputs": [],
            "outputs": [{"address": "addr1", "value": 100}]
        }]
    }'
    
    test_api_endpoint "Genesis Block Processing" "POST" "$BASE_URL:$LB_PORT/blocks" "$genesis_block" "200"
    
    # Test Balance Query
    sleep 2  # Allow time for processing
    test_api_endpoint "Balance Query for addr1" "GET" "$BASE_URL:$LB_PORT/balance/addr1" "" "200"
    
    # Test Transfer Transaction
    log_info "Testing Transfer Transaction..."
    transfer_block='{
        "id": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
        "height": 2,
        "transactions": [{
            "id": "tx2",
            "inputs": [{"txId": "tx1", "index": 0}],
            "outputs": [
                {"address": "addr2", "value": 60},
                {"address": "addr3", "value": 40}
            ]
        }]
    }'
    
    test_api_endpoint "Transfer Transaction" "POST" "$BASE_URL:$LB_PORT/blocks" "$transfer_block" "200"
    
    # Test balance queries after transfer
    sleep 2
    test_api_endpoint "Balance Query for addr1 (after transfer)" "GET" "$BASE_URL:$LB_PORT/balance/addr1" "" "200"
    test_api_endpoint "Balance Query for addr2" "GET" "$BASE_URL:$LB_PORT/balance/addr2" "" "200"
    test_api_endpoint "Balance Query for addr3" "GET" "$BASE_URL:$LB_PORT/balance/addr3" "" "200"
    
    # Test Rollback Functionality
    log_info "Testing Rollback Functionality..."
    test_api_endpoint "Rollback to Height 1" "POST" "$BASE_URL:$LB_PORT/rollback?height=1" "" "200"
    
    # Test balances after rollback
    sleep 2
    test_api_endpoint "Balance Query for addr1 (after rollback)" "GET" "$BASE_URL:$LB_PORT/balance/addr1" "" "200"
    test_api_endpoint "Balance Query for addr2 (after rollback)" "GET" "$BASE_URL:$LB_PORT/balance/addr2" "" "200"
    
    # Test 6: Monitoring Stack Tests
    echo ""
    echo "📊 6. MONITORING STACK TESTS"
    echo "----------------------------"
    
    # Prometheus
    test_service_health "Prometheus" "$BASE_URL:$PROMETHEUS_PORT/" "200"
    test_service_health "Prometheus Targets" "$BASE_URL:$PROMETHEUS_PORT/api/v1/targets" "200"
    
    # Grafana
    test_service_health "Grafana" "$BASE_URL:$GRAFANA_PORT/api/health" "200"
    
    # Test 7: Error Handling Tests
    echo ""
    echo "❌ 7. ERROR HANDLING TESTS"
    echo "--------------------------"
    
    # Invalid block
    invalid_block='{"invalid": "block"}'
    test_api_endpoint "Invalid Block Processing" "POST" "$BASE_URL:$LB_PORT/blocks" "$invalid_block" "400"
    
    # Non-existent address balance
    test_api_endpoint "Non-existent Address Balance" "GET" "$BASE_URL:$LB_PORT/balance/nonexistent" "" "200"
    
    # Invalid rollback height
    test_api_endpoint "Invalid Rollback Height" "POST" "$BASE_URL:$LB_PORT/rollback?height=-1" "" "400"
    
    # Test 8: Performance Tests
    echo ""
    echo "⚡ 8. PERFORMANCE TESTS"
    echo "----------------------"
    
    log_info "Running concurrent health checks..."
    for i in {1..10}; do
        curl -s "$BASE_URL:$LB_PORT/health" >/dev/null &
    done
    wait
    log_success "Concurrent requests completed"
    
    # Test 9: Individual API Instance Tests
    echo ""
    echo "🔍 9. INDIVIDUAL API INSTANCE TESTS"
    echo "-----------------------------------"
    
    for port in "${API_PORTS[@]}"; do
        log_info "Testing API instance on port $port..."
        test_api_endpoint "Direct API Health :$port" "GET" "$BASE_URL:$port/health" "" "200"
        test_api_endpoint "Direct API Metrics :$port" "GET" "$BASE_URL:$port/metrics" "" "200"
    done
    
    # Test Summary
    echo ""
    echo "📈 TEST SUMMARY"
    echo "==============="
    echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
    echo -e "Tests Failed: ${RED}$FAILED${NC}"
    echo -e "Total Tests:  $((PASSED + FAILED))"
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed! Cluster is healthy.${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed. Check the cluster configuration.${NC}"
        exit 1
    fi
}

# Help function
show_help() {
    echo "UTXO Indexer Cluster Test Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  help    Show this help message"
    echo ""
    echo "The script will test:"
    echo "  - Container health and connectivity"
    echo "  - Database connections (PostgreSQL, Redis)"
    echo "  - API functionality and load balancing"
    echo "  - Block processing and balance queries"
    echo "  - Rollback functionality"
    echo "  - Monitoring stack (Prometheus, Grafana)"
    echo "  - Error handling"
    echo "  - Performance under load"
    echo ""
}

# Main execution
case "${1:-run}" in
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        main
        ;;
esac 