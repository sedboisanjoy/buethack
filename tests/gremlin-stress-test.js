/**
 * Valerix Gremlin Stress Test
 * Tests Order Service behavior with Gremlin latency enabled
 */

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002';

const CONCURRENT_REQUESTS = 10;
const TOTAL_ORDERS = 20;
const GREMLIN_MIN_DELAY = 3000;
const GREMLIN_MAX_DELAY = 4000;
const RESULTS_DIR = './results';

const fs = require('fs');
const path = require('path');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const results = {
  startTime: new Date().toISOString(),
  testType: 'gremlin-stress',
  config: {
    concurrentRequests: CONCURRENT_REQUESTS,
    totalOrders: TOTAL_ORDERS,
    gremlinMinDelay: GREMLIN_MIN_DELAY,
    gremlinMaxDelay: GREMLIN_MAX_DELAY,
  },
  orders: [],
  affectedOrders: [],
  summary: {
    total: 0,
    confirmed: 0,
    pending_verification: 0,
    failed: 0,
    errors: 0,
    timeouts: 0,
    avgResponseTime: 0,
    maxResponseTime: 0,
  },
};

async function enableGremlin() {
  console.log('Enabling Gremlin latency mode...');
  
  try {
    const response = await fetch(`${INVENTORY_SERVICE_URL}/chaos/gremlin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        minLatencyMs: GREMLIN_MIN_DELAY,
        maxLatencyMs: GREMLIN_MAX_DELAY,
      }),
    });
    
    const data = await response.json();
    console.log(`✓ Gremlin enabled: ${GREMLIN_MIN_DELAY}-${GREMLIN_MAX_DELAY}ms delay`);
    return data.success;
  } catch (error) {
    console.error('Failed to enable Gremlin:', error.message);
    return false;
  }
}

async function disableGremlin() {
  console.log('\nDisabling Gremlin latency mode...');
  
  try {
    await fetch(`${INVENTORY_SERVICE_URL}/chaos/gremlin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    console.log('✓ Gremlin disabled');
  } catch (error) {
    console.error('Failed to disable Gremlin:', error.message);
  }
}

async function createOrder(index) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${ORDER_SERVICE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: `gremlin-test-user-${index}`,
        productId: 'SKU-004',
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
      timedOut: duration >= 2000, // Order service timeout is 2s
    };
    
    // Track affected orders (those that experienced timeout)
    if (result.status === 'pending_verification' || result.timedOut) {
      results.affectedOrders.push({
        index,
        orderId: result.orderId,
        status: result.status,
        duration,
      });
      results.summary.timeouts++;
    }
    
    // Update summary
    results.summary.total++;
    results.summary.avgResponseTime += duration;
    results.summary.maxResponseTime = Math.max(results.summary.maxResponseTime, duration);
    
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

async function runGremlinTest() {
  console.log('\n========================================');
  console.log('  VALERIX GREMLIN STRESS TEST');
  console.log('========================================');
  console.log(`Total Orders: ${TOTAL_ORDERS}`);
  console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Gremlin Delay: ${GREMLIN_MIN_DELAY}-${GREMLIN_MAX_DELAY}ms`);
  console.log(`Expected Timeout: ~2000ms (Order Service timeout)`);
  console.log('========================================\n');
  
  // Enable Gremlin mode
  const gremlinEnabled = await enableGremlin();
  if (!gremlinEnabled) {
    console.error('Failed to enable Gremlin mode, aborting test');
    process.exit(1);
  }
  
  console.log('\nStarting stress test with Gremlin enabled...\n');
  
  const startTime = Date.now();
  
  try {
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
    
    // Print results
    console.log('\n\n========================================');
    console.log('  GREMLIN STRESS TEST RESULTS');
    console.log('========================================');
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log('');
    console.log('Order Status:');
    console.log(`  ✓ Confirmed: ${results.summary.confirmed}`);
    console.log(`  ⏳ Pending Verification: ${results.summary.pending_verification}`);
    console.log(`  ✗ Failed: ${results.summary.failed}`);
    console.log(`  ⚠ Errors: ${results.summary.errors}`);
    console.log('');
    console.log('Timeout Statistics:');
    console.log(`  Orders affected by Gremlin: ${results.summary.timeouts}`);
    console.log(`  Percentage affected: ${((results.summary.timeouts / results.summary.total) * 100).toFixed(1)}%`);
    console.log('');
    console.log('Response Times:');
    console.log(`  Average: ${results.summary.avgResponseTime}ms`);
    console.log(`  Max: ${results.summary.maxResponseTime}ms`);
    console.log('');
    
    // List affected orders
    if (results.affectedOrders.length > 0) {
      console.log('Affected Orders (pending verification):');
      results.affectedOrders.slice(0, 10).forEach((order) => {
        console.log(`  - Order ${order.index}: ${order.orderId?.slice(0, 8) || 'N/A'}... (${order.duration}ms)`);
      });
      if (results.affectedOrders.length > 10) {
        console.log(`  ... and ${results.affectedOrders.length - 10} more`);
      }
    }
    
    console.log('========================================\n');
    
    // Save results to file
    const resultsFile = path.join(RESULTS_DIR, `gremlin-test-${Date.now()}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`Results saved to: ${resultsFile}`);
    
    // Verify that the system handled timeouts gracefully
    if (results.summary.pending_verification > 0) {
      console.log('\n✓ System handled Gremlin delays gracefully');
      console.log('  Orders in pending_verification will be recovered via async verification');
    }
    
    // Check that response times were ~2s (timeout) not 3-4s (gremlin delay)
    if (results.summary.avgResponseTime <= 2500) {
      console.log('✓ Order Service timeout working correctly (responses ~2s, not 3-4s)');
    } else {
      console.log('⚠ Response times higher than expected - timeout may not be working');
    }
    
  } finally {
    // Always disable Gremlin
    await disableGremlin();
  }
  
  console.log('\n✓ Gremlin stress test completed');
}

runGremlinTest().catch((error) => {
  console.error('Gremlin test failed:', error);
  disableGremlin().finally(() => process.exit(1));
});
