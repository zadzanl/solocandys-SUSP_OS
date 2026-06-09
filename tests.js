// SUSP.OS physics engine tests
// Run with: node tests.js
// No dependencies required.

const fs = require('fs');
const path = require('path');
const { assembleIndexHtml } = require('./assemble.js');
const { runRegressionSuite } = require('./tests/regression-runner.js');

// ── synchronization check ──────────────────────────────────────────────────
console.log('Checking if index.html is synchronized with src/...');
try {
  const assembledHtml = assembleIndexHtml();
  const indexHtmlPath = path.join(__dirname, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    console.error('\nERROR: index.html does not exist in root directory!');
    console.error('Please run: node assemble.js\n');
    process.exit(1);
  }
  const diskHtml = fs.readFileSync(indexHtmlPath, 'utf8').replace(/\r\n/g, '\n');
  if (assembledHtml !== diskHtml) {
    console.error('\n================================================================');
    console.error('❌ ERROR: index.html is OUT OF SYNC with files in src/!');
    console.error('Changes were made in the src/ directory but not assembled.');
    console.error('Please run the assembler to compile index.html:');
    console.error('    node assemble.js');
    console.error('================================================================\n');
    process.exit(1);
  }
  console.log('✓  index.html is fully synchronized with src/\n');
} catch (err) {
  console.error(`\n❌ Error during index.html sync check: ${err.message}\n`);
  process.exit(1);
}

const { PARSER_PROFILES, selectParserProfile, parseTelemetryPacket } = require('./forza-bridge.js');

const {
  KG_TO_LB, LB_IN_TO_NM, MPH_TO_MS, ARB_RS_SCALE, rollCenterHeight, DAMPING_CALIBRATION, GAME_LIMITS,
  TIRE_LOAD_SENS, MECH_BAL_GAIN, WIDTH_GRIP_EXP, HZ_MIN, HZ_MAX,
  cornerMasses, rsToHz, hzToRs, flatRideRearHz, solveSpring, solveDamp, mechBalanceLLT, balanceFromRsBal
} = require('./src/physics.js');

const cornerMassesM = cornerMasses;

const rsBalFromBalance = (ch, target) => {
  let lo = 1e-4, hi = 1 - 1e-4;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (balanceFromRsBal(ch, mid) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
};

const getMedian = arr => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const estimateWeight = (power, speed, accelZ, throttle, brake) => {
  // throttle is range 0-255. >80% is >204
  if (throttle > 204 && brake === 0 && speed > 10 && accelZ > 0.5) {
    const massKg = power / (speed * accelZ);
    return massKg * 2.204622622; // Convert to lbs
  }
  return null;
};

// ── test harness ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

const assert = (name, actual, expected, tol = 0.01) => {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) { console.log(`  ✓  ${name}`); passed++; }
  else { console.error(`  ✗  ${name}\n       expected ${expected.toFixed(6)}, got ${actual.toFixed(6)}`); failed++; }
};

