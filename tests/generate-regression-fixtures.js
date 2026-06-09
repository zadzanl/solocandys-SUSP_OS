const fs = require('fs');
const path = require('path');
const vm = require('vm');

const indexPath = path.join(__dirname, '..', 'index.html');
const outputPath = path.join(__dirname, 'fixtures', 'regression_suite.json');

console.log(`Loading index.html from: ${indexPath}`);
if (!fs.existsSync(indexPath)) {
  console.error("Error: index.html not found!");
  process.exit(1);
}
const indexHtml = fs.readFileSync(indexPath, 'utf8');

const scriptStartTag = '<script id="app-source" type="text/plain">';
const scriptEndTag = '</script>';

const startIdx = indexHtml.indexOf(scriptStartTag);
if (startIdx === -1) {
  console.error("Error: Could not find start of app-source script tag in index.html");
  process.exit(1);
}
const endIdx = indexHtml.indexOf(scriptEndTag, startIdx);
if (endIdx === -1) {
  console.error("Error: Could not find end of app-source script tag in index.html");
  process.exit(1);
}

const fullScript = indexHtml.slice(startIdx + scriptStartTag.length, endIdx);

const hintIdx = fullScript.indexOf('const Hint=');
if (hintIdx === -1) {
  console.error("Error: Could not find const Hint declaration in app-source");
  process.exit(1);
}
const physicsBlock = fullScript.slice(0, hintIdx);

const gameModeEncIdx = fullScript.indexOf('const GAME_MODE_ENC=');
if (gameModeEncIdx === -1) {
  console.error("Error: Could not find GAME_MODE_ENC in app-source");
  process.exit(1);
}
const useTwoTapIdx = fullScript.indexOf('const useTwoTap=');
if (useTwoTapIdx === -1) {
  console.error("Error: Could not find useTwoTap in app-source");
  process.exit(1);
}
const codecBlock = fullScript.slice(gameModeEncIdx, useTwoTapIdx);

const exportWrapper = `
this.computeTune = computeTune;
this.computeAlignment = computeAlignment;
this.computeDiff = computeDiff;
this.encodeTune = encodeTune;
this.decodeTune = decodeTune;
this.sanitizeTune = sanitizeTune;
this.feelToPhysics = feelToPhysics;
this.DEF_CH = DEF_CH;
this.DEF_FE = DEF_FE;
this.DEF_DR = DEF_DR;
this.DEF_AL = DEF_AL;
this.DEF_BR = DEF_BR;
`;

const sandboxCode = physicsBlock + '\n' + codecBlock + '\n' + exportWrapper;

