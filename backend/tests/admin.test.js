const assert = require('assert');
const { requireAdmin, requireSuperAdmin } = require('../middleware/roleGuard');

console.log('--- Running Admin RBAC Middleware Unit Tests ---');

// Mock response builder
function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

// 1. Test requireAdmin with valid admin
{
  const req = { user: { uid: 'u1', role: 'admin', assignedArea: 'Ward 42' } };
  const res = createMockRes();
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'requireAdmin should call next() for role: admin');
  console.log('✓ Test 1 Passed: requireAdmin allows role === "admin"');
}

// 2. Test requireAdmin with valid super_admin
{
  const req = { user: { uid: 'u2', role: 'super_admin' } };
  const res = createMockRes();
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'requireAdmin should call next() for role: super_admin');
  console.log('✓ Test 2 Passed: requireAdmin allows role === "super_admin"');
}

// 3. Test requireAdmin blocks standard citizen user
{
  const req = { user: { uid: 'u3', role: 'citizen' } };
  const res = createMockRes();
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false, 'requireAdmin should not call next() for non-admin');
  assert.strictEqual(res.statusCode, 403, 'requireAdmin should return 403 for non-admin');
  assert.strictEqual(res.body.success, false);
  console.log('✓ Test 3 Passed: requireAdmin returns 403 Forbidden for non-admin role');
}

// 4. Test requireAdmin blocks unauthenticated user
{
  const req = { user: null };
  const res = createMockRes();
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 401);
  console.log('✓ Test 4 Passed: requireAdmin returns 401 Unauthorized when req.user is missing');
}

// 5. Test requireSuperAdmin allows super_admin
{
  const req = { user: { uid: 'u2', role: 'super_admin' } };
  const res = createMockRes();
  let nextCalled = false;
  requireSuperAdmin(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'requireSuperAdmin should call next() for super_admin');
  console.log('✓ Test 5 Passed: requireSuperAdmin allows role === "super_admin"');
}

// 6. Test requireSuperAdmin blocks ward admin
{
  const req = { user: { uid: 'u1', role: 'admin', assignedArea: 'Ward 42' } };
  const res = createMockRes();
  let nextCalled = false;
  requireSuperAdmin(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false, 'requireSuperAdmin should block ward admin');
  assert.strictEqual(res.statusCode, 403);
  console.log('✓ Test 6 Passed: requireSuperAdmin returns 403 Forbidden for ward admin');
}

console.log('\n--- Running Admin Routes Definition Tests ---');
const adminRoutes = require('../routes/adminRoutes');
const registeredEndpoints = [];

adminRoutes.stack.forEach((layer) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
    registeredEndpoints.push(`${methods} ${layer.route.path}`);
  }
});

const expectedEndpoints = [
  'POST /officers',
  'GET /officers',
  'DELETE /officers/:uid',
  'GET /stats',
  'GET /complaints',
  'PATCH /complaints/:id/status',
];

expectedEndpoints.forEach((endpoint) => {
  assert(
    registeredEndpoints.includes(endpoint),
    `Missing expected endpoint: ${endpoint} (registered: ${registeredEndpoints.join(', ')})`
  );
  console.log(`✓ Verified route: /api/admin${endpoint.split(' ')[1]} (${endpoint.split(' ')[0]})`);
});

console.log('\nAll Admin RBAC & Route tests passed successfully!\n');
