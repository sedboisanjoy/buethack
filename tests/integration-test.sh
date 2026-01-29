#!/bin/bash
# ============================================
# Valerix Integration Test Script
# ============================================

set -e

ORDER_SERVICE_URL="${ORDER_SERVICE_URL:-http://localhost:3001}"
INVENTORY_SERVICE_URL="${INVENTORY_SERVICE_URL:-http://localhost:3002}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

info() {
    echo -e "${YELLOW}→${NC} $1"
}

# ============================================
# TEST 1: Health Endpoints
# ============================================
echo ""
echo "=== TEST 1: Health Endpoints ==="

info "Checking Order Service health..."
HEALTH=$(curl -s "$ORDER_SERVICE_URL/health")
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    pass "Order Service is healthy"
else
    fail "Order Service is unhealthy: $HEALTH"
fi

info "Checking Inventory Service health..."
HEALTH=$(curl -s "$INVENTORY_SERVICE_URL/health")
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    pass "Inventory Service is healthy"
else
    fail "Inventory Service is unhealthy: $HEALTH"
fi

# ============================================
# TEST 2: Products Listing
# ============================================
echo ""
echo "=== TEST 2: Products Listing ==="

info "Fetching products..."
PRODUCTS=$(curl -s "$INVENTORY_SERVICE_URL/products")
if echo "$PRODUCTS" | grep -q '"success":true'; then
    COUNT=$(echo "$PRODUCTS" | jq '.count')
    pass "Products listing works (count: $COUNT)"
else
    fail "Products listing failed: $PRODUCTS"
fi

# ============================================
# TEST 3: Order Creation
# ============================================
echo ""
echo "=== TEST 3: Order Creation ==="

info "Creating a new order..."
ORDER=$(curl -s -X POST "$ORDER_SERVICE_URL/orders" \
    -H "Content-Type: application/json" \
    -d '{"customerId": "ci-test-user", "productId": "SKU-001", "quantity": 1}')

if echo "$ORDER" | grep -q '"success":true'; then
    ORDER_ID=$(echo "$ORDER" | jq -r '.data.id')
    STATUS=$(echo "$ORDER" | jq -r '.data.status')
    pass "Order created: $ORDER_ID (status: $STATUS)"
else
    fail "Order creation failed: $ORDER"
fi

# ============================================
# TEST 4: Idempotency
# ============================================
echo ""
echo "=== TEST 4: Idempotency ==="

IDEM_KEY="ci-test-idem-$(date +%s)"

info "Creating order with idempotency key..."
ORDER1=$(curl -s -X POST "$ORDER_SERVICE_URL/orders" \
    -H "Content-Type: application/json" \
    -d "{\"customerId\": \"ci-test\", \"productId\": \"SKU-003\", \"quantity\": 1, \"idempotencyKey\": \"$IDEM_KEY\"}")

ORDER1_ID=$(echo "$ORDER1" | jq -r '.data.id')

info "Sending duplicate request..."
ORDER2=$(curl -s -X POST "$ORDER_SERVICE_URL/orders" \
    -H "Content-Type: application/json" \
    -d "{\"customerId\": \"ci-test\", \"productId\": \"SKU-003\", \"quantity\": 1, \"idempotencyKey\": \"$IDEM_KEY\"}")

ORDER2_ID=$(echo "$ORDER2" | jq -r '.data.id')
CACHED=$(echo "$ORDER2" | jq -r '.cached')

if [ "$ORDER1_ID" == "$ORDER2_ID" ] && [ "$CACHED" == "true" ]; then
    pass "Idempotency works correctly"
else
    fail "Idempotency failed: ORDER1=$ORDER1_ID, ORDER2=$ORDER2_ID, cached=$CACHED"
fi

# ============================================
# TEST 5: Insufficient Stock
# ============================================
echo ""
echo "=== TEST 5: Insufficient Stock ==="

info "Attempting to order excessive quantity..."
RESULT=$(curl -s -X POST "$ORDER_SERVICE_URL/orders" \
    -H "Content-Type: application/json" \
    -d '{"customerId": "ci-test", "productId": "SKU-001", "quantity": 99999}')

if echo "$RESULT" | grep -q '"success":false' && echo "$RESULT" | grep -q 'Insufficient'; then
    pass "Insufficient stock handled correctly"
else
    fail "Insufficient stock not handled: $RESULT"
fi

# ============================================
# TEST 6: Order Retrieval
# ============================================
echo ""
echo "=== TEST 6: Order Retrieval ==="

if [ -n "$ORDER_ID" ]; then
    info "Fetching order by ID..."
    FETCHED=$(curl -s "$ORDER_SERVICE_URL/orders/$ORDER_ID")
    if echo "$FETCHED" | grep -q '"success":true'; then
        pass "Order retrieval works"
    else
        fail "Order retrieval failed: $FETCHED"
    fi
else
    fail "No order ID available for retrieval test"
fi

# ============================================
# TEST 7: gRPC Stock Check
# ============================================
echo ""
echo "=== TEST 7: gRPC Stock Check ==="

info "Checking stock via gRPC..."
STOCK=$(curl -s "$ORDER_SERVICE_URL/products/SKU-001/stock")
if echo "$STOCK" | grep -q '"found":true'; then
    AVAILABLE=$(echo "$STOCK" | jq '.data.availableStock')
    pass "gRPC stock check works (available: $AVAILABLE)"
else
    fail "gRPC stock check failed: $STOCK"
fi

# ============================================
# SUMMARY
# ============================================
echo ""
echo "========================================"
echo "        TEST SUMMARY"
echo "========================================"
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo "========================================"

if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
fi

exit 0