const sandbox = {
  React: {
    useState: (val) => [val, (x) => {}],
    useMemo: (fn) => fn(),
    useRef: (val) => ({ current: val }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useCallback: (fn) => fn,
  },
  ReactDOM: {},
  btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
  atob: (str) => Buffer.from(str, 'base64').toString('binary'),
  console,
  Math,
  Buffer,
  isNaN,
  isFinite,
  Number,
  String,
  Object,
  Array,
  RegExp,
  parseFloat,
  parseInt,
};

const context = vm.createContext(sandbox);
try {
  vm.runInContext(sandboxCode, context);
} catch (err) {
  console.error("Compilation error in sandboxed script:", err);
  process.exit(1);
}

const requiredFns = [
  'computeTune',
  'computeAlignment',
  'computeDiff',
  'encodeTune',
  'decodeTune',
  'sanitizeTune',
  'feelToPhysics'
];

for (const fnName of requiredFns) {
  if (typeof context[fnName] !== 'function') {
    console.error(`Error: Required function ${fnName} is missing or is not a function!`);
    process.exit(1);
  }
}

const {
  sanitizeTune,
  encodeTune,
  decodeTune,
  feelToPhysics,
  computeTune,
  computeAlignment,
  computeDiff
} = context;

// deep equality check for roundtrip validation
function deepEqual(a, b) {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Object.keys(a).length !== Object.keys(b).length) return false;
    for (const key in a) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

// check outputs for NaN or invalid/null properties
function checkOutputs(name, outputs) {
  for (const [key, val] of Object.entries(outputs)) {
    if (typeof val === 'number' && isNaN(val)) {
      console.error(`Error: Case "${name}" output property "${key}" is NaN!`);
      process.exit(1);
    }
    if (val === undefined || val === null) {
      if (key !== 'balArbSplit') {
        console.error(`Error: Case "${name}" output property "${key}" is ${val}!`);
        process.exit(1);
      }
    }
  }
}

const cases = [];

// Base defaults
const baseCh = {
  weight: 3200,
  frontBias: 52,
  wheelbase: 2.7,
  cgHeight: 0.45,
  trackF: 1.55,
  trackR: 1.52,
  tyreF: '265/35R18',
  tyreR: '265/35R18'
};
const baseFe = {
  rideStiffness: 1.75,
  arbBias: 0,
  dampingBias: 0,
  targetSpeed: 70,
  gameMode: 'horizon',
  dampingMode: 'ratio',
  reboundZeta: 70,
  bumpRatio: 56,
  bumpZeta: 39,
  arbMode: 'auto',
  arbTargetRollMan: 1.8,
  arbShareMan: 15,
  arbFloor: 6,
  arbCeil: 65,
  arbBalTarget: 0.65,
  arbBalMode: 'weight',
  springShare: 50,
  rearHzMode: 'flatRide',
  rearHzMan: 1.5,
  rearHzMult: 1.20,
  rideRef: 'front',
  arbManF: 20,
  arbManR: 20
};
const baseDr = {
  layout: 'RWD',
  buildType: 'track',
  diffManual: false,
  diffComplement: false,
  diffBiasExit: 0,
  diffBiasEntry: 0,
  diffFrontExitBias: 0,
  diffAccel: 35,
  diffDecel: 10,
  diffFrontAccel: 28,
  diffFrontDecel: 0,
  diffRearAccel: 48,
  diffRearDecel: 8,
  diffCenter: 65
};
const baseBr = {
  brakeManual: false,
  brakeBias: 50,
  brakePressure: 100
};

function addCase(name, chOverrides = {}, feOverrides = {}, drOverrides = {}, brOverrides = {}) {
  cases.push({
    name,
    input: {
      ch: { ...baseCh, ...chOverrides },
      fe: { ...baseFe, ...feOverrides },
      dr: { ...baseDr, ...drOverrides },
      br: { ...baseBr, ...brOverrides }
    }
  });
}

// 1. Layout & Build type variations (9 cases)
const layouts = ['FWD', 'RWD', 'AWD'];
const builds = ['street', 'track', 'drift'];
for (const layout of layouts) {
  for (const build of builds) {
    addCase(`Layout: ${layout}, Build: ${build}`, {}, {}, { layout, buildType: build });
  }
}

// 2. Game Mode, Damping Mode & Ride Reference (12 cases)
const gameModes = ['horizon', 'motorsport'];
const dampingModes = ['ratio', 'independent'];
const rideRefs = ['front', 'rear', 'shared'];
for (const gameMode of gameModes) {
  for (const dampingMode of dampingModes) {
    for (const rideRef of rideRefs) {
      addCase(`Game: ${gameMode}, Damping: ${dampingMode}, RideRef: ${rideRef}`, {}, { gameMode, dampingMode, rideRef });
    }
  }
}

// 3. Rear Hz Mode variations (12 cases)
const rearHzModes = ['flatRide', 'independent', 'multiplier', 'mech'];
const rideRefsForHz = ['front', 'rear', 'shared'];
for (const hzMode of rearHzModes) {
  for (const ref of rideRefsForHz) {
    addCase(`RearHzMode: ${hzMode}, RideRef: ${ref}`, {}, { rearHzMode: hzMode, rideRef: ref, rearHzMan: 2.1, rearHzMult: 1.15 });
  }
}

// 4. coSolve, Spring Share & arbBalTarget variations (18 cases)
const springShares = [20, 50, 80];
const arbBalTargets = [0.55, 0.65, 0.75];
for (const sh of springShares) {
  for (const tgt of arbBalTargets) {
    addCase(`coSolve, SpringShare: ${sh}, arbBalTarget: ${tgt}`, {}, { arbBalMode: 'coSolve', springShare: sh, arbBalTarget: tgt });
    addCase(`mech, SpringShare: ${sh}, arbBalTarget: ${tgt}`, {}, { arbBalMode: 'mech', springShare: sh, arbBalTarget: tgt });
  }
}

// 5. ARB Mode variations (12 cases)
const arbModes = ['auto', 'roll', 'share'];
const arbBalModes = ['weight', 'mech', 'coSolve', 'man'];
for (const mode of arbModes) {
  for (const balMode of arbBalModes) {
    addCase(`arbMode: ${mode}, arbBalMode: ${balMode}`, {}, { arbMode: mode, arbBalMode: balMode, arbTargetRollMan: 2.2, arbShareMan: 25 });
  }
}

// 6. Tyre size variations (6 cases)
const tyrePairs = [
  { f: '195/50R15', r: '195/50R15' },
  { f: '225/45R17', r: '255/40R17' },
  { f: '245/35R19', r: '305/30R19' },
  { f: '265/35R18', r: '285/35R18' },
  { f: '275/40R20', r: '315/35R20' },
  { f: '315/30R21', r: '325/30R21' },
];
tyrePairs.forEach((tyres) => {
  addCase(`Tyres: ${tyres.f} / ${tyres.r}`, { tyreF: tyres.f, tyreR: tyres.r });
});

// 7. Chassis dimensions variations (18 cases)
const weights = [1500, 2800, 4200];
const frontBiases = [42, 52, 62];
const cgHeights = [0.35, 0.55];
for (const w of weights) {
  for (const fb of frontBiases) {
    for (const cg of cgHeights) {
      addCase(`Chassis: weight=${w}, frontBias=${fb}, cgHeight=${cg}`, { weight: w, frontBias: fb, cgHeight: cg });
    }
  }
}

// 8. Differential combinations (8 cases)
const diffManuals = [true, false];
const diffComplements = [true, false];
const diffLayouts = ['RWD', 'AWD'];
for (const man of diffManuals) {
  for (const comp of diffComplements) {
    for (const layout of diffLayouts) {
      addCase(`Diff: manual=${man}, complement=${comp}, layout=${layout}`, {}, {}, { diffManual: man, diffComplement: comp, layout });
    }
  }
}

// 9. Brake variations (8 cases)
const brakeManuals = [true, false];
const brakeBiases = [48, 58];
const brakePressures = [90, 130];
for (const man of brakeManuals) {
  for (const bias of brakeBiases) {
    for (const pres of brakePressures) {
      addCase(`Brake: manual=${man}, bias=${bias}, pressure=${pres}`, {}, {}, {}, { brakeManual: man, brakeBias: bias, brakePressure: pres });
    }
  }
}

// 10. Presets on multiple layouts (12 cases)
const presets = [
  { name: 'STREET', fe: { rideStiffness: 1.64, rearHzMode: 'multiplier', rearHzMult: 1.15, reboundZeta: 60, bumpRatio: 50, dampingBias: 8 }, dr: { buildType: 'street', diffBiasExit: -10, diffBiasEntry: 10 } },
  { name: 'TRACK', fe: { rideStiffness: 2.29, rearHzMode: 'multiplier', rearHzMult: 1.05, reboundZeta: 72, bumpRatio: 58, dampingBias: 12 }, dr: { buildType: 'track', diffBiasExit: 5, diffBiasEntry: 0 } },
  { name: 'RALLY', fe: { rideStiffness: 1.29, rearHzMode: 'multiplier', rearHzMult: 1.35, reboundZeta: 65, bumpRatio: 45, dampingBias: -12 }, dr: { buildType: 'street', diffBiasExit: -5, diffBiasEntry: -15 } },
  { name: 'DRIFT', fe: { rideStiffness: 1.39, rearHzMode: 'multiplier', rearHzMult: 1.30, reboundZeta: 63, bumpRatio: 46, dampingBias: 15 }, dr: { buildType: 'drift', layout: 'RWD', diffBiasExit: 22, diffBiasEntry: -18, diffRearAccel: 65, diffRearDecel: 15 } },
  { name: 'MOTORSPT', fe: { rideStiffness: 2.83, rearHzMode: 'multiplier', rearHzMult: 0.95, reboundZeta: 77, bumpRatio: 62, dampingBias: 18 }, dr: { buildType: 'track', diffBiasExit: 10, diffBiasEntry: -5 } },
  { name: 'X COUNTRY', fe: { rideStiffness: 0.98, rearHzMode: 'multiplier', rearHzMult: 1.22, reboundZeta: 55, bumpRatio: 40, dampingBias: 0 }, dr: { buildType: 'street' } }
];
for (const p of presets) {
  for (const layout of ['RWD', 'AWD']) {
    addCase(`Preset: ${p.name}, Layout: ${layout}`, {}, p.fe, { ...p.dr, layout });
  }
}

console.log(`Generated ${cases.length} regression case definitions.`);

// Execute and record
const suite = cases.map((c, idx) => {
  const name = c.name;
  
  // 1. Sanitize
  const sanitized = sanitizeTune(c.input);
  
  // 2. feelToPhysics
  const phys = feelToPhysics(sanitized.ch, sanitized.fe);
  
  // 3. Solvers
  const tune = computeTune(sanitized.ch, phys, sanitized.fe.gameMode);
  const alignment = computeAlignment(sanitized.ch, tune, sanitized.dr.layout, sanitized.dr.buildType);
  const diff = computeDiff(sanitized.ch, sanitized.fe, sanitized.dr);
  
  // 4. Encode & Decode (verify round-trip)
  const code = encodeTune(sanitized.ch, sanitized.fe, sanitized.dr, sanitized.br);
  const decoded = decodeTune(code);
  
  if (!deepEqual(sanitized, decoded)) {
    console.error(`Error: Roundtrip validation failed for case ${idx}: "${name}"`);
    console.error("Sanitized:", JSON.stringify(sanitized, null, 2));
    console.error("Decoded:", JSON.stringify(decoded, null, 2));
    process.exit(1);
  }
  
  // Check outputs for NaN
  checkOutputs(name, tune);
  checkOutputs(name, alignment);
  checkOutputs(name, diff);
  
  return {
    id: idx + 1,
    name,
    input: c.input,
    sanitized,
    shareCode: code,
    outputs: {
      tune,
      alignment,
      diff
    }
  };
});

// Write outputs
const fixturesDir = path.dirname(outputPath);
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(suite, null, 2), 'utf8');
console.log(`Regression fixtures successfully generated at: ${outputPath}`);
console.log(`Processed ${suite.length} cases.`);