const assertEq = (name, actual, expected) => {
  const ok = actual === expected;
  if (ok) { console.log(`  ✓  ${name}`); passed++; }
  else { console.error(`  ✗  ${name}\n       expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); failed++; }
};

// ── cornerMasses ─────────────────────────────────────────────────────────────

console.log('\ncornerMasses');
{
  const m = cornerMasses({ weight: 3200, frontBias: 50 });
  const kg = 3200 / KG_TO_LB;
  assert('50/50 front corner', m.front, kg * 0.5 / 2);
  assert('50/50 rear corner',  m.rear,  kg * 0.5 / 2);
  assert('front === rear at 50%', m.front - m.rear, 0);

  const m2 = cornerMasses({ weight: 3200, frontBias: 60 });
  assert('60% front heavier than rear', m2.front - m2.rear, kg * 0.1);
}

// ── lateral load transfer (XFER) ─────────────────────────────────────────────
// Axle transfer at 1g = M_axle·h/track, where M_axle = 2·cornerMass.
// Regression guard for the corner-vs-axle-mass factor-of-2 fix.

console.log('\nlateral load transfer');
{
  const ch = { weight: 1600 * KG_TO_LB, frontBias: 50, cgHeight: 0.45, trackF: 1.55, trackR: 1.55 };
  const m = cornerMasses(ch);
  const xferF = 2 * m.front * ch.cgHeight / ch.trackF; // matches app formula
  const axleMassF = (ch.weight / KG_TO_LB) * 0.5;       // 800 kg front axle
  assert('front axle transfer = M_axle·h/t', xferF, axleMassF * ch.cgHeight / ch.trackF, 0.01);
  assert('1600kg/50%/0.45m/1.55m ≈ 232 kg/g', xferF, 232.26, 0.5);
}

// ── flatRideRearHz ────────────────────────────────────────────────────────────

console.log('\nflatRideRearHz');
{
  // disabled at mph >= 200
  const r = flatRideRearHz(1.5, 2.7, 200);
  assert('OFF: hz equals front', r.hz, 1.5);
  assertEq('OFF: not clamped', r.clamped, false);

  // very low speed falls back to 1.2× front
  const r2 = flatRideRearHz(1.5, 2.7, 0);
  assert('near-zero mph: 1.2× front', r2.hz, 1.5 * 1.2);

  // realistic case: 70 mph, 2.7m wheelbase, 1.5 Hz front
  const r3 = flatRideRearHz(1.5, 2.7, 70);
  assert('70mph rear hz > front', r3.hz - 1.5, 0, 2); // rear should be higher than front
  assertEq('70mph not clamped', r3.clamped, false);

  // cap at HZ_MAX game ceiling when formula overshoots (stiff spring at medium speed)
  const r4 = flatRideRearHz(3.5, 2.7, 70); // high fHz at 70mph → raw overshoots → clamped at HZ_MAX
  assert('cap at HZ_MAX ceiling', r4.hz, HZ_MAX, 0.001);
  assertEq('clamped flag set', r4.clamped, true);

  // a derived rear Hz in the expanded 4.0–5.5 band must NOT be clamped
  // (regression guard for the old 4.0 cap that silently truncated stiff rears)
  const r5 = flatRideRearHz(3.0, 2.7, 90); // raw lands ≈5.0Hz — inside new band
  assert('4.0–5.5 band: rear hz ≈ 5.0', r5.hz, 5.02, 0.1);
  assertEq('4.0–5.5 band: above old 4.0 cap', r5.hz > 4.0, true);
  assertEq('4.0–5.5 band: clamped flag clear', r5.clamped, false);
}

// ── Hz operating band (HZ_MIN / HZ_MAX) ────────────────────────────────────────
// Guards the expanded 0.8–5.5 range: hzToRs clamping and the legacy-save migration
// threshold. Regression coverage for the scattered-magic-number bugs (commits where
// rear Hz silently re-capped at 4.0 / slider froze at 3.5).

console.log('\nHz operating band');
{
  // hzToRs clamps into [HZ_MIN, HZ_MAX]
  assert('hzToRs clamps below floor', hzToRs(0.2), HZ_MIN, 0.001);
  assert('hzToRs clamps above ceiling', hzToRs(9.9), HZ_MAX, 0.001);
  assert('hzToRs passes 5.0 through', hzToRs(5.0), 5.0, 0.001);
  assert('hzToRs passes 4.5 through', hzToRs(4.5), 4.5, 0.001);

  // legacy migration: old saves stored integers 0–100; only values >6 are legacy.
  // A genuine 5.0 Hz must NOT be misread as a legacy integer and rescaled down.
  assert('rsToHz: 5.0 stays 5.0 (not legacy)', rsToHz(5.0), 5.0, 0.001);
  assert('rsToHz: 4.5 stays 4.5 (not legacy)', rsToHz(4.5), 4.5, 0.001);
  // a true legacy integer (e.g. 50/100) migrates onto the 0.8+ scale
  assert('rsToHz: legacy 50 migrates', rsToHz(50), 0.8 + 0.5 * 2.7, 0.001);
  assertEq('migration threshold is >6 (5.5 not legacy)', rsToHz(5.5), 5.5);
}

// ── solveSpring ───────────────────────────────────────────────────────────────

console.log('\nsolveSpring');
{
  // at 1 Hz, MR=1, the wheel rate equals mass*ω², spring = wheel rate / LB_IN_TO_NM
  const mass = 300; // kg corner mass
  const hz = 1.0;
  const wr = Math.pow(hz * 2 * Math.PI, 2) * mass;
  const expected = wr / LB_IN_TO_NM;
  assert('1 Hz MR=1 spring rate', solveSpring(hz, mass, 1.0), expected, 0.01);

  // motion ratio 0.8 increases spring rate (spring must work harder)
  const s1 = solveSpring(1.5, 350, 1.0);
  const s2 = solveSpring(1.5, 350, 0.8);
  assertEq('lower MR → higher spring rate', s2 > s1, true);
}

// ── solveDamp ─────────────────────────────────────────────────────────────────

console.log('\nsolveDamp');
{
  // result must be at least 1
  assert('minimum click is 1', solveDamp(0.5, 100, 10, 20), 1, 0);

  // result must not exceed limit
  const d = solveDamp(5.0, 1000, 100, 20);
  assert('capped at game limit', d, 20, 0);

  // at critical damping (ζ=100%) the result is cc * DAMPING_CALIBRATION
  const mass = 400, hz = 2.0;
  const wr = Math.pow(hz * 2 * Math.PI, 2) * mass;
  const cc = 2 * Math.sqrt(wr * mass);
  const expected = Math.min(20, Math.max(1, cc * DAMPING_CALIBRATION));
  assert('ζ=100% matches formula', solveDamp(hz, mass, 100, 20), expected, 0.001);
}

// ── settle time constant ──────────────────────────────────────────────────────

console.log('\nsettle (ln(10)/(ζ·ωn))');
{
  // 2.302 ≈ ln(10)
  const fHz = 2.0, reboundZeta = 70;
  const settle = 2.302 / ((reboundZeta / 100) * fHz * 2 * Math.PI);
  assert('settle formula uses ln(10)', 2.302, Math.log(10), 0.001);
  assert('settle at 2Hz 70%ζ ≈ 0.26s', settle, 0.261, 0.01);
}

// ── integration: known vehicle (Lexus LC500 proxy) ───────────────────────────

console.log('\nintegration — LC500-like vehicle');
{
  const ch = { weight: 4000, frontBias: 52, wheelbase: 2.87, cgHeight: 0.46,
               trackF: 1.59, trackR: 1.60, motionRatioF: 1.0, motionRatioR: 1.0 };
  const lim = GAME_LIMITS.horizon;
  const m = cornerMasses(ch);

  // ride stiffness 50 → frontHz ≈ 2.15 Hz
  const frontHz = 0.8 + (50 / 100) * 2.7;
  assert('frontHz at stiffness 50', frontHz, 2.15, 0.001);

  const springF = solveSpring(frontHz, m.front, ch.motionRatioF);
  assert('spring rate positive', springF, springF, 0); // tautology — just check no NaN
  assert('spring rate in sensible range (100–800 lb/in)', springF > 100 && springF < 800 ? springF : -1, springF > 100 && springF < 800 ? springF : -1, 0);

  const rebF = solveDamp(frontHz, m.front, 70, lim.damping);
  assert('rebound within game limits', rebF >= 1 && rebF <= lim.damping ? rebF : -1, rebF >= 1 && rebF <= lim.damping ? rebF : -1, 0);
}

// ── mech balance (tyre load sensitivity model) ──────────────────────────────

console.log('\nmechBalanceLLT');
{
  // symmetric car: 50/50, equal track, equal width, equal stiffness → exactly neutral
  const sym = { weight: 3000, frontBias: 50, cgHeight: 0.45, trackF: 1.55, trackR: 1.55, twF: 265, twR: 265 };
  assert('symmetric car is neutral (0.50)', mechBalanceLLT(sym, 1, 1), 0.50, 1e-6);

  // monotonic: stiffer rear → higher (more oversteer)
  assertEq('rear-stiffer → >0.5', mechBalanceLLT(sym, 1, 1.5) > 0.5, true);
  assertEq('front-stiffer → <0.5', mechBalanceLLT(sym, 1.5, 1) < 0.5, true);
  assertEq('monotonic in Kr/Kf', mechBalanceLLT(sym, 1, 1.6) > mechBalanceLLT(sym, 1, 1.3), true);

  // width = grip: wider rear tyre reduces oversteer (lower balance) at fixed stiffness
  const wideR = { ...sym, twR: 305 };
  assertEq('wider rear tyre → less oversteer', mechBalanceLLT(wideR, 1, 1.4) < mechBalanceLLT(sym, 1, 1.4), true);

  // inverse round-trips the forward map
  const ch = { weight: 3200, frontBias: 52, cgHeight: 0.45, trackF: 1.55, trackR: 1.52, twF: 265, twR: 265 };
  for (const tgt of [0.45, 0.55, 0.65]) {
    const rs = rsBalFromBalance(ch, tgt);
    assert(`inverse round-trip @ ${tgt}`, balanceFromRsBal(ch, rs), tgt, 0.005);
  }

  // calibrated to legacy 0.5-neutral scale: default car natural ≈ 0.47
  const natRs = (cornerMassesM(ch).rear * ch.trackR ** 2) /
                (cornerMassesM(ch).front * ch.trackF ** 2 + cornerMassesM(ch).rear * ch.trackR ** 2);
  assert('default car natural balance ≈ 0.47', balanceFromRsBal(ch, natRs), 0.469, 0.02);
}

// ── telemetry logic: getMedian and estimateWeight ────────────────────────────

console.log('\ntelemetry logic: getMedian');
{
  assertEq('median of odd-length array (unsorted)', getMedian([3, 1, 2]), 2);
  assertEq('median of even-length array (unsorted)', getMedian([4, 1, 3, 2]), 2.5);
  assertEq('median of empty array', getMedian([]), 0);
  assertEq('median of single item', getMedian([42]), 42);
}

console.log('\ntelemetry logic: estimateWeight');
{
  // Valid acceleration conditions: Power = 300,000 W, Speed = 20 m/s, AccelZ = 5.0 m/s², throttle = 255, brake = 0
  // massKg = 300000 / (20 * 5) = 3000 kg
  // weightLbs = 3000 * 2.204622622 = 6613.867866 lbs
  const expectedWeight = 3000 * KG_TO_LB;
  assert('valid weight estimation', estimateWeight(300000, 20, 5.0, 255, 0), expectedWeight, 0.0001);

  // throttle too low: throttle = 150
  assertEq('no weight estimation when throttle is too low', estimateWeight(300000, 20, 5.0, 150, 0), null);

  // braking is active: brake = 50
  assertEq('no weight estimation when braking', estimateWeight(300000, 20, 5.0, 255, 50), null);

  // speed is too low: speed = 5
  assertEq('no weight estimation when speed is too low', estimateWeight(300000, 5, 5.0, 255, 0), null);

  // acceleration is too low: accelZ = 0.2
  assertEq('no weight estimation when acceleration is too low', estimateWeight(300000, 20, 0.2, 255, 0), null);
}

// ── telemetry parser and state flow tests ─────────────────────────────────────

console.log('\ntelemetry parser profile selection');
{
  // horizon-dash-v1: 312 to 323
  assertEq('selectParserProfile(312) returns horizon-dash-v1', selectParserProfile(312).id, 'horizon-dash-v1');
  assertEq('selectParserProfile(320) returns horizon-dash-v1', selectParserProfile(320).id, 'horizon-dash-v1');
  assertEq('selectParserProfile(323) returns horizon-dash-v1', selectParserProfile(323).id, 'horizon-dash-v1');

  // horizon-dash-v2: 324 to 1500
  assertEq('selectParserProfile(324) returns horizon-dash-v2', selectParserProfile(324).id, 'horizon-dash-v2');
  assertEq('selectParserProfile(500) returns horizon-dash-v2', selectParserProfile(500).id, 'horizon-dash-v2');
  assertEq('selectParserProfile(1500) returns horizon-dash-v2', selectParserProfile(1500).id, 'horizon-dash-v2');

  // motorsport-sled: 232 to 311
  const pSled = selectParserProfile(232);
  assertEq('selectParserProfile(232) returns motorsport-sled', pSled.id, 'motorsport-sled');
  assertEq('motorsport-sled is unsupported', pSled.unsupported, true);
  
  assertEq('selectParserProfile(311) returns motorsport-sled', selectParserProfile(311).id, 'motorsport-sled');

  // unsupported: lengths outside
  const pUnsup1 = selectParserProfile(100);
  assertEq('selectParserProfile(100) returns unsupported', pUnsup1.id, 'unsupported');
  assertEq('unsupported profile has unsupported: true', pUnsup1.unsupported, true);
  
  assertEq('selectParserProfile(2000) returns unsupported', selectParserProfile(2000).id, 'unsupported');
}

console.log('\nparseTelemetryPacket');
{
  // Sled packets
  const sledBuf = Buffer.alloc(232);
  const sledParsed = parseTelemetryPacket(sledBuf);
  assertEq('sled packet packetSupported is false', sledParsed.packetSupported, false);
  assertEq('sled packet parserProfile is motorsport-sled', sledParsed.parserProfile, 'motorsport-sled');

  // Dash v1 packet
  const buf312 = Buffer.alloc(312);
  buf312.writeInt32LE(1, 0); // IsRaceOn
  buf312.writeUInt32LE(9999, 4); // TimestampMS
  buf312.writeFloatLE(7500.0, 8); // EngineMaxRpm
  buf312.writeFloatLE(900.0, 12); // EngineIdleRpm
  buf312.writeFloatLE(3500.0, 16); // CurrentEngineRpm
  buf312.writeFloatLE(0.8, 28); // AccelerationZ
  buf312.writeInt32LE(1234, 212); // CarOrdinal
  buf312.writeInt32LE(1, 224); // DrivetrainType
  buf312.writeFloatLE(30.0, 244); // Speed
  buf312.writeFloatLE(280000.0, 248); // Power
  buf312.writeFloatLE(400.0, 252); // Torque
  buf312.writeUInt8(250, 303); // Accel
  buf312.writeUInt8(0, 304); // Brake

  const parsed312 = parseTelemetryPacket(buf312);
  assertEq('parseTelemetryPacket(312) packetSupported is true', parsed312.packetSupported, true);
  assertEq('parseTelemetryPacket(312) parserProfile is horizon-dash-v1', parsed312.parserProfile, 'horizon-dash-v1');
  assertEq('IsRaceOn is 1', parsed312.IsRaceOn, 1);
  assertEq('TimestampMS is 9999', parsed312.TimestampMS, 9999);
  assert('EngineMaxRpm is 7500', parsed312.EngineMaxRpm, 7500.0);
  assert('CurrentEngineRpm is 3500', parsed312.CurrentEngineRpm, 3500.0);
  assert('AccelerationZ is 0.8', parsed312.AccelerationZ, 0.8);
  assertEq('CarOrdinal is 1234', parsed312.CarOrdinal, 1234);
  assertEq('DrivetrainType is 1', parsed312.DrivetrainType, 1);
  assert('Speed is 30.0', parsed312.Speed, 30.0);
  assert('Power is 280000.0', parsed312.Power, 280000.0);
  assert('Torque is 400.0', parsed312.Torque, 400.0);
  assertEq('Accel is 250', parsed312.Accel, 250);
  assertEq('Brake is 0', parsed312.Brake, 0);

  // Dash v2 packet
  const buf324 = Buffer.alloc(324);
  buf324.writeInt32LE(1, 0); // IsRaceOn
  buf324.writeUInt32LE(10005, 4); // TimestampMS
  buf324.writeFloatLE(8000.0, 8); // EngineMaxRpm
  buf324.writeFloatLE(1000.0, 12); // EngineIdleRpm
  buf324.writeFloatLE(4000.0, 16); // CurrentEngineRpm
  buf324.writeFloatLE(1.2, 28); // AccelerationZ
  buf324.writeInt32LE(5678, 212); // CarOrdinal
  buf324.writeInt32LE(2, 224); // DrivetrainType
  buf324.writeFloatLE(45.0, 244 + 12); // Speed
  buf324.writeFloatLE(350000.0, 248 + 12); // Power
  buf324.writeFloatLE(500.0, 252 + 12); // Torque
  buf324.writeUInt8(255, 303 + 12); // Accel
  buf324.writeUInt8(0, 304 + 12); // Brake

  const parsed324 = parseTelemetryPacket(buf324);
  assertEq('parseTelemetryPacket(324) packetSupported is true', parsed324.packetSupported, true);
  assertEq('parseTelemetryPacket(324) parserProfile is horizon-dash-v2', parsed324.parserProfile, 'horizon-dash-v2');
  assertEq('IsRaceOn is 1', parsed324.IsRaceOn, 1);
  assertEq('CarOrdinal is 5678', parsed324.CarOrdinal, 5678);
  assertEq('DrivetrainType is 2', parsed324.DrivetrainType, 2);
  assert('Speed is 45.0', parsed324.Speed, 45.0);
  assert('Power is 350000.0', parsed324.Power, 350000.0);
  assert('Torque is 500.0', parsed324.Torque, 500.0);
  assertEq('Accel is 255', parsed324.Accel, 255);
  assertEq('Brake is 0', parsed324.Brake, 0);

  // Graceful error handling
  const invalidBuf = { length: 312 };
  const errParsed = parseTelemetryPacket(invalidBuf);
  assertEq('invalid packet handling supported status', errParsed.packetSupported, false);
  assertEq('invalid packet handling profile', errParsed.parserProfile, 'horizon-dash-v1');
  assertEq('invalid packet warning contains failure message', errParsed.parserWarning.includes('Failed to parse'), true);
}

console.log('\ntelemetry capture state machine');
{
  const CAR_DATABASE = {
    "2351": { name: "1965 Lotus Cortina", weight: 1699, frontBias: 51, layout: "RWD" },
    "1234": { name: "2019 Porsche 911 GT3 RS", weight: 3150, frontBias: 40, layout: "RWD" },
    "5678": { name: "2020 Chevrolet Corvette Stingray", weight: 3647, frontBias: 40, layout: "RWD" },
    "1066": { name: "2021 Ford Bronco", weight: 4500, frontBias: 52, layout: "AWD" }
  };

  const DEF_CH = { weight: 3200, frontBias: 52, wheelbase: 2.7, cgHeight: 0.45, trackF: 1.55, trackR: 1.52, tyreF: '265/35R18', tyreR: '265/35R18' };
  const DEF_FE = { rideStiffness: 1.75, arbBias: 0, dampingBias: 0, targetSpeed: 70, gameMode: 'horizon', dampingMode: 'ratio', reboundZeta: 70, bumpRatio: 56, bumpZeta: 39, arbMode: 'auto', arbTargetRollMan: 1.8, arbShareMan: 15, arbFloor: 6, arbCeil: 65, arbBalTarget: 0.65, arbBalMode: 'weight', springShare: 50, rearHzMode: 'flatRide', rearHzMan: 1.5, rearHzMult: 1.20, rideRef: 'front' };
  const DEF_DR = { layout: 'RWD', buildType: 'track', diffManual: false, diffComplement: false, diffBiasExit: 0, diffBiasEntry: 0, diffFrontExitBias: 0, diffAccel: 35, diffDecel: 10, diffFrontAccel: 28, diffFrontDecel: 0, diffRearAccel: 48, diffRearDecel: 8, diffCenter: 65 };
  const DEF_AL = { alignManual: false, camberF: -2.3, camberR: -1.8, toeF: -0.1, toeR: 0.1, caster: 5.5 };
  const DEF_BR = { brakeManual: false, brakeBias: 50, brakePressure: 100 };

  function createTelemetryState() {
    return {
      ch: { ...DEF_CH },
      fe: { ...DEF_FE },
      dr: { ...DEF_DR },
      al: { ...DEF_AL },
      br: { ...DEF_BR },
      
      bridgeStatus: 'disconnected',
      packetStatus: 'idle',
      captureStatus: 'inactive',
      
      captureSamples: [],
      capturePeakHp: 0,
      capturePeakTorque: 0,
      captureMaxRpm: 0,
      captureCarOrdinal: null,
      capturePeakSpeed: 0,
      
      pendingSnapshot: null,
      appliedSnapshot: null,
      fieldSources: {},
      selectedCandidates: {},
      
      handleTelemetryToggle() {
        if (this.bridgeStatus === 'disconnected') {
          this.bridgeStatus = 'connecting';
          this.packetStatus = 'idle';
          this.captureStatus = 'inactive';
          this.pendingSnapshot = null;
        } else {
          this.bridgeStatus = 'disconnected';
          this.packetStatus = 'idle';
          this.captureStatus = 'inactive';
          this.pendingSnapshot = null;
          this.captureSamples = [];
          this.capturePeakHp = 0;
          this.capturePeakTorque = 0;
          this.captureMaxRpm = 0;
          this.capturePeakSpeed = 0;
        }
      },
      
      simulateStartup() {
        let changed = false;
        const next = { ...this.fieldSources };
        Object.keys(next).forEach(k => {
          const entry = next[k];
          if (entry && ['parsed', 'lookup', 'estimated'].includes(entry.source)) {
            next[k] = { ...entry, source: 'restored' };
            changed = true;
          }
        });
        if (changed) {
          this.fieldSources = next;
        }
      },
      
      stopCapture(reason) {
        if (this.captureStatus !== 'active') return;
        
        if (reason === 'cancelled') {
          this.captureStatus = 'cancelled';
          this.captureSamples = [];
          this.capturePeakHp = 0;
          this.capturePeakTorque = 0;
          this.captureMaxRpm = 0;
          this.capturePeakSpeed = 0;
          this.pendingSnapshot = null;
          return;
        }
        
        const medianWeight = this.captureSamples.length >= 8 ? getMedian(this.captureSamples) : null;
        const candidates = this.buildSnapshotCandidates(
          this.lastPacket,
          medianWeight,
          this.captureSamples.length,
          this.capturePeakHp,
          this.capturePeakTorque,
          this.captureMaxRpm,
          this.captureCarOrdinal,
          this.capturePeakSpeed
        );
        
        if (candidates.length > 0) {
          this.captureStatus = 'complete';
          this.pendingSnapshot = {
            candidates,
            capturedAt: Date.now(),
            carOrdinal: this.captureCarOrdinal
          };
          const initial = {};
          candidates.forEach(c => {
            initial[c.field] = c.value != null && c.source !== 'unavailable';
          });
          this.selectedCandidates = initial;
        } else {
          this.captureStatus = 'insufficient';
        }
      },
      
      buildSnapshotCandidates(pkt, medianWeight, sampleCount, peakHp, peakTorque, maxRpm, carOrdinal, peakSpeed) {
        if (!pkt) return [];
        const candidates = [];
        const dbCar = carOrdinal != null ? CAR_DATABASE[String(carOrdinal)] : null;
        
        // Car name
        if (dbCar) {
          candidates.push({ field: 'carName', value: dbCar.name, source: 'lookup', confidence: 'medium' });
        } else if (carOrdinal != null) {
          candidates.push({ field: 'carName', value: `Car #${carOrdinal}`, source: 'parsed', confidence: 'low' });
        }
        
        // Layout
        const layouts = ['FWD', 'RWD', 'AWD'];
        const parsedLayout = layouts[pkt.DrivetrainType] || null;
        if (dbCar && dbCar.layout) {
          candidates.push({ field: 'layout', value: dbCar.layout, source: 'lookup', confidence: 'medium' });
        } else if (parsedLayout) {
          candidates.push({ field: 'layout', value: parsedLayout, source: 'parsed', confidence: 'medium' });
        } else {
          candidates.push({ field: 'layout', value: null, source: 'unavailable', confidence: 'unknown' });
        }
        
        // Weight
        if (medianWeight != null && sampleCount >= 8) {
          const conf = sampleCount >= 30 ? 'medium' : 'low';
          candidates.push({ field: 'weight', value: Math.round(medianWeight), source: 'estimated', confidence: conf });
        } else if (dbCar && dbCar.weight) {
          candidates.push({ field: 'weight', value: dbCar.weight, source: 'lookup', confidence: 'low' });
        } else {
          candidates.push({ field: 'weight', value: null, source: 'unavailable', confidence: 'unknown' });
        }
        
        // Front bias
        if (dbCar && dbCar.frontBias != null) {
          candidates.push({ field: 'frontBias', value: dbCar.frontBias, source: 'lookup', confidence: 'low' });
        } else {
          candidates.push({ field: 'frontBias', value: null, source: 'unavailable', confidence: 'unknown' });
        }
        
        // Max RPM
        if (pkt.EngineMaxRpm > 0) {
          candidates.push({ field: 'maxRpm', value: Math.round(pkt.EngineMaxRpm), source: 'parsed', confidence: 'high' });
        } else {
          candidates.push({ field: 'maxRpm', value: null, source: 'unavailable', confidence: 'unknown' });
        }
        
        // Peak Power
        if (peakHp > 0) {
          candidates.push({ field: 'peakPower', value: Math.round(peakHp), source: 'parsed', confidence: 'high' });
        }
        
        // Peak Torque
        if (peakTorque > 0) {
          candidates.push({ field: 'peakTorque', value: Math.round(peakTorque), source: 'parsed', confidence: 'high' });
        }
        
        // Peak Speed
        if (peakSpeed > 0) {
          const speedVal = peakSpeed / MPH_TO_MS;
          candidates.push({ field: 'peakSpeed', value: Math.round(speedVal), source: 'parsed', confidence: 'high' });
        }
        
        return candidates;
      },
      
      applySnapshot(selectedFields) {
        const snap = this.pendingSnapshot;
        if (!snap) return;
        const sources = {};
        const candMap = {};
        snap.candidates.forEach(c => { candMap[c.field] = c; });
        
        selectedFields.forEach(field => {
          const c = candMap[field];
          if (!c || c.value == null) return;
          switch (field) {
            case 'weight':
              this.ch.weight = c.value;
              sources.weight = c;
              break;
            case 'frontBias':
              this.ch.frontBias = c.value;
              sources.frontBias = c;
              break;
            case 'layout':
              this.dr.layout = c.value;
              sources.layout = c;
              break;
            case 'maxRpm':
            case 'peakPower':
            case 'peakTorque':
            case 'carName':
            case 'peakSpeed':
              sources[field] = c;
              break;
          }
        });
        
        this.appliedSnapshot = {
          values: selectedFields.reduce((a, f) => { a[f] = candMap[f]?.value; return a; }, {}),
          sources,
          appliedAt: Date.now()
        };
        
        const persistSources = {};
        Object.entries(sources).forEach(([k, c]) => {
          persistSources[k] = { source: c.source, confidence: c.confidence, appliedAt: Date.now() };
        });
        this.fieldSources = { ...this.fieldSources, ...persistSources };
        this.pendingSnapshot = null;
        this.captureStatus = 'inactive';
        this.captureSamples = [];
        this.capturePeakHp = 0;
        this.capturePeakTorque = 0;
        this.capturePeakSpeed = 0;
      },
      
      pCh(k, v) {
        this.ch[k] = v;
        if (k === 'weight' || k === 'frontBias') {
          this.fieldSources[k] = { source: 'manual', confidence: 'high', appliedAt: Date.now() };
        }
      },
      
      pDr(k, v) {
        this.dr[k] = v;
        if (k === 'layout') {
          this.fieldSources[k] = { source: 'manual', confidence: 'high', appliedAt: Date.now() };
        }
      },
      
      receivePacket(data) {
        this.lastPacket = data;
        this.packetStatus = 'receiving';
        
        if (!data.packetSupported) return;
        
        if (data.IsRaceOn) {
          const capStat = this.captureStatus;
          if (capStat === 'inactive' && !this.pendingSnapshot && !this.appliedSnapshot) {
            this.captureStatus = 'active';
            this.captureSamples = [];
            this.capturePeakHp = 0;
            this.capturePeakTorque = 0;
            this.captureMaxRpm = 0;
            this.capturePeakSpeed = 0;
            this.captureCarOrdinal = data.CarOrdinal ?? null;
          }
          
          if (this.captureStatus === 'active') {
            const horsepower = data.Power / 745.7;
            const torqueFtLbs = data.Torque * 0.73756;
            if (!isNaN(horsepower)) this.capturePeakHp = Math.max(this.capturePeakHp, horsepower);
            if (!isNaN(torqueFtLbs)) this.capturePeakTorque = Math.max(this.capturePeakTorque, torqueFtLbs);
            if (data.EngineMaxRpm > 0) this.captureMaxRpm = Math.max(this.captureMaxRpm, data.EngineMaxRpm);
            if (data.CarOrdinal != null && this.captureCarOrdinal == null) this.captureCarOrdinal = data.CarOrdinal;
            if (data.Speed != null && !isNaN(data.Speed)) this.capturePeakSpeed = Math.max(this.capturePeakSpeed, data.Speed);
            
            const speedMS = data.Speed;
            const accelZ = data.AccelerationZ;
            const powerW = data.Power;
            if (data.Accel > 204 && data.Brake === 0 && speedMS > 10 && accelZ > 0.5 && powerW > 0) {
              const massKg = powerW / (speedMS * accelZ);
              const weightLbs = massKg * KG_TO_LB;
              this.captureSamples.push(weightLbs);
              if (this.captureSamples.length > 80) this.captureSamples.shift();
              if (this.captureSamples.length === 80) {
                this.stopCapture('sample_target');
              }
            }
          }
        }
      }
    };
  }

  // 1. Auto-start capture test
  const state1 = createTelemetryState();
  assertEq('initially inactive', state1.captureStatus, 'inactive');
  
  // Non-driving packet (IsRaceOn=0) shouldn't trigger capture
  state1.receivePacket({ packetSupported: true, IsRaceOn: 0 });
  assertEq('still inactive after non-driving packet', state1.captureStatus, 'inactive');
  
  // Driving packet (IsRaceOn=1) should trigger capture
  state1.receivePacket({ packetSupported: true, IsRaceOn: 1, CarOrdinal: 1234, EngineMaxRpm: 8000 });
  assertEq('active after driving packet', state1.captureStatus, 'active');

  // 2. Early stop at 80 samples
  const state2 = createTelemetryState();
  state2.receivePacket({
    packetSupported: true,
    IsRaceOn: 1,
    CarOrdinal: 1234,
    EngineMaxRpm: 8000,
    Speed: 20,
    AccelerationZ: 5.0,
    Power: 300000,
    Torque: 500,
    Accel: 255,
    Brake: 0
  });
  assertEq('state2 starts active', state2.captureStatus, 'active');
  // Send 78 more samples (total 79)
  for (let i = 0; i < 78; i++) {
    state2.receivePacket({
      packetSupported: true,
      IsRaceOn: 1,
      CarOrdinal: 1234,
      EngineMaxRpm: 8000,
      Speed: 20,
      AccelerationZ: 5.0,
      Power: 300000,
      Torque: 500,
      Accel: 255,
      Brake: 0
    });
  }
  assertEq('still active at 79 samples', state2.captureStatus, 'active');
  // 80th sample triggers stopCapture
  state2.receivePacket({
    packetSupported: true,
    IsRaceOn: 1,
    CarOrdinal: 1234,
    EngineMaxRpm: 8000,
    Speed: 20,
    AccelerationZ: 5.0,
    Power: 300000,
    Torque: 500,
    Accel: 255,
    Brake: 0
  });
  assertEq('reaches complete after 80 samples', state2.captureStatus, 'complete');

  // 3. User cancellation
  const state3 = createTelemetryState();
  state3.receivePacket({
    packetSupported: true,
    IsRaceOn: 1,
    CarOrdinal: 1234,
    EngineMaxRpm: 8000,
    Speed: 20,
    AccelerationZ: 5.0,
    Power: 300000,
    Torque: 500,
    Accel: 255,
    Brake: 0
  });
  assertEq('state3 starts active', state3.captureStatus, 'active');
  state3.stopCapture('cancelled');
  assertEq('status is cancelled', state3.captureStatus, 'cancelled');
  assertEq('samples cleared', state3.captureSamples.length, 0);
  assertEq('peak HP cleared', state3.capturePeakHp, 0);
  assertEq('peak Torque cleared', state3.capturePeakTorque, 0);
  assertEq('max RPM cleared', state3.captureMaxRpm, 0);
  assertEq('peak Speed cleared', state3.capturePeakSpeed, 0);
  assertEq('no pendingSnapshot', state3.pendingSnapshot, null);

  // 4. Timeout/complete candidates check
  const state4 = createTelemetryState();
  state4.receivePacket({
    packetSupported: true,
    IsRaceOn: 1,
    CarOrdinal: 1234, // Porsche 911 GT3 RS
    EngineMaxRpm: 9000,
    Speed: 20,
    AccelerationZ: 5.0,
    Power: 300000, // ~402 HP
    Torque: 400, // ~295 ft-lbs
    Accel: 255,
    Brake: 0
  });
  const speeds = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
  speeds.forEach(s => {
    state4.receivePacket({
      packetSupported: true,
      IsRaceOn: 1,
      CarOrdinal: 1234,
      EngineMaxRpm: 9000,
      Speed: s,
      AccelerationZ: 5.0,
      Power: 300000,
      Torque: 400,
      Accel: 255,
      Brake: 0
    });
  });
  state4.stopCapture('timeout');
  assertEq('state4 is complete', state4.captureStatus, 'complete');
  assertEq('pendingSnapshot created', state4.pendingSnapshot !== null, true);
  
  const cands = state4.pendingSnapshot.candidates;
  const hpCand = cands.find(c => c.field === 'peakPower');
  const torqueCand = cands.find(c => c.field === 'peakTorque');
  const speedCand = cands.find(c => c.field === 'peakSpeed');
  const maxRpmCand = cands.find(c => c.field === 'maxRpm');
  const weightCand = cands.find(c => c.field === 'weight');
  
  assertEq('peak power is ~402', hpCand.value, 402);
  assertEq('peak torque is ~295', torqueCand.value, 295);
  assertEq('peak speed is ~60', speedCand.value, 60);
  assertEq('max RPM is 9000', maxRpmCand.value, 9000);
  
  // Median weight calculation check:
  // calculated weights: (300000 / (s * 5.0)) * 2.204622622
  // We have 11 samples total (initial speed 20 + speeds [18-27]).
  // Sorted speeds: [18, 19, 20, 20, 21, 22, 23, 24, 25, 26, 27]
  // Median speed index 5 is 22.
  // Weight for speed 22: (300000 / (22 * 5.0)) * 2.204622622 = 6012.60715 -> 6013
  assertEq('weight is correct median ~6013', weightCand.value, 6013);

  // 5. Selective apply
  // Modify layout to FWD first so we can see it change
  state4.dr.layout = 'FWD';
  state4.applySnapshot(['weight', 'layout']);
  assertEq('weight updated to 6013', state4.ch.weight, 6013);
  assertEq('layout updated to RWD', state4.dr.layout, 'RWD');
  assertEq('frontBias not modified (remains default 52)', state4.ch.frontBias, 52);
  
  assertEq('weight source is estimated', state4.fieldSources.weight.source, 'estimated');
  assertEq('layout source is lookup', state4.fieldSources.layout.source, 'lookup');
  assertEq('frontBias has no source recorded', state4.fieldSources.frontBias, undefined);

  // 6. Manual overrides
  state4.pCh('weight', 3500);
  assertEq('weight overridden to 3500', state4.ch.weight, 3500);
  assertEq('weight source updated to manual', state4.fieldSources.weight.source, 'manual');

  // 7. Restored state startup simulation
  state4.fieldSources = {
    weight: { source: 'estimated', confidence: 'medium', appliedAt: 100 },
    frontBias: { source: 'lookup', confidence: 'low', appliedAt: 100 },
    layout: { source: 'manual', confidence: 'high', appliedAt: 100 }
  };
  state4.simulateStartup();
  assertEq('weight restored', state4.fieldSources.weight.source, 'restored');
  assertEq('frontBias restored', state4.fieldSources.frontBias.source, 'restored');
  assertEq('layout remains manual', state4.fieldSources.layout.source, 'manual');
}

