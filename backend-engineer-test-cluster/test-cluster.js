#!/usr/bin/env node

/**
 * UTXO Blockchain Indexer - Cluster Test Suite (Node.js)
 * Modern JavaScript testing with fetch API and detailed reporting
 */

import { spawn } from 'child_process';

// Configuration
const config = {
  baseUrl: 'http://localhost',
  lbPort: 80,
  apiPorts: [3001, 3002, 3003],
  prometheusPort: 9091,
  grafanaPort: 3004,
  haproxyStatsPort: 8404
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Utility functions
const log = {
  info: (msg) => console.log(`🔍 [INFO] ${msg}`),
  success: (msg) => {
    console.log(`✅ [PASS] ${msg}`);
    results.passed++;
  },
  error: (msg) => {
    console.log(`❌ [FAIL] ${msg}`);
    results.failed++;
  },
  warning: (msg) => console.log(`⚠️  [WARN] ${msg}`)
};

// Test execution wrapper
async function runTest(name, testFn) {
  const startTime = Date.now();
  try {
    log.info(`Testing: ${name}`);
    const result = await testFn();
    const duration = Date.now() - startTime;

    results.tests.push({
      name,
      passed: true,
      duration,
      result
    });

    log.success(`${name} - Duration: ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    results.tests.push({
      name,
      passed: false,
      duration,
      error: error.message
    });

    log.error(`${name} - ${error.message}`);
    throw error;
  }
}

// HTTP request helper
async function httpRequest(method, url, data = null, expectedStatus = 200) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (response.status !== expectedStatus) {
    const text = await response.text();
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}. Response: ${text}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  } else {
    return await response.text();
  }
}

// Docker command helper
async function dockerCommand(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('docker', args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Docker command failed: ${stderr}`));
      }
    });
  });
}

// Test suites
async function testContainerHealth() {
  log.info('Testing container health...');

  const output = await dockerCommand([
    'compose', '-f', 'docker-compose.simple.yml', 'ps'
  ]);

  console.log(output);

  // Check if containers are running
  if (output.includes('Up')) {
    log.success('Docker containers are running');
  } else {
    throw new Error('Some containers are not running');
  }
}

async function testDatabaseConnectivity() {
  log.info('Testing database connectivity...');

  // Test PostgreSQL
  try {
    await dockerCommand(['exec', 'utxo-postgres-primary', 'pg_isready', '-U', 'postgres']);
    log.success('PostgreSQL is accessible');
  } catch (error) {
    log.error('PostgreSQL connection failed');
  }

  // Test Redis
  try {
    const result = await dockerCommand(['exec', 'utxo-redis-1', 'redis-cli', 'ping']);
    if (result.includes('PONG')) {
      log.success('Redis is accessible');
    } else {
      throw new Error('Redis ping failed');
    }
  } catch (error) {
    log.error('Redis connection failed');
  }
}

async function testApiInstances() {
  log.info('Testing individual API instances...');

  const promises = config.apiPorts.map(async (port) => {
    return runTest(`API Instance :${port} Health`, async () => {
      const url = `${config.baseUrl}:${port}/health`;
      return await httpRequest('GET', url);
    });
  });

  await Promise.allSettled(promises);
}

async function testLoadBalancer() {
  log.info('Testing load balancer...');

  // Test HAProxy stats
  await runTest('HAProxy Stats', async () => {
    const url = `${config.baseUrl}:${config.haproxyStatsPort}/stats`;
    return await httpRequest('GET', url);
  });

  // Test load balanced requests
  log.info('Testing load distribution...');
  const promises = Array.from({ length: 10 }, (_, i) => {
    return runTest(`Load Balanced Request #${i + 1}`, async () => {
      const url = `${config.baseUrl}:${config.lbPort}/health`;
      return await httpRequest('GET', url);
    });
  });

  await Promise.allSettled(promises);
}

