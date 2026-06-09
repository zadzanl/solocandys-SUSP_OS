const fs = require('fs');
const path = require('path');

const physics = require('../src/physics.js');
const codec = require('../src/codec.js');

const { feelToPhysics, computeTune, computeAlignment, computeDiff } = physics;
const { sanitizeTune, encodeTune, decodeTune } = codec;

// List of fields that are exact matches (UI clicks or specific config parameters)
const EXACT_FIELDS = new Set([
  // Sanitized fields
  'weight', 'frontBias', 'wheelbase', 'cgHeight', 'trackF', 'trackR',
  'rideStiffness', 'arbBias', 'arbBalTarget', 'springShare', 'dampingBias', 'targetSpeed',
  'reboundZeta', 'bumpRatio', 'bumpZeta', 'arbTargetRollMan', 'arbShareMan', 'arbFloor', 'arbCeil',
  'rearHzMan', 'rearHzMult', 'arbManF', 'arbManR',
  'diffBiasExit', 'diffBiasEntry', 'diffFrontExitBias', 'diffAccel', 'diffDecel',
  'diffFrontAccel', 'diffFrontDecel', 'diffRearAccel', 'diffRearDecel', 'diffCenter',
  'brakeBias', 'brakePressure',
  // Output UI clicks
  'rebF', 'rebR', 'bumpF', 'bumpR', 'arbF', 'arbR', 'balArbSplit',
  'recCamberF', 'recCamberR', 'recToeF', 'recToeR', 'recCaster',
  'accel', 'decel', 'frontAccel', 'frontDecel', 'rearAccel', 'rearDecel', 'center'
]);

function deepCompare(pathName, actual, expected) {
  if (typeof expected === 'boolean' || typeof expected === 'string' || expected === null || expected === undefined) {
    if (actual !== expected) {
      throw new Error(`Mismatch at ${pathName}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    return;
  }
  
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') {
      throw new Error(`Mismatch at ${pathName}: expected number ${expected}, got ${typeof actual} (${actual})`);
    }
    
    const fieldName = pathName.split('.').pop();
    if (EXACT_FIELDS.has(fieldName)) {
      if (actual !== expected) {
        throw new Error(`Exact mismatch at ${pathName}: expected ${expected}, got ${actual}`);
      }
    } else {
      const diff = Math.abs(actual - expected);
      if (diff > 1e-5) {
        throw new Error(`Tolerance mismatch at ${pathName}: expected ${expected}, got ${actual} (diff: ${diff} > 1e-5)`);
      }
    }
    return;
  }
  
  if (typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') {
      throw new Error(`Mismatch at ${pathName}: expected object, got ${actual}`);
    }
    for (const key of Object.keys(expected)) {
      deepCompare(`${pathName}.${key}`, actual[key], expected[key]);
    }
    for (const key of Object.keys(actual)) {
      if (!(key in expected)) {
        throw new Error(`Unexpected property ${pathName}.${key} in actual output`);
      }
    }
    return;
  }
  
  throw new Error(`Unsupported type for comparison at ${pathName}: ${typeof expected}`);
}

function runRegressionSuite() {
  const suitePath = path.join(__dirname, 'fixtures', 'regression_suite.json');
  console.log(`\nLoading regression suite from: ${suitePath}`);
  if (!fs.existsSync(suitePath)) {
    console.error(`Error: Regression suite file not found at ${suitePath}`);
    process.exit(1);
  }
  
  const rawData = fs.readFileSync(suitePath, 'utf8');
  const suite = JSON.parse(rawData);
  console.log(`Running ${suite.length} regression test cases...`);
  
  let passedCount = 0;
  
  for (const tc of suite) {
    try {
      // 1. Sanitize
      const sanitized = sanitizeTune(tc.input);
      deepCompare(`case[${tc.id}] (${tc.name}).sanitized`, sanitized, tc.sanitized);
      
      // 2. feelToPhysics
      const phys = feelToPhysics(sanitized.ch, sanitized.fe);
      
      // 3. Solvers
      const tune = computeTune(sanitized.ch, phys, sanitized.fe.gameMode);
      deepCompare(`case[${tc.id}] (${tc.name}).outputs.tune`, tune, tc.outputs.tune);
      
      const alignment = computeAlignment(sanitized.ch, tune, sanitized.dr.layout, sanitized.dr.buildType);
      deepCompare(`case[${tc.id}] (${tc.name}).outputs.alignment`, alignment, tc.outputs.alignment);
      
      const diff = computeDiff(sanitized.ch, sanitized.fe, sanitized.dr);
      deepCompare(`case[${tc.id}] (${tc.name}).outputs.diff`, diff, tc.outputs.diff);
      
      // 4. Codec & round-trip validation
      const code = encodeTune(sanitized.ch, sanitized.fe, sanitized.dr, sanitized.br);
      if (code !== tc.shareCode) {
        throw new Error(`case[${tc.id}] (${tc.name}).shareCode mismatch: expected "${tc.shareCode}", got "${code}"`);
      }
      
      const decoded = decodeTune(code);
      // Verify exact round-trip structure matches sanitized
      deepCompare(`case[${tc.id}] (${tc.name}).roundtrip`, decoded, sanitized);
      
      passedCount++;
    } catch (err) {
      console.error(`\n❌ Regression test failed at case ${tc.id}: "${tc.name}"`);
      console.error(err.message);
      process.exit(1);
    }
  }
  
  console.log(`✓  All ${passedCount} regression test cases passed successfully!`);
}

// Run immediately if this file is executed directly
if (require.main === module) {
  runRegressionSuite();
}

module.exports = {
  runRegressionSuite
};
