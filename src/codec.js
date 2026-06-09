(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    const physics = require('./physics.js');
    module.exports = factory(physics);
  } else {
    // Browser globals
    root.SUSP_OS_Codec = factory(root.SUSP_OS_Physics);
  }
}(typeof self !== 'undefined' ? self : this, function (physics) {
  const { HZ_MIN, HZ_MAX, parseTyre } = physics;

  const DEF_CH = { weight: 3200, frontBias: 52, wheelbase: 2.7, cgHeight: 0.45, trackF: 1.55, trackR: 1.52, tyreF: '265/35R18', tyreR: '265/35R18' };
  const DEF_FE = { rideStiffness: 1.75, arbBias: 0, dampingBias: 0, targetSpeed: 70, gameMode: 'horizon', dampingMode: 'ratio', reboundZeta: 70, bumpRatio: 56, bumpZeta: 39, arbMode: 'auto', arbTargetRollMan: 1.8, arbShareMan: 15, arbFloor: 6, arbCeil: 65, arbBalTarget: 0.65, arbBalMode: 'weight', springShare: 50, rearHzMode: 'flatRide', rearHzMan: 1.5, rearHzMult: 1.20, rideRef: 'front' };
  const DEF_DR = { layout: 'RWD', buildType: 'track', diffManual: false, diffComplement: false, diffBiasExit: 0, diffBiasEntry: 0, diffFrontExitBias: 0, diffAccel: 35, diffDecel: 10, diffFrontAccel: 28, diffFrontDecel: 0, diffRearAccel: 48, diffRearDecel: 8, diffCenter: 65 };
  const DEF_BR = { brakeManual: false, brakeBias: 50, brakePressure: 100 };

  const GAME_MODE_ENC = { 'horizon': 0, 'motorsport': 1 };
  const GAME_MODE_DEC = ['horizon', 'motorsport'];
  const DAMPING_MODE_ENC = { 'ratio': 0, 'independent': 1 };
  const DAMPING_MODE_DEC = ['ratio', 'independent'];
  const REAR_HZ_MODE_ENC = { 'flatRide': 0, 'independent': 1, 'multiplier': 2, 'mech': 3 };
  const REAR_HZ_MODE_DEC = ['flatRide', 'independent', 'multiplier', 'mech'];
  const ARB_MODE_ENC = { 'auto': 0, 'roll': 1, 'share': 2 };
  const ARB_MODE_DEC = ['auto', 'roll', 'share', 'auto'];
  const ARB_BAL_MODE_ENC = { 'weight': 0, 'mech': 1, 'coSolve': 2, 'man': 3 };
  const ARB_BAL_MODE_DEC = ['weight', 'mech', 'coSolve', 'man'];
  const RIDE_REF_ENC = { 'front': 0, 'rear': 1, 'shared': 2 };
  const RIDE_REF_DEC = ['front', 'rear', 'shared'];
  const LAYOUT_ENC = { 'FWD': 0, 'RWD': 1, 'AWD': 2 };
  const LAYOUT_DEC = ['FWD', 'RWD', 'AWD'];
  const BUILD_ENC = { 'street': 0, 'track': 1, 'drift': 2 };
  const BUILD_DEC = ['street', 'track', 'drift'];

  const encodeTune = (ch, fe, dr, br) => {
    const arr = [
      ch.weight, ch.frontBias, ch.wheelbase, ch.cgHeight, ch.trackF, ch.trackR, 1, 1,
      fe.rideStiffness, fe.arbBias ?? 0, fe.targetSpeed, GAME_MODE_ENC[fe.gameMode] ?? 0,
      DAMPING_MODE_ENC[fe.dampingMode ?? 'ratio'] ?? 0, fe.reboundZeta ?? 70, fe.bumpRatio ?? 56, fe.bumpZeta ?? 39,
      ARB_MODE_ENC[fe.arbMode ?? 'auto'] ?? 0, fe.arbTargetRollMan ?? 1.8, fe.arbShareMan ?? 15, fe.arbFloor ?? 6, fe.arbCeil ?? 65,
      LAYOUT_ENC[dr.layout] ?? 1, BUILD_ENC[dr.buildType ?? 'track'] ?? 1, dr.diffManual ? 1 : 0,
      dr.diffBiasExit ?? 0, dr.diffAccel ?? 35, dr.diffDecel ?? 10,
      dr.diffFrontAccel ?? 28, dr.diffFrontDecel ?? 0, dr.diffRearAccel ?? 48, dr.diffRearDecel ?? 8, dr.diffCenter ?? 65,
      dr.diffBiasEntry ?? 0,
      (br?.brakeManual ? 1 : 0), br?.brakeBias ?? DEF_BR.brakeBias, br?.brakePressure ?? DEF_BR.brakePressure,
      0, 0,
      REAR_HZ_MODE_ENC[fe.rearHzMode ?? 'flatRide'] ?? 0,
      fe.rearHzMan ?? 1.5,
      fe.rearHzMult ?? 1.20,
      fe.dampingBias ?? 0,
      ...(() => {
        const f = parseTyre(ch.tyreF), r = parseTyre(ch.tyreR);
        return [f?.width ?? 265, r?.width ?? 265, f?.aspectRatio ?? 35, f?.rimDiameter ?? 18, r?.aspectRatio ?? 35, r?.rimDiameter ?? 18];
      })(),
      fe.arbBalTarget ?? DEF_FE.arbBalTarget,
      ARB_BAL_MODE_ENC[fe.arbBalMode ?? 'weight'] ?? 0,
      dr.diffFrontExitBias ?? 0,
      fe.springShare ?? DEF_FE.springShare,
      RIDE_REF_ENC[fe.rideRef ?? 'front'] ?? 0,
      (dr.diffComplement ? 1 : 0),
      fe.arbManF ?? 20,
      fe.arbManR ?? 20,
    ];
    return btoa(arr.join('|'));
  };

  const decodeTune = (code) => {
    const raw = atob(code.trim());
    if (raw.startsWith('{')) {
      const { ch: ic, fe: ife, dr: idr, br: ibr } = JSON.parse(raw);
      return { ch: ic, fe: ife, dr: idr, br: ibr };
    }
    const v = raw.split('|').map(Number);
    const ch = { weight: v[0], frontBias: v[1], wheelbase: v[2], cgHeight: v[3], trackF: v[4], trackR: v[5] };
    const fe = {
      rideStiffness: v[8], arbBias: v[9], targetSpeed: v[10], gameMode: GAME_MODE_DEC[v[11]] ?? 'horizon',
      dampingMode: DAMPING_MODE_DEC[v[12]] ?? 'ratio', reboundZeta: v[13], bumpRatio: v[14], bumpZeta: v[15],
      arbMode: ARB_MODE_DEC[v[16]] ?? 'auto', arbTargetRollMan: v[17], arbShareMan: v[18], arbFloor: v[19], arbCeil: v[20],
      rearHzMode: v.length >= 39 ? REAR_HZ_MODE_DEC[v[38]] ?? 'flatRide' : 'flatRide',
      rearHzMan: v.length >= 40 ? v[39] : DEF_FE.rearHzMan,
      rearHzMult: v.length >= 41 ? v[40] : DEF_FE.rearHzMult,
      dampingBias: v.length >= 42 ? v[41] : 0,
      arbBalTarget: v.length >= 49 ? v[48] : DEF_FE.arbBalTarget,
      arbBalMode: v.length >= 50 ? ARB_BAL_MODE_DEC[v[49]] ?? 'weight' : 'weight',
      springShare: v.length >= 52 ? v[51] : DEF_FE.springShare,
      rideRef: v.length >= 53 ? RIDE_REF_DEC[v[52]] ?? 'front' : 'front',
      arbManF: v.length >= 55 ? v[54] : 20,
      arbManR: v.length >= 56 ? v[55] : 20
    };
    const _fW = v.length >= 43 ? v[42] : 265, _rW = v.length >= 44 ? v[43] : 265;
    const _fA = v.length >= 45 ? v[44] : 35, _fR = v.length >= 46 ? v[45] : 18;
    const _rA = v.length >= 47 ? v[46] : 35, _rR = v.length >= 48 ? v[47] : 18;
    ch.tyreF = `${_fW}/${_fA}R${_fR}`;
    ch.tyreR = `${_rW}/${_rA}R${_rR}`;
    const dr = {
      layout: LAYOUT_DEC[v[21]] ?? 'RWD', buildType: BUILD_DEC[v[22]] ?? 'track', diffManual: v[23] === 1,
      diffBiasExit: v[24] ?? 0, diffAccel: v[25], diffDecel: v[26],
      diffFrontAccel: v[27], diffFrontDecel: v[28], diffRearAccel: v[29], diffRearDecel: v[30], diffCenter: v[31],
      diffBiasEntry: v[32] ?? 0,
      diffFrontExitBias: v.length >= 51 ? v[50] : DEF_DR.diffFrontExitBias,
      diffComplement: v.length >= 54 ? v[53] === 1 : false
    };
    const br = v.length >= 36
      ? { brakeManual: v[33] === 1, brakeBias: v[34], brakePressure: v[35] }
      : { ...DEF_BR };
    return { ch, fe, dr, br };
  };

  const sanitizeTune = ({ ch, fe, dr, br }) => {
    const n = (v, def) => (typeof v === 'number' && isFinite(v)) ? v : def;
    const cl = (v, lo, hi, def) => Math.max(lo, Math.min(hi, n(v, def)));
    const sArbFloor = cl(fe?.arbFloor, 1, 64, DEF_FE.arbFloor);
    const sArbCeil = Math.max(sArbFloor + 1, cl(fe?.arbCeil, 1, 65, DEF_FE.arbCeil));
    return {
      ch: {
        weight: cl(ch?.weight, 100, 18000, DEF_CH.weight),
        frontBias: cl(ch?.frontBias, 30, 70, DEF_CH.frontBias),
        wheelbase: cl(ch?.wheelbase, 0.4, 4.0, DEF_CH.wheelbase),
        cgHeight: cl(ch?.cgHeight, 0.2, 0.9, DEF_CH.cgHeight),
        trackF: cl(ch?.trackF, 1.0, 2.2, DEF_CH.trackF),
        trackR: cl(ch?.trackR, 1.0, 2.2, DEF_CH.trackR),
        tyreF: parseTyre(ch?.tyreF) ? ch.tyreF : DEF_CH.tyreF,
        tyreR: parseTyre(ch?.tyreR) ? ch.tyreR : DEF_CH.tyreR,
      },
      fe: {
        rideStiffness: (() => { const rs = n(fe?.rideStiffness, DEF_FE.rideStiffness); const hz = rs > 6 ? 0.8 + (rs / 100) * 2.7 : rs; return Math.max(HZ_MIN, Math.min(HZ_MAX, Math.round(hz * 100) / 100)); })(),
        arbBias: cl(fe?.arbBias, -50, 50, DEF_FE.arbBias),
        arbBalTarget: cl(fe?.arbBalTarget, 0.40, 0.90, DEF_FE.arbBalTarget),
        arbBalMode: ARB_BAL_MODE_DEC.includes(fe?.arbBalMode) ? fe.arbBalMode : DEF_FE.arbBalMode,
        springShare: cl(fe?.springShare, 0, 100, DEF_FE.springShare),
        dampingBias: cl(fe?.dampingBias, -50, 50, DEF_FE.dampingBias),
        targetSpeed: cl(fe?.targetSpeed, 60, 200, DEF_FE.targetSpeed),
        gameMode: GAME_MODE_DEC.includes(fe?.gameMode) ? fe.gameMode : DEF_FE.gameMode,
        dampingMode: DAMPING_MODE_DEC.includes(fe?.dampingMode) ? fe.dampingMode : DEF_FE.dampingMode,
        reboundZeta: cl(fe?.reboundZeta, 10, 115, DEF_FE.reboundZeta),
        bumpRatio: cl(fe?.bumpRatio, 10, 100, DEF_FE.bumpRatio),
        bumpZeta: cl(fe?.bumpZeta, 10, 115, DEF_FE.bumpZeta),
        arbMode: ARB_MODE_DEC.includes(fe?.arbMode) ? fe.arbMode : DEF_FE.arbMode,
        arbTargetRollMan: cl(fe?.arbTargetRollMan, 0.3, 5.0, DEF_FE.arbTargetRollMan),
        arbShareMan: cl(fe?.arbShareMan, 0, 80, DEF_FE.arbShareMan),
        arbFloor: sArbFloor,
        arbCeil: sArbCeil,
        rearHzMode: REAR_HZ_MODE_DEC.includes(fe?.rearHzMode) ? fe.rearHzMode : DEF_FE.rearHzMode,
        rearHzMan: cl(fe?.rearHzMan, HZ_MIN, HZ_MAX, DEF_FE.rearHzMan),
        rearHzMult: cl(fe?.rearHzMult, 0.5, 3.0, DEF_FE.rearHzMult),
        rideRef: ['front', 'rear', 'shared'].includes(fe?.rideRef) ? fe.rideRef : 'front',
        arbManF: cl(fe?.arbManF, 1, 65, 20),
        arbManR: cl(fe?.arbManR, 1, 65, 20),
      },
      dr: {
        layout: LAYOUT_DEC.includes(dr?.layout) ? dr.layout : DEF_DR.layout,
        buildType: BUILD_DEC.includes(dr?.buildType) ? dr.buildType : DEF_DR.buildType,
        diffManual: typeof dr?.diffManual === 'boolean' ? dr.diffManual : dr?.diffManual === 1,
        diffComplement: typeof dr?.diffComplement === 'boolean' ? dr.diffComplement : false,
        diffBiasExit: cl(dr?.diffBiasExit, -50, 50, DEF_DR.diffBiasExit),
        diffBiasEntry: cl(dr?.diffBiasEntry, -50, 50, DEF_DR.diffBiasEntry),
        diffFrontExitBias: cl(dr?.diffFrontExitBias, -50, 50, DEF_DR.diffFrontExitBias),
        diffAccel: cl(dr?.diffAccel, 0, 100, DEF_DR.diffAccel),
        diffDecel: cl(dr?.diffDecel, 0, 100, DEF_DR.diffDecel),
        diffFrontAccel: cl(dr?.diffFrontAccel, 0, 100, DEF_DR.diffFrontAccel),
        diffFrontDecel: cl(dr?.diffFrontDecel, 0, 100, DEF_DR.diffFrontDecel),
        diffRearAccel: cl(dr?.diffRearAccel, 0, 100, DEF_DR.diffRearAccel),
        diffRearDecel: cl(dr?.diffRearDecel, 0, 100, DEF_DR.diffRearDecel),
        diffCenter: cl(dr?.diffCenter, 0, 100, DEF_DR.diffCenter),
      },
      br: {
        brakeManual: typeof br?.brakeManual === 'boolean' ? br.brakeManual : br?.brakeManual === 1,
        brakeBias: cl(br?.brakeBias, 45, 70, DEF_BR.brakeBias),
        brakePressure: cl(br?.brakePressure, 50, 200, DEF_BR.brakePressure),
      },
    };
  };

  return {
    DEF_CH, DEF_FE, DEF_DR, DEF_BR,
    GAME_MODE_ENC, GAME_MODE_DEC, DAMPING_MODE_ENC, DAMPING_MODE_DEC,
    REAR_HZ_MODE_ENC, REAR_HZ_MODE_DEC, ARB_MODE_ENC, ARB_MODE_DEC,
    ARB_BAL_MODE_ENC, ARB_BAL_MODE_DEC, RIDE_REF_ENC, RIDE_REF_DEC,
    LAYOUT_ENC, LAYOUT_DEC, BUILD_ENC, BUILD_DEC,
    encodeTune, decodeTune, sanitizeTune
  };
}));
