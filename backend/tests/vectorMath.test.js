const assert = require('assert');
const { getCosineSimilarity } = require('../utils/vectorMath');

console.log('--- Running vectorMath.js Unit Tests ---');

// Test 1: Identical vectors
{
  const v1 = [1, 2, 3];
  const v2 = [1, 2, 3];
  const sim = getCosineSimilarity(v1, v2);
  assert.strictEqual(Math.round(sim * 1e6) / 1e6, 1.0, 'Identical vectors must have similarity 1.0');
  console.log('✓ Test 1 Passed: Identical vectors return 1.0');
}

// Test 2: Orthogonal vectors
{
  const v1 = [1, 0, 0];
  const v2 = [0, 1, 0];
  const sim = getCosineSimilarity(v1, v2);
  assert.strictEqual(sim, 0.0, 'Orthogonal vectors must have similarity 0.0');
  console.log('✓ Test 2 Passed: Orthogonal vectors return 0.0');
}

// Test 3: Opposite vectors
{
  const v1 = [1, 1, 1];
  const v2 = [-1, -1, -1];
  const sim = getCosineSimilarity(v1, v2);
  assert.strictEqual(Math.round(sim * 1e6) / 1e6, -1.0, 'Opposite vectors must have similarity -1.0');
  console.log('✓ Test 3 Passed: Opposite vectors return -1.0');
}

// Test 4: 384-Dimensional Vectors (MiniLM format)
{
  const dim = 384;
  const vA = new Array(dim).fill(0).map((_, i) => Math.sin(i));
  // Create a slightly perturbed vector
  const vB = vA.map((val, i) => val + (i % 10 === 0 ? 0.05 : 0));
  const sim = getCosineSimilarity(vA, vB);
  assert(sim > 0.95 && sim <= 1.0, `Expected high similarity for slight perturbation, got ${sim}`);
  console.log(`✓ Test 4 Passed: 384-D vector similarity computed accurately (${sim.toFixed(4)})`);
}

// Test 5: Zero vectors & edge cases
{
  const v1 = [0, 0, 0];
  const v2 = [1, 2, 3];
  const sim = getCosineSimilarity(v1, v2);
  assert.strictEqual(sim, 0.0, 'Zero vector must return 0.0 similarity');

  const emptySim = getCosineSimilarity([], []);
  assert.strictEqual(emptySim, 0.0, 'Empty vectors must return 0.0');

  const mismatchSim = getCosineSimilarity([1, 2], [1, 2, 3]);
  assert.strictEqual(mismatchSim, 0.0, 'Mismatched length vectors must return 0.0');
  console.log('✓ Test 5 Passed: Zero vectors and mismatched lengths handled safely');
}

// Test 6: Deduplication Threshold Simulation (0.78 threshold)
{
  const dim = 384;
  const base = new Array(dim).fill(0).map(() => Math.random() - 0.5);
  // Duplicate vector with minor variations (sim > 0.78)
  const duplicate = base.map((x) => x + (Math.random() - 0.5) * 0.1);
  // Unrelated vector (random noise)
  const unrelated = new Array(dim).fill(0).map(() => Math.random() - 0.5);

  const simDup = getCosineSimilarity(base, duplicate);
  const simUnrelated = getCosineSimilarity(base, unrelated);

  console.log(`✓ Test 6 Passed: Duplicate similarity: ${simDup.toFixed(4)} (Threshold >= 0.78: ${simDup >= 0.78})`);
  console.log(`                 Unrelated similarity: ${simUnrelated.toFixed(4)} (Below threshold: ${simUnrelated < 0.78})`);
  assert(simDup > 0.78, 'Near-identical embedding should exceed 0.78 threshold');
}

console.log('All vectorMath unit tests passed successfully!\n');