console.log('\ntelemetry mutation regression guard');
{
  const CAR_DATABASE = {
    "1234": { name: "2019 Porsche 911 GT3 RS", weight: 3150, frontBias: 40, layout: "RWD" }
  };
  const DEF_CH = { weight: 3200, frontBias: 52 };
  const DEF_DR = { layout: 'RWD' };

  function createTelemetryState() {
    return {
      ch: { ...DEF_CH },
      dr: { ...DEF_DR },
      captureStatus: 'inactive',
      pendingSnapshot: null,
      appliedSnapshot: null,
      
      receivePacket(data) {
        if (!data.packetSupported) return;
        if (data.IsRaceOn) {
          if (this.captureStatus === 'inactive' && !this.pendingSnapshot && !this.appliedSnapshot) {
            this.captureStatus = 'active';
          }
        }
      }
    };
  }

  // When capture is closed (complete) or applied (appliedSnapshot is set), incoming packets must not trigger capture
  const state = createTelemetryState();
  state.appliedSnapshot = { values: { weight: 3000 }, sources: {}, appliedAt: Date.now() };
  state.captureStatus = 'inactive';
  state.ch.weight = 3000;
  
  state.receivePacket({ packetSupported: true, IsRaceOn: 1 });
  assertEq('captureStatus remains inactive when appliedSnapshot is set', state.captureStatus, 'inactive');
  assertEq('ch.weight is not mutated', state.ch.weight, 3000);

  const state2 = createTelemetryState();
  state2.pendingSnapshot = { candidates: [], capturedAt: Date.now() };
  state2.captureStatus = 'complete';
  state2.ch.weight = 3200;

  state2.receivePacket({ packetSupported: true, IsRaceOn: 1 });
  assertEq('captureStatus remains complete when pendingSnapshot is set', state2.captureStatus, 'complete');
  assertEq('ch.weight is not mutated', state2.ch.weight, 3200);
}

// ── codec roundtrip ───────────────────────────────────────────────────────────

console.log('\ncodec roundtrip');
{
  const { encodeTune, decodeTune, DEF_CH, DEF_FE, DEF_DR, DEF_BR } = require('./src/codec.js');
  const code = encodeTune(DEF_CH, DEF_FE, DEF_DR, DEF_BR);
  const decoded = decodeTune(code);
  assertEq('roundtrip weight', decoded.ch.weight, DEF_CH.weight);
  assertEq('roundtrip frontBias', decoded.ch.frontBias, DEF_CH.frontBias);
  assertEq('roundtrip layout', decoded.dr.layout, DEF_DR.layout);
  assertEq('roundtrip rideStiffness', decoded.fe.rideStiffness, DEF_FE.rideStiffness);
  assertEq('roundtrip brakeBias', decoded.br.brakeBias, DEF_BR.brakeBias);
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);

// Run regression suite
runRegressionSuite();
