const assert = require('assert');
const app = require('../server');

console.log('--- Running Express App & Route Definitions Tests ---');

// Inspect loaded routes in Express
const routes = [];
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    // Direct routes on app
    routes.push({
      path: middleware.route.path,
      methods: Object.keys(middleware.route.methods),
    });
  } else if (middleware.name === 'router' && middleware.handle.stack) {
    // Router middleware (e.g., /api/complaints)
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        routes.push({
          path: '/api/complaints' + handler.route.path,
          methods: Object.keys(handler.route.methods),
        });
      }
    });
  }
});

console.log('Registered Routes:');
routes.forEach((r) => console.log(`  ${r.methods.join(',').toUpperCase()} ${r.path}`));

// Verify required routes exist
const expectedRoutes = [
  { path: '/api/complaints/preview', method: 'post' },
  { path: '/api/complaints/submit', method: 'post' },
  { path: '/api/complaints/my', method: 'get' },
  { path: '/api/complaints/area', method: 'get' },
  { path: '/api/complaints/stats', method: 'get' },
  { path: '/health', method: 'get' },
];

for (const exp of expectedRoutes) {
  const match = routes.find(
    (r) => r.path === exp.path && r.methods.includes(exp.method)
  );
  assert(match, `Expected route ${exp.method.toUpperCase()} ${exp.path} was not found!`);
  console.log(`✓ Verified route: ${exp.method.toUpperCase()} ${exp.path}`);
}

console.log('\nAll Express routes verified successfully!');
process.exit(0);
