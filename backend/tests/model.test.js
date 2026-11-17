const assert = require('assert');
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');

console.log('--- Running Complaint Model & Schema Tests ---');

// Test 1: Verify Schema Indexes
{
  const indexes = Complaint.schema.indexes();
  console.log(`Found ${indexes.length} custom index definitions on Complaint schema.`);

  // Verify 2dsphere index exists on location
  const spatialIndex = indexes.find(([idxDef]) => idxDef.location === '2dsphere');
  assert(spatialIndex, '2dsphere index on location field must be defined');
  console.log('✓ Test 1 Passed: 2dsphere spatial index verified on location');

  // Verify compound index on address.city and address.areaName
  const compoundIndex = indexes.find(
    ([idxDef]) => idxDef['address.city'] === 1 && idxDef['address.areaName'] === 1
  );
  assert(compoundIndex, 'Compound index on address.city and address.areaName must be defined');
  console.log('✓ Test 2 Passed: Compound index verified on address.city + address.areaName');

  // Verify status index
  const statusIndex = indexes.find(([idxDef]) => idxDef.status === 1);
  assert(statusIndex, 'Index on status must be defined');
  console.log('✓ Test 3 Passed: Index verified on status');
}

// Test 2: Validation of required fields
{
  const doc = new Complaint({});
  const validationError = doc.validateSync();
  assert(validationError, 'Validating an empty document should fail');
  
  const errors = Object.keys(validationError.errors);
  assert(errors.includes('userId'), 'userId should be required');
  assert(errors.includes('userEmail'), 'userEmail should be required');
  assert(errors.includes('title.en'), 'title.en should be required');
  assert(errors.includes('title.hi'), 'title.hi should be required');
  assert(errors.includes('address.areaName'), 'address.areaName should be required');
  assert(errors.includes('address.city'), 'address.city should be required');
  assert(errors.includes('location.coordinates'), 'location.coordinates should be required');
  console.log('✓ Test 4 Passed: All mandatory fields enforced by Mongoose validation');
}

// Test 3: Geospatial Coordinate Limits Validation
{
  const invalidDoc = new Complaint({
    userId: 'uid-123',
    userEmail: 'test@civic.app',
    title: { en: 'Pothole', hi: 'गड्ढा' },
    address: { areaName: 'Malviya Nagar', city: 'Jaipur' },
    location: {
      type: 'Point',
      coordinates: [200, 100], // Longitude > 180, Latitude > 90
    },
  });
  const err = invalidDoc.validateSync();
  assert(err && err.errors['location.coordinates'], 'Should reject out-of-bounds coordinates');
  console.log('✓ Test 5 Passed: Coordinate boundary validator rejected invalid values [200, 100]');
}

// Test 4: Default Values
{
  const validDoc = new Complaint({
    userId: 'uid-123',
    userEmail: 'test@civic.app',
    title: { en: 'Broken streetlight', hi: 'टूटी हुई स्ट्रीट लाइट' },
    address: { areaName: 'Malviya Nagar', city: 'Jaipur' },
    location: {
      type: 'Point',
      coordinates: [75.81, 26.85], // Jaipur [lng, lat]
    },
  });

  assert.strictEqual(validDoc.reportCount, 1, 'Default reportCount should be 1');
  assert.ok(['Submitted', 'Pending'].includes(validDoc.status), 'Default status should be Submitted or Pending');
  assert.strictEqual(validDoc.severity, 'MEDIUM', 'Default severity should be MEDIUM');
  assert.deepStrictEqual(validDoc.boundingBox, [0, 0, 0, 0], 'Default boundingBox should be [0, 0, 0, 0]');
  console.log('✓ Test 6 Passed: Default values (reportCount: 1, status: Submitted/Pending, severity: MEDIUM) assigned');
}

console.log('All Complaint model tests passed successfully!\n');
