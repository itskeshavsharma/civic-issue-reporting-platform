const http = require('http');
const assert = require('assert');
const app = require('../server');

let testServer;
let testPort = 5000;

function startServer() {
  return new Promise((resolve) => {
    testServer = app.listen(0, '127.0.0.1', () => {
      testPort = testServer.address().port;
      resolve(testPort);
    });
  });
}

function makeRequest(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: testPort,
        path,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data), headers: res.headers });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: data, headers: res.headers });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('--- Running API HTTP Endpoint Tests ---');
  try {
    await startServer();
    console.log(`[Test Server] Running on ephemeral port: ${testPort}`);

    // 1. Test GET /health
    const healthRes = await makeRequest('/health');
    assert.strictEqual(healthRes.statusCode, 200);
    assert.strictEqual(healthRes.body.status, 'healthy');
    assert.strictEqual(healthRes.body.services.server, 'running');
    assert.strictEqual(healthRes.body.services.firebase, 'initialized');
    console.log('✓ GET /health: 200 OK - server & firebase healthy');

    // 2. Test GET /
    const rootRes = await makeRequest('/');
    assert.strictEqual(rootRes.statusCode, 200);
    assert.strictEqual(rootRes.body.name, 'Civic Issue Reporting Platform Backend API');
    console.log('✓ GET /: 200 OK - root info returned');

    // 3. Test 404 route
    const notFoundRes = await makeRequest('/non-existent-endpoint');
    assert.strictEqual(notFoundRes.statusCode, 404);
    assert.strictEqual(notFoundRes.body.success, false);
    console.log('✓ GET /non-existent-endpoint: 404 Not Found correctly formatted');

    // 4. Test Protected Route without token: POST /api/complaints/submit
    const submitRes = await makeRequest('/api/complaints/submit', 'POST');
    assert.strictEqual(submitRes.statusCode, 401);
    assert.strictEqual(submitRes.body.success, false);
    assert(submitRes.body.message.includes('No Bearer token'));
    console.log('✓ POST /api/complaints/submit without token: 401 Unauthorized correctly blocked');

    // 4b. Test Admin Protected Route without token: GET /api/admin/stats
    const adminStatsRes = await makeRequest('/api/admin/stats', 'GET');
    assert.strictEqual(adminStatsRes.statusCode, 401);
    assert.strictEqual(adminStatsRes.body.success, false);
    console.log('✓ GET /api/admin/stats without token: 401 Unauthorized correctly blocked');

    // 4c. Test Super Admin Route without token: GET /api/admin/officers
    const adminOfficersRes = await makeRequest('/api/admin/officers', 'GET');
    assert.strictEqual(adminOfficersRes.statusCode, 401);
    assert.strictEqual(adminOfficersRes.body.success, false);
    console.log('✓ GET /api/admin/officers without token: 401 Unauthorized correctly blocked');

    // 5. Test Protected Route with invalid token
    const invalidTokenRes = await makeRequest('/api/complaints/my', 'GET', {
      Authorization: 'Bearer invalid-token-12345',
    });
    assert.strictEqual(invalidTokenRes.statusCode, 401);
    assert.strictEqual(invalidTokenRes.body.success, false);
    console.log('✓ GET /api/complaints/my with invalid Bearer token: 401 Unauthorized blocked by Firebase verification');

    console.log('\nAll API HTTP Endpoint tests passed successfully!');
    if (testServer) testServer.close();
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    if (testServer) testServer.close();
    process.exit(1);
  }
})();
