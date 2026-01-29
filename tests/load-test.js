/**
 * Valerix Load Test Script
 * Tests Order Service behavior under concurrent load
 */

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002';

const CONCURRENT_REQUESTS = 20;
const TOTAL_ORDERS = 50;
const RESULTS_DIR = './results';

const fs = require('fs');
const path = require('path');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const results = {
  startTime: new Date().toISOString(),
  config: {
    concurrentRequests: CONCURRENT_REQUESTS,
    totalOrders: TOTAL_ORDERS,
    orderServiceUrl: ORDER_SERVICE_URL,
  },
  orders: [],
  summary: {
    total: 0,
    confirmed: 0,
    failed: 0,
    pending_verification: 0,
    errors: 0,
    avgResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
  },
};

async function createOrder(index) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${ORDER_SERVICE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: `load-test-user-${index}`,
        productId: 'SKU-001',
        quantity: 1,
      }),
    });
    
    const duration = Date.now() - startTime;
    const data = await response.json();
    
    const result = {
      index,
      orderId: data.data?.id || null,
      status: data.data?.status || 'error',
      success: data.success,
      duration,
      httpStatus: response.status,
      verificationRequired: data.verificationRequired || false,
    };
    
    // Update summary
    results.summary.total++;
    results.summary.avgResponseTime += duration;
    results.summary.maxResponseTime = Math.max(results.summary.maxResponseTime, duration);
    results.summary.minResponseTime = Math.min(results.summary.minResponseTime, duration);
    
    if (data.success) {
      if (data.data?.status === 'confirmed') {
        results.summary.confirmed++;
      } else if (data.data?.status === 'pending_verification') {
        results.summary.pending_verification++;
      } else if (data.data?.status === 'failed') {
        results.summary.failed++;
      }
    } else {
      results.summary.errors++;
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    results.summary.total++;
    results.summary.errors++;
    
    return {
      index,
      orderId: null,
      status: 'error',
      success: false,
      duration,
      error: error.message,
    };
  }
}

async function runBatch(startIndex, batchSize) {
  const promises = [];
  for (let i = 0; i < batchSize; i++) {
    promises.push(createOrder(startIndex + i));
  }
  return Promise.all(promises);
}

async function checkServicesHealth() {
  console.log('Checking services health...');
  
  try {
    const orderHealth = await fetch(`${ORDER_SERVICE_URL}/health`);
    const orderData = await orderHealth.json();
    
    const inventoryHealth = await fetch(`${INVENTORY_SERVICE_URL}/health`);
    const inventoryData = await inventoryHealth.json();
    
    if (orderData.status !== 'healthy' || inventoryData.status !== 'healthy') {
      console.error('Services are not healthy!');
      console.log('Order Service:', orderData.status);
      console.log('Inventory Service:', inventoryData.status);
      process.exit(1);
    }
    
    console.log('✓ All services healthy');
  } catch (error) {
    console.error('Failed to check health:', error.message);
    process.exit(1);
  }
}

async function getInitialStock() {
  try {
    const response = await fetch(`${INVENTORY_SERVICE_URL}/products/SKU-001`);
    const data = await response.json();
    return data.data?.stock || 0;
  } catch {
    return 0;
  }
}

async function runLoadTest() {
  console.log('\n========================================');
  console.log('  VALERIX LOAD TEST');
  console.log('========================================');
  console.log(`Total Orders: ${TOTAL_ORDERS}`);
  console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Order Service: ${ORDER_SERVICE_URL}`);
  console.log('========================================\n');
  
  await checkServicesHealth();
  
  const initialStock = await getInitialStock();
  console.log(`\nInitial stock (SKU-001): ${initialStock}`);
  
  console.log('\nStarting load test...\n');
  
  const startTime = Date.now();
  
  // Run orders in batches
  let completedOrders = 0;
  while (completedOrders < TOTAL_ORDERS) {
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_ORDERS - completedOrders);
    const batchResults = await runBatch(completedOrders, batchSize);
    
    results.orders.push(...batchResults);
    completedOrders += batchSize;
    
    // Progress update
    const progress = Math.round((completedOrders / TOTAL_ORDERS) * 100);
    process.stdout.write(`\rProgress: ${progress}% (${completedOrders}/${TOTAL_ORDERS})`);
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Calculate final average
  results.summary.avgResponseTime = Math.round(results.summary.avgResponseTime / results.summary.total);
  results.endTime = new Date().toISOString();
  results.totalDuration = totalDuration;
  
  // Get final stock
  const finalStock = await getInitialStock();
  results.stockChange = {
    initial: initialStock,
    final: finalStock,
    consumed: initialStock - finalStock,
  };
  
  // Print results
  console.log('\n\n========================================');
  console.log('  LOAD TEST RESULTS');
  console.log('========================================');
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Throughput: ${Math.round(TOTAL_ORDERS / (totalDuration / 1000))} orders/sec`);
  console.log('');
  console.log('Order Status:');
  console.log(`  ✓ Confirmed: ${results.summary.confirmed}`);
  console.log(`  ⏳ Pending Verification: ${results.summary.pending_verification}`);
  console.log(`  ✗ Failed: ${results.summary.failed}`);
  console.log(`  ⚠ Errors: ${results.summary.errors}`);
  console.log('');
  console.log('Response Times:');
  console.log(`  Average: ${results.summary.avgResponseTime}ms`);
  console.log(`  Min: ${results.summary.minResponseTime}ms`);
  console.log(`  Max: ${results.summary.maxResponseTime}ms`);
  console.log('');
  console.log('Stock Change:');
  console.log(`  Initial: ${results.stockChange.initial}`);
  console.log(`  Final: ${results.stockChange.final}`);
  console.log(`  Consumed: ${results.stockChange.consumed}`);
  console.log('========================================\n');
  
  // Save results to file
  const resultsFile = path.join(RESULTS_DIR, `load-test-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${resultsFile}`);
  
  // Exit with error if too many failures
  const failureRate = (results.summary.errors + results.summary.failed) / results.summary.total;
  if (failureRate > 0.1) {
    console.error(`\n⚠ High failure rate: ${(failureRate * 100).toFixed(1)}%`);
    process.exit(1);
  }
  
  console.log('\n✓ Load test completed successfully');
}

runLoadTest().catch((error) => {
  console.error('Load test failed:', error);
  process.exit(1);
});