async function testBlockchainFunctionality() {
  log.info('Testing blockchain functionality...');

  const baseUrl = `${config.baseUrl}:${config.lbPort}`;

  // Test root endpoint
  await runTest('API Root', async () => {
    return await httpRequest('GET', `${baseUrl}/`);
  });

  // Test metrics endpoint
  await runTest('Metrics Endpoint', async () => {
    return await httpRequest('GET', `${baseUrl}/metrics`);
  });

  // Test Genesis Block
  const genesisBlock = {
    id: "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9",
    height: 1,
    transactions: [{
      id: "tx1",
      inputs: [],
      outputs: [{ address: "addr1", value: 100 }]
    }]
  };

  await runTest('Genesis Block Processing', async () => {
    return await httpRequest('POST', `${baseUrl}/blocks`, genesisBlock);
  });

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test balance query
  await runTest('Balance Query (addr1)', async () => {
    return await httpRequest('GET', `${baseUrl}/balance/addr1`);
  });

  // Test transfer transaction
  const transferBlock = {
    id: "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
    height: 2,
    transactions: [{
      id: "tx2",
      inputs: [{ txId: "tx1", index: 0 }],
      outputs: [
        { address: "addr2", value: 60 },
        { address: "addr3", value: 40 }
      ]
    }]
  };

  await runTest('Transfer Transaction', async () => {
    return await httpRequest('POST', `${baseUrl}/blocks`, transferBlock);
  });

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test balance queries after transfer
  const balancePromises = [
    runTest('Balance Query (addr1 after transfer)', () =>
      httpRequest('GET', `${baseUrl}/balance/addr1`)),
    runTest('Balance Query (addr2)', () =>
      httpRequest('GET', `${baseUrl}/balance/addr2`)),
    runTest('Balance Query (addr3)', () =>
      httpRequest('GET', `${baseUrl}/balance/addr3`))
  ];

  await Promise.allSettled(balancePromises);

  // Test rollback
  await runTest('Rollback to Height 1', async () => {
    return await httpRequest('POST', `${baseUrl}/rollback?height=1`);
  });

  // Wait for rollback processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test balances after rollback
  const rollbackPromises = [
    runTest('Balance Query (addr1 after rollback)', () =>
      httpRequest('GET', `${baseUrl}/balance/addr1`)),
    runTest('Balance Query (addr2 after rollback)', () =>
      httpRequest('GET', `${baseUrl}/balance/addr2`))
  ];

  await Promise.allSettled(rollbackPromises);
}

async function testMonitoringStack() {
  log.info('Testing monitoring stack...');

  // Test Prometheus
  const prometheusUrl = `${config.baseUrl}:${config.prometheusPort}`;

  await runTest('Prometheus Health', async () => {
    return await httpRequest('GET', `${prometheusUrl}/`);
  });

  await runTest('Prometheus Targets', async () => {
    return await httpRequest('GET', `${prometheusUrl}/api/v1/targets`);
  });

  // Test Grafana
  const grafanaUrl = `${config.baseUrl}:${config.grafanaPort}`;

  await runTest('Grafana Health', async () => {
    return await httpRequest('GET', `${grafanaUrl}/api/health`);
  });
}

async function testErrorHandling() {
  log.info('Testing error handling...');

  const baseUrl = `${config.baseUrl}:${config.lbPort}`;

  // Test invalid block
  await runTest('Invalid Block Processing', async () => {
    return await httpRequest('POST', `${baseUrl}/blocks`,
      { invalid: "block" }, 400);
  });

  // Test non-existent address
  await runTest('Non-existent Address Balance', async () => {
    return await httpRequest('GET', `${baseUrl}/balance/nonexistent`);
  });

  // Test invalid rollback
  await runTest('Invalid Rollback Height', async () => {
    return await httpRequest('POST', `${baseUrl}/rollback?height=-1`, null, 400);
  });
}

async function testPerformance() {
  log.info('Testing performance under concurrent load...');

  const baseUrl = `${config.baseUrl}:${config.lbPort}`;
  const startTime = Date.now();

  // Concurrent health checks
  const promises = Array.from({ length: 50 }, (_, i) => {
    return runTest(`Concurrent Health Check #${i + 1}`, async () => {
      return await httpRequest('GET', `${baseUrl}/health`);
    });
  });

  const results = await Promise.allSettled(promises);
  const duration = Date.now() - startTime;

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.length - successful;

  log.info('Performance Test Results:');
  console.log(`  Total Requests: ${results.length}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total Duration: ${duration}ms`);
  console.log(`  Requests/sec: ${(results.length / duration * 1000).toFixed(2)}`);
}

function printSummary() {
  console.log('\n' + '='.repeat(50));
  console.log('🔍 CLUSTER TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`📊 Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);

  const successRate = results.passed / (results.passed + results.failed) * 100;
  console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);

  const totalDuration = results.tests.reduce((sum, test) => sum + test.duration, 0);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);

  const avgDuration = totalDuration / results.tests.length;
  console.log(`⚡ Avg Response Time: ${avgDuration.toFixed(1)}ms`);

  const failedTests = results.tests.filter(test => !test.passed);
  if (failedTests.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.error}`);
    });
  }

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Cluster is healthy.');
    return true;
  } else {
    console.log(`\n⚠️  ${results.failed} tests failed. Check cluster configuration.`);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting UTXO Indexer Cluster Tests (Node.js)');
  console.log('='.repeat(55));

  // Wait for services to be ready
  console.log('⏳ Waiting for services to be ready...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    // Run test suites
    await testContainerHealth();
    await testDatabaseConnectivity();
    await testApiInstances();
    await testLoadBalancer();
    await testBlockchainFunctionality();
    await testMonitoringStack();
    await testErrorHandling();
    await testPerformance();

  } catch (error) {
    console.error(`❌ Test execution failed: ${error.message}`);
    process.exit(1);
  }

  // Print summary and exit
  const success = printSummary();
  process.exit(success ? 0 : 1);
}

// Handle errors and interruptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Tests interrupted by user');
  process.exit(1);
});

// Start tests
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`❌ Unexpected error: ${error.message}`);
    process.exit(1);
  });
} 