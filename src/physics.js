(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory();
  } else {
    // Browser globals
    root.SUSP_OS_Physics = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const KG_TO_LB = 2.204622622;
  const LB_IN_TO_NM = 175.126790921;
  const MPH_TO_MS = 0.44704;
  const KMH_PER_MPH = 1.60934;
  const NMM_PER_LBIN = LB_IN_TO_NM / 100;
  const ARB_RS_SCALE = 240;
  const rollCenterHeight = ch => ch.cgHeight * 0.20;
  const DAMPING_CALIBRATION = 0.00135;
  const TIRE_LOAD_SENS = 0.15;
  const MECH_BAL_GAIN = 1.8;
  const WIDTH_GRIP_EXP = 0.4;
  const TIRE_MECH_SCALE = 0.08;
  const MECH_BALANCE_TARGET = 0.65;
  const GAME_LIMITS = { horizon: { damping: 20, arb: 65 }, motorsport: { damping: 40, arb: 40 } };
  const HZ_MIN = 0.8;
  const HZ_MAX = 5.5;
  const HZ_RANGE = HZ_MAX - HZ_MIN;

  const ARB_BAL_MODE_DEC = ['weight', 'mech', 'coSolve', 'man'];

  const cornerMasses = ch => {
    const kg = ch.weight / KG_TO_LB;
    return { front: (kg * (ch.frontBias / 100)) / 2, rear: (kg * (1 - ch.frontBias / 100)) / 2 };
  };

  const parseTyre = str => {
    const m = String(str ?? '').trim().match(/^(\d{2,3})\/(\d{2,3})[Rr](\d{1,2}(?:\.\d)?)$/);
    if (!m) return null;
    const width = +m[1], aspect = +m[2], rim = +m[3];
    const diameter = rim * 25.4 + 2 * (width * aspect / 100);
    return { width, aspectRatio: aspect, rimDiameter: rim, diameter, radius: diameter / 2 };
  };

  const rsToHz = rs => rs > 6 ? 0.8 + (rs / 100) * 2.7 : rs;
  const hzToRs = hz => Math.round(Math.max(HZ_MIN, Math.min(HZ_MAX, hz)) * 100) / 100;

  const flatRideRearHz = (fHz, wb, mph) => {
    if (mph >= 200) return { hz: fHz, clamped: false };
    const ms = mph * MPH_TO_MS;
    if (ms < 1) return { hz: fHz * 1.2, clamped: false };
    const t = wb / ms, d = (1 / fHz) - (2 * t);
    const raw = d > 0.05 ? 1 / d : fHz * 1.2;
    const clamped = raw > HZ_MAX;
    return { hz: Math.min(raw, HZ_MAX), clamped };
  };

  const flatRideSharedHz = (avgHz, wb, mph) => {
    if (mph >= 200) return { fHz: avgHz, rHz: avgHz, clamped: false };
    const ms = mph * MPH_TO_MS;
    if (ms < 1) {
      const fHz = Math.max(HZ_MIN, avgHz / 1.1);
      return { fHz, rHz: Math.max(HZ_MIN, 2 * avgHz - fHz), clamped: false };
    }
    const t = wb / ms;
    const B = -(1 + 2 * avgHz * t), disc = B * B - 4 * t * avgHz;
    if (disc < 0) return { fHz: avgHz, rHz: avgHz, clamped: true };
    const fHz = Math.max(HZ_MIN, (-B - Math.sqrt(disc)) / (2 * t));
    const res = flatRideRearHz(fHz, wb, mph);
    return { fHz, rHz: res.hz, clamped: fHz < HZ_MIN || res.clamped };
  };

  const solveSpring = (hz, mass, mr) => {
    const wr = Math.pow(hz * 2 * Math.PI, 2) * mass;
    return (wr / Math.pow(mr, 2)) / LB_IN_TO_NM;
  };

  const solveDamp = (hz, mass, z, lim) => {
    const wr = Math.pow(hz * 2 * Math.PI, 2) * mass, cc = 2 * Math.sqrt(wr * mass);
    return Math.min(lim, Math.max(1, cc * (z / 100) * DAMPING_CALIBRATION));
  };

  const solveDampRaw = (hz, mass, z) => {
    const wr = Math.pow(hz * 2 * Math.PI, 2) * mass, cc = 2 * Math.sqrt(wr * mass);
    return cc * (z / 100) * DAMPING_CALIBRATION;
  };

  const mechBalanceLLT = (ch, Kf, Kr) => {
    const g = 9.81, a = 1.0;
    const twF = parseTyre(ch.tyreF)?.width ?? ch.twF ?? 265, twR = parseTyre(ch.tyreR)?.width ?? ch.twR ?? 265;
    const m = cornerMasses(ch), Mf = m.front * 2, Mr = m.rear * 2, Mt = Mf + Mr, RC = rollCenterHeight(ch);
    const Mphi = Mt * g * a * (ch.cgHeight - RC), sF = Kf / (Kf + Kr);
    const dWf = Mphi * sF / ch.trackF + Mf * g * a * RC / ch.trackF;
    const dWr = Mphi * (1 - sF) / ch.trackR + Mr * g * a * RC / ch.trackR;
    const FzRef = Mt * g / 4;
    const fy = Fz => { const z = Math.max(0, Fz); return z * Math.max(0, 1 - TIRE_LOAD_SENS * (z / FzRef - 1)); };
    const wF = Mf * g / 2, wR = Mr * g / 2;
    const FyF = Math.pow(twF / 265, WIDTH_GRIP_EXP) * (fy(wF + dWf) + fy(wF - dWf));
    const FyR = Math.pow(twR / 265, WIDTH_GRIP_EXP) * (fy(wR + dWr) + fy(wR - dWr));
    return Math.max(0, Math.min(1, 0.5 + MECH_BAL_GAIN * (FyF / (Mf * g) - FyR / (Mr * g))));
  };

  const balanceFromRsBal = (ch, rsBal) => {
    const r = Math.max(1e-4, Math.min(1 - 1e-4, rsBal));
    return mechBalanceLLT(ch, 1, r / (1 - r));
  };

  const feelToPhysics = (ch, fe) => {
    const gameLim = GAME_LIMITS[fe.gameMode ?? 'horizon']?.arb ?? 65;
    let frontHz = rsToHz(fe.rideStiffness);
    const rearHzMode = fe.rearHzMode ?? 'flatRide';
    const arbBalModeEarly = ARB_BAL_MODE_DEC.includes(fe.arbBalMode) ? fe.arbBalMode : 'weight';
    const uiRideRef = ['front', 'rear', 'shared'].includes(fe.rideRef) ? fe.rideRef : 'front';
    const rideRef = arbBalModeEarly === 'coSolve' ? 'front' : uiRideRef;
    if (arbBalModeEarly === 'coSolve' && uiRideRef !== 'front') {
      const mc = cornerMasses(ch);
      const abt = Math.max(0.40, Math.min(0.90, fe.arbBalTarget ?? MECH_BALANCE_TARGET));
      const rst = Math.max(0.001, Math.min(0.999, abt));
      const S = (fe.springShare ?? 50) / 100;
      const A = mc.rear * ch.trackR * ch.trackR / (mc.front * ch.trackF * ch.trackF);
      const Rbl = A / (1 + A);
      const Rsp = Math.max(0.001, Math.min(0.999, Rbl + S * (rst - Rbl)));
      const Kcs = Math.sqrt(Rsp * mc.front * ch.trackF * ch.trackF / ((1 - Rsp) * mc.rear * ch.trackR * ch.trackR));
      if (uiRideRef === 'rear') frontHz = Math.max(HZ_MIN, frontHz / Kcs);
      else if (uiRideRef === 'shared') frontHz = Math.max(HZ_MIN, 2 * frontHz / (1 + Kcs));
    }
    let rearHz, rearHzClamped;
    if (rideRef === 'shared') {
      const avgHz = frontHz;
      if (rearHzMode === 'multiplier') {
        const mult = fe.rearHzMult ?? 1.20;
        frontHz = Math.max(HZ_MIN, 2 * avgHz / (1 + mult));
        rearHz = Math.max(HZ_MIN, Math.min(HZ_MAX, 2 * avgHz * mult / (1 + mult)));
        rearHzClamped = false;
      } else if (rearHzMode === 'mech' && arbBalModeEarly !== 'coSolve') {
        const m_m = cornerMasses(ch);
        const arbBalTgt = Math.max(0.40, Math.min(0.90, fe.arbBalTarget ?? MECH_BALANCE_TARGET));
        const rsBalTgt = Math.max(0.05, Math.min(0.95, arbBalTgt));
        const _V_m = m_m.front * ch.trackF * ch.trackF, _W_m = m_m.rear * ch.trackR * ch.trackR;
        const _rsBalNat_m = _W_m / (_V_m + _W_m);
        let _p_m = 0;
        if (arbBalModeEarly === 'weight') {
          if ((fe.arbMode ?? 'auto') === 'share') _p_m = Math.max(0, Math.min(0.99, (fe.arbShareMan ?? 20) / 100));
          else if ((fe.arbMode ?? 'auto') === 'auto') {
            let _estF = avgHz, _estR = avgHz;
            for (let _i = 0; _i < 2; _i++) {
              const _rsSp = (Math.pow(_estF * 2 * Math.PI, 2) * m_m.front * ch.trackF * ch.trackF
                + Math.pow(_estR * 2 * Math.PI, 2) * m_m.rear * ch.trackR * ch.trackR) / 2;
              const _nRoll = _rsSp > 0 ? (ch.weight / KG_TO_LB * 9.81 * (ch.cgHeight - rollCenterHeight(ch)) / _rsSp) * (180 / Math.PI) : 5;
              _p_m = Math.max(5, Math.min(50, _nRoll * 7)) / 100;
              const _eff = _p_m > 0 ? Math.max(0.05, Math.min(0.95, (rsBalTgt - _p_m * _rsBalNat_m) / (1 - _p_m))) : rsBalTgt;
              const _R = _eff / (1 - _eff);
              const _mult = Math.sqrt(_R * m_m.front * ch.trackF * ch.trackF / (m_m.rear * ch.trackR * ch.trackR));
              _estF = Math.max(HZ_MIN, 2 * avgHz / (1 + _mult));
              _estR = Math.max(HZ_MIN, Math.min(HZ_MAX, 2 * avgHz * _mult / (1 + _mult)));
            }
          }
        }
        const _effRsBal_m = _p_m > 0 ? Math.max(0.05, Math.min(0.95, (rsBalTgt - _p_m * _rsBalNat_m) / (1 - _p_m))) : rsBalTgt;
        const R_m = _effRsBal_m / (1 - _effRsBal_m);
        const mult_m = Math.sqrt(R_m * m_m.front * ch.trackF * ch.trackF / (m_m.rear * ch.trackR * ch.trackR));
        frontHz = Math.max(HZ_MIN, 2 * avgHz / (1 + mult_m));
        rearHz = Math.max(HZ_MIN, Math.min(HZ_MAX, 2 * avgHz * mult_m / (1 + mult_m)));
        rearHzClamped = frontHz <= HZ_MIN || rearHz >= HZ_MAX;
      } else {
        const res = flatRideSharedHz(avgHz, ch.wheelbase, fe.targetSpeed);
        frontHz = res.fHz; rearHz = res.rHz; rearHzClamped = res.clamped;
      }
    } else {
      const primaryHz = frontHz;
      let secondaryHz, secondaryHzClamped;
      if (rearHzMode === 'independent') {
        secondaryHz = Math.max(HZ_MIN, Math.min(HZ_MAX, fe.rearHzMan ?? 1.5));
        secondaryHzClamped = false;
      } else if (rearHzMode === 'multiplier') {
        const mult = fe.rearHzMult ?? 1.20;
        const raw = rideRef === 'front' ? primaryHz * mult : primaryHz / mult;
        secondaryHz = Math.max(HZ_MIN, Math.min(HZ_MAX, raw));
        secondaryHzClamped = false;
      } else if (rearHzMode === 'mech' && arbBalModeEarly !== 'coSolve') {
        const m_m = cornerMasses(ch);
        const arbBalTgt = Math.max(0.40, Math.min(0.90, fe.arbBalTarget ?? MECH_BALANCE_TARGET));
        const rsBalTgt = Math.max(0.05, Math.min(0.95, arbBalTgt));
        const _V_m = m_m.front * ch.trackF * ch.trackF, _W_m = m_m.rear * ch.trackR * ch.trackR;
        const _rsBalNat_m = _W_m / (_V_m + _W_m);
        let _p_m = 0;
        if (arbBalModeEarly === 'weight') {
          if ((fe.arbMode ?? 'auto') === 'share') _p_m = Math.max(0, Math.min(0.99, (fe.arbShareMan ?? 20) / 100));
          else if ((fe.arbMode ?? 'auto') === 'auto') {
            let _estSec = primaryHz;
            for (let _i = 0; _i < 2; _i++) {
              const _fHz = rideRef === 'rear' ? _estSec : primaryHz;
              const _rHz = rideRef === 'rear' ? primaryHz : _estSec;
              const _rsSp = (Math.pow(_fHz * 2 * Math.PI, 2) * m_m.front * ch.trackF * ch.trackF
                + Math.pow(_rHz * 2 * Math.PI, 2) * m_m.rear * ch.trackR * ch.trackR) / 2;
              const _nRoll = _rsSp > 0 ? (ch.weight / KG_TO_LB * 9.81 * (ch.cgHeight - rollCenterHeight(ch)) / _rsSp) * (180 / Math.PI) : 5;
              _p_m = Math.max(5, Math.min(50, _nRoll * 7)) / 100;
              const _eff = _p_m > 0 ? Math.max(0.05, Math.min(0.95, (rsBalTgt - _p_m * _rsBalNat_m) / (1 - _p_m))) : rsBalTgt;
              const _R = _eff / (1 - _eff);
              const _mult = Math.sqrt(_R * m_m.front * ch.trackF * ch.trackF / (m_m.rear * ch.trackR * ch.trackR));
              _estSec = Math.max(HZ_MIN, Math.min(HZ_MAX, rideRef === 'front' ? primaryHz * _mult : primaryHz / _mult));
            }
          }
        }
        const _effRsBal_m = _p_m > 0 ? Math.max(0.05, Math.min(0.95, (rsBalTgt - _p_m * _rsBalNat_m) / (1 - _p_m))) : rsBalTgt;
        const R_m = _effRsBal_m / (1 - _effRsBal_m);
        const mult_m = Math.sqrt(R_m * m_m.front * ch.trackF * ch.trackF / (m_m.rear * ch.trackR * ch.trackR));
        const raw_m = rideRef === 'front' ? primaryHz * mult_m : primaryHz / mult_m;
        secondaryHz = Math.max(HZ_MIN, Math.min(HZ_MAX, raw_m));
        secondaryHzClamped = raw_m < HZ_MIN || raw_m > HZ_MAX;
      } else {
        if (rideRef === 'front') {
          const res = flatRideRearHz(primaryHz, ch.wheelbase, fe.targetSpeed);
          secondaryHz = res.hz; secondaryHzClamped = res.clamped;
        } else {
          if (fe.targetSpeed >= 200) {
            secondaryHz = primaryHz; secondaryHzClamped = false;
          } else {
            const ms = Math.max(1, fe.targetSpeed * MPH_TO_MS);
            const raw = 1 / (1 / primaryHz + 2 * (ch.wheelbase / ms));
            secondaryHz = Math.max(HZ_MIN, raw);
            secondaryHzClamped = raw < HZ_MIN;
          }
        }
      }
      if (rideRef === 'front') {
        rearHz = secondaryHz; rearHzClamped = secondaryHzClamped;
      } else {
        rearHz = primaryHz; rearHzClamped = false;
        frontHz = secondaryHz;
      }
    }
    const dampingMode = fe.dampingMode ?? 'ratio';
    const reboundZeta = Math.max(10, Math.min(115, fe.reboundZeta ?? 70));
    const bumpZeta = dampingMode === 'ratio'
      ? Math.max(10, Math.min(reboundZeta, reboundZeta * Math.min(100, fe.bumpRatio ?? 56) / 100))
      : Math.max(10, Math.min(115, fe.bumpZeta ?? 39));
    const dampingBias = fe.dampingBias ?? 0;
    const zetaF = Math.max(10, Math.min(115, dampingBias > 0 ? reboundZeta : reboundZeta * (1 + dampingBias / 200)));
    const zetaR = Math.max(10, Math.min(115, dampingBias < 0 ? reboundZeta : reboundZeta * (1 - dampingBias / 200)));
    const bumpZetaF = Math.max(10, Math.min(115, dampingBias > 0 ? bumpZeta : bumpZeta * (1 + dampingBias / 200)));
    const bumpZetaR = Math.max(10, Math.min(115, dampingBias < 0 ? bumpZeta : bumpZeta * (1 - dampingBias / 200)));
    const arbBalance = Math.max(20, Math.min(80, (100 - ch.frontBias) + fe.arbBias * 0.4));
    const arbMode = fe.arbMode ?? 'auto';
    const arbTargetRoll = arbMode === 'roll' ? Math.max(0.3, Math.min(5.0, fe.arbTargetRollMan)) : 0;
    const arbShareMan = Math.max(0, Math.min(80, fe.arbShareMan ?? 15));
    const arbFloor = Math.max(1, Math.min(fe.arbFloor ?? 6, fe.arbCeil ?? gameLim));
    const arbCeil = Math.max(arbFloor + 1, Math.min(gameLim, fe.arbCeil ?? gameLim));
    const arbBalTarget = Math.max(0.40, Math.min(0.90, fe.arbBalTarget ?? MECH_BALANCE_TARGET));
    const arbBalMode = ARB_BAL_MODE_DEC.includes(fe.arbBalMode) ? fe.arbBalMode : 'weight';
    const springShare = Math.max(0, Math.min(100, fe.springShare ?? 50));
    if (arbBalModeEarly === 'coSolve') rearHzClamped = false;
    return { frontHz, rearHz, rearHzClamped, rearHzMode, rideRef: uiRideRef, reboundZeta, bumpZeta, zetaF, zetaR, bumpZetaF, bumpZetaR, dampingMode, arbBalance, arbTargetRoll, arbMode, arbShareMan, arbFloor, arbCeil, arbBalTarget, arbBalMode, springShare, arbManF: fe.arbManF, arbManR: fe.arbManR };
  };

  const computeTune = (ch, phys, gameMode) => {
    const lim = GAME_LIMITS[gameMode], m = cornerMasses(ch);
    const { frontHz: fHz, rearHz: rHz, reboundZeta, bumpZeta, zetaF, zetaR, bumpZetaF, bumpZetaR, arbBalance, arbTargetRoll, arbMode, arbShareMan, arbFloor, arbCeil, arbBalTarget, arbBalMode, arbManF, arbManR } = phys;
    const twF = parseTyre(ch.tyreF)?.width ?? 265, twR = parseTyre(ch.tyreR)?.width ?? 265;
    const tireCorr = TIRE_MECH_SCALE * Math.log(twR / twF);
    let effectiveRHz = rHz;
    if (arbBalMode === 'coSolve') {
      const rsSpF_cs = Math.pow(fHz * 2 * Math.PI, 2) * m.front * ch.trackF * ch.trackF / 2;
      const targetRsBalance = Math.max(0.001, Math.min(0.999, arbBalTarget - tireCorr));
      const rsSpR_base = Math.pow(fHz * 2 * Math.PI, 2) * m.rear * ch.trackR * ch.trackR / 2;
      const R_baseline = rsSpR_base / (rsSpF_cs + rsSpR_base);
      const S = (phys.springShare ?? 50) / 100;
      const R_sp = Math.max(0.001, Math.min(0.999, R_baseline + S * (targetRsBalance - R_baseline)));
      const rsSpR_tgt = R_sp * rsSpF_cs / (1 - R_sp);
      effectiveRHz = Math.max(HZ_MIN, Math.min(HZ_MAX, Math.sqrt(2 * rsSpR_tgt / (m.rear * ch.trackR * ch.trackR)) / (2 * Math.PI)));
    }
    const springF = solveSpring(fHz, m.front, 1);
    const springR = solveSpring(effectiveRHz, m.rear, 1);
    const rawRebF = solveDampRaw(fHz, m.front, zetaF);
    const rawRebR = solveDampRaw(effectiveRHz, m.rear, zetaR);
    const rawBmpF = solveDampRaw(fHz, m.front, bumpZetaF);
    const rawBmpR = solveDampRaw(effectiveRHz, m.rear, bumpZetaR);
    const dampScale = (a, b) => {
      const hi = Math.max(a, b), lo = Math.min(a, b);
      if (hi > lim.damping) return lim.damping / hi;
      if (lo < 1) return 1 / lo;
      return 1;
    };
    const rebScale = dampScale(rawRebF, rawRebR);
    const bmpScale = dampScale(rawBmpF, rawBmpR);
    const clampDamp = (v, s) => Math.min(lim.damping, Math.max(1, Math.round(v * s * 10) / 10));
    const rebF = clampDamp(rawRebF, rebScale);
    const rebR = clampDamp(rawRebR, rebScale);
    const bumpF = clampDamp(rawBmpF, bmpScale);
    const bumpR = clampDamp(rawBmpR, bmpScale);
    const dampingClamped = rebScale !== 1 || bmpScale !== 1;
    const wrFN = Math.pow(fHz * 2 * Math.PI, 2) * m.front, wrRN = Math.pow(effectiveRHz * 2 * Math.PI, 2) * m.rear;
    const rsSpF = (wrFN * ch.trackF * ch.trackF) / 2, rsSpR = (wrRN * ch.trackR * ch.trackR) / 2;
    const rsSp = rsSpF + rsSpR;
    const totalKg = ch.weight / KG_TO_LB, rollArm = ch.cgHeight - rollCenterHeight(ch);
    const rollMoment = totalKg * 9.81 * rollArm;
    const rsTotalTarget = rollMoment / (arbTargetRoll * (Math.PI / 180));
    const naturalRollDeg = (rsSp > 0) ? ((rollMoment / rsSp) * (180 / Math.PI)) : 5;
    const autoShareTarget = Math.max(5, Math.min(50, naturalRollDeg * 7));
    const shareTarget = arbMode === 'share' ? arbShareMan / 100 : autoShareTarget / 100;
    let rsAbBudget = arbMode === 'roll' ? rsTotalTarget - rsSpF - rsSpR : rsSp * (shareTarget / (1 - shareTarget));
    let rF = arbBalance / 100;
    let _rsBalK = null;
    if ((arbBalMode === 'mech' || arbBalMode === 'coSolve') && rsAbBudget > 0) {
      const _mechTgt = Math.max(0.001, Math.min(0.999, arbBalTarget - tireCorr));
      _rsBalK = _mechTgt / (1 - _mechTgt);
      rF = Math.max(0, Math.min(1, (_rsBalK * (rsSpF + rsAbBudget) - rsSpR) / (rsAbBudget * (1 + _rsBalK))));
    }
    if (arbMode !== 'share') {
      const rsLightFloor = arbFloor * ARB_RS_SCALE * (rF <= 0.5 ? ch.trackR : ch.trackF) * (rF <= 0.5 ? ch.trackR : ch.trackF);
      const rsHeavyFloor = rsLightFloor * (Math.max(rF, 1 - rF) / Math.min(rF, 1 - rF));
      const budgetFloor = rsLightFloor + rsHeavyFloor;
      if (rsAbBudget < budgetFloor) rsAbBudget = budgetFloor;
    }
    const rsHeavyCeil = arbCeil * ARB_RS_SCALE * (rF >= 0.5 ? ch.trackR : ch.trackF) * (rF >= 0.5 ? ch.trackR : ch.trackF);
    const rsHeavyBudget = rsAbBudget * Math.max(rF, 1 - rF);
    if (rsHeavyBudget > rsHeavyCeil) rsAbBudget = rsHeavyCeil / Math.max(rF, 1 - rF);
    if (_rsBalK !== null)
      rF = Math.max(0, Math.min(1, (_rsBalK * (rsSpF + rsAbBudget) - rsSpR) / (rsAbBudget * (1 + _rsBalK))));
    const clk = (rs, track) => { const v = Math.min(Math.min(lim.arb, arbCeil), Math.max(1, rs / (ARB_RS_SCALE * track * track))); return Math.round(v * 10) / 10; };
    let arbF, arbR;
    if (arbBalMode === 'man') {
      arbF = Math.max(1, Math.min(lim.arb, arbManF ?? 20));
      arbR = Math.max(1, Math.min(lim.arb, arbManR ?? 20));
    } else {
      arbF = clk(rsAbBudget * (1 - rF), ch.trackF);
      arbR = clk(rsAbBudget * rF, ch.trackR);
    }
    const rsAbF = arbF * ARB_RS_SCALE * ch.trackF * ch.trackF;
    const rsAbR = arbR * ARB_RS_SCALE * ch.trackR * ch.trackR;
    const rsTotal = rsSpF + rsSpR + rsAbF + rsAbR;
    const rollDeg = rsTotal > 0 ? rollMoment / rsTotal * (180 / Math.PI) : 0;
    const rollClamped = arbMode === 'roll' && Math.abs(rollDeg - arbTargetRoll) > 0.05;
    const nf = ch.frontBias / 100;
    const spShare = rsTotal > 0 ? (rsSpF + rsSpR) / rsTotal : 1;
    const abShare = rsTotal > 0 ? (rsAbF + rsAbR) / rsTotal : 0;
    const bSp = (rsSpF + rsSpR) > 0 ? (nf - (rsSpF / (rsSpF + rsSpR))) * 100 * spShare : 0;
    const bAb = (rsAbF + rsAbR) > 0 ? (nf - (rsAbF / (rsAbF + rsAbR))) * 100 * abShare : 0;
    const bTot = bSp + bAb;
    const rsKf = rsSpF + rsAbF, rsKr = rsSpR + rsAbR;
    const rsBalance = rsKf + rsKr > 0 ? rsKr / (rsKf + rsKr) : 1 - ch.frontBias / 100;
    const mechBalance = Math.max(0, Math.min(1, rsBalance + tireCorr));
    const gripBalance = balanceFromRsBal(ch, rsBalance);
    const mechBalClamped = (arbBalMode === 'mech' || arbBalMode === 'coSolve') && Math.abs(mechBalance - arbBalTarget) > 0.01;
    const settleF = zetaF > 0 ? 2.302 / ((zetaF / 100) * fHz * 2 * Math.PI) : 99;
    const settleR = zetaR > 0 ? 2.302 / ((zetaR / 100) * effectiveRHz * 2 * Math.PI) : 99;
    return {
      springF, springR,
      rebF: Math.round(rebF * 10) / 10, rebR: Math.round(rebR * 10) / 10,
      bumpF: Math.round(bumpF * 10) / 10, bumpR: Math.round(bumpR * 10) / 10,
      arbF, arbR,
      fHz, rHz: effectiveRHz, settle: settleF, settleR, rollDeg, rollTarget: arbTargetRoll, rollClamped, mechBalClamped, dampingClamped,
      arbShare: rsTotal > 0 ? (rsAbF + rsAbR) / rsTotal * 100 : 0,
      bSp, bAb, bTot, mechBalance, gripBalance,
      rsSpF, rsSpR, rsAbF, rsAbR,
      balArbSplit: (arbBalMode === 'mech' || arbBalMode === 'coSolve') ? Math.round(rF * 100) : null
    };
  };

  const computeAlignment = (ch, tune, layout, buildType) => {
    const { fHz, rHz, rollDeg } = tune;
    const build = buildType ?? 'track';
    const isDrift = build === 'drift';
    const isStreet = build === 'street';
    const camberGain = Math.max(0.55, Math.min(0.85, 1.05 - (ch.cgHeight ?? 0.45) * 0.8));
    const rearGainMult = layout === 'FWD' ? 0.50 : layout === 'AWD' ? 0.70 : 0.75;
    const fwdReduction = layout === 'FWD' ? 0.3 : 0.0;
    let recCamberF, recCamberR;
    if (isDrift) {
      recCamberF = layout === 'FWD' ? -2.0 : -3.0;
      recCamberR = layout === 'FWD' ? -1.0 : -1.5;
    } else {
      const optimalCamber = isStreet ? -1.0 : -1.5;
      recCamberF = Math.round(Math.max(-4.0, Math.min(0.0, optimalCamber - rollDeg * camberGain + fwdReduction)) * 10) / 10;
      recCamberR = Math.round(Math.max(-3.5, Math.min(0.0, optimalCamber - rollDeg * camberGain * rearGainMult)) * 10) / 10;
    }
    const toeFByBuild = { street: layout === 'FWD' ? 0.05 : 0.0, track: layout === 'FWD' ? 0.05 : -0.05, drift: layout === 'FWD' ? 0.0 : -0.10 }[build] ?? -0.05;
    const recToeF = Math.round(Math.max(-0.20, Math.min(0.15, toeFByBuild + (ch.frontBias - 50) * -0.003 + (fHz - 1.8) * 0.010)) * 10) / 10;
    const toeRBase = isDrift ? 0.05 : layout === 'RWD' ? (isStreet ? 0.15 : 0.10) : layout === 'AWD' ? 0.08 : 0.05;
    const recToeR = Math.round(Math.max(0.0, Math.min(0.25, toeRBase + ((1 - ch.frontBias / 100) - 0.5) * 0.20 + Math.max(0, rHz - fHz) * -0.03)) * 10) / 10;
    const casterBase = isDrift ? 4.8 : isStreet ? 5.2 : 5.8;
    const recCaster = parseFloat(Math.max(4.0, Math.min(7.5, casterBase + (fHz - 1.8) * 0.4 + (ch.frontBias - 50) * 0.04 + (layout === 'FWD' ? -0.5 : 0))).toFixed(1));
    return { recCamberF, recCamberR, recToeF, recToeR, recCaster };
  };

  const DIFF_BIAS_SCALE = 0.14;

  const computeDiff = (ch, fe, dr) => {
    const rB = 1 - ch.frontBias / 100;
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
    const biasExit = dr.diffBiasExit ?? 0;
    const biasEntry = dr.diffBiasEntry ?? 0;
    const frontExitBias = dr.diffFrontExitBias ?? 0;
    const build = dr.buildType ?? 'track';
    let effBiasExit = biasExit, effBiasEntry = biasEntry;
    if (dr.diffComplement && !dr.diffManual) {
      const cm = cornerMasses(ch);
      const natMechBal = (cm.rear * ch.trackR * ch.trackR) / (cm.front * ch.trackF * ch.trackF + cm.rear * ch.trackR * ch.trackR);
      const tgt = Math.max(0.40, Math.min(0.90, fe.arbBalTarget ?? MECH_BALANCE_TARGET));
      const gap = tgt - natMechBal;
      const correction = Math.max(-25, Math.min(25, gap * 150));
      effBiasExit = Math.max(-50, Math.min(50, biasExit + correction));
      effBiasEntry = Math.max(-50, Math.min(50, biasEntry + correction * 0.5));
    }
    let vals;
    if (dr.diffManual) {
      vals = dr.layout === 'AWD'
        ? { layout: 'AWD', frontAccel: dr.diffFrontAccel ?? 25, frontDecel: dr.diffFrontDecel ?? 0, rearAccel: dr.diffRearAccel ?? 50, rearDecel: dr.diffRearDecel ?? 10, center: dr.diffCenter ?? 65 }
        : { layout: dr.layout, accel: dr.diffAccel ?? 35, decel: dr.diffDecel ?? 10 };
    } else if (dr.layout === 'AWD') {
      const center = cl(dr.diffCenter ?? 65, 45, 80);
      vals = { layout: 'AWD', frontAccel: cl(28 - effBiasExit * 0.10 + frontExitBias * 0.12, 10, 40), frontDecel: 0, rearAccel: cl(48 + effBiasExit * 0.25, 20, 70), rearDecel: cl(8 + (rB - 0.5) * 15 + effBiasEntry * 0.15, 0, 20), center };
    } else {
      const isRWD = dr.layout === 'RWD';
      const accelBase = isRWD ? { street: 28, track: 35, drift: 48 }[build] : { street: 15, track: 20, drift: 12 }[build];
      const decelBase = isRWD ? { street: 15, track: 12, drift: 3 }[build] : { street: 8, track: 5, drift: 2 }[build];
      const accel = isRWD ? cl(accelBase + effBiasExit * 0.20, 10, 65) : cl(accelBase + effBiasExit * 0.15, 5, 35);
      const decel = cl(decelBase + (rB - 0.5) * (isRWD ? 15 : 5) + effBiasEntry * 0.15, 0, isRWD ? 30 : 15);
      vals = { layout: dr.layout, accel, decel };
    }
    const nf = ch.frontBias / 100;
    let bDiffAccel = 0, bDiffDecel = 0, bDiffFront = 0, bDiffRear = 0;
    if (vals.layout === 'AWD') {
      const C = Math.max(0, Math.min(1, (vals.center ?? 65) / 100));
      const bFA = -vals.frontAccel * nf * (1 - C) * DIFF_BIAS_SCALE;
      const bRA = vals.rearAccel * (1 - nf) * C * DIFF_BIAS_SCALE;
      const bFD = -vals.frontDecel * nf * (1 - C) * DIFF_BIAS_SCALE;
      const bRD = vals.rearDecel * (1 - nf) * C * DIFF_BIAS_SCALE;
      bDiffFront = bFA + bFD;
      bDiffRear = bRA + bRD;
      bDiffAccel = bFA + bRA;
      bDiffDecel = bFD + bRD;
    } else if (vals.layout === 'RWD') {
      bDiffAccel = vals.accel * (1 - nf) * DIFF_BIAS_SCALE;
      bDiffDecel = vals.decel * (1 - nf) * DIFF_BIAS_SCALE;
    } else {
      bDiffAccel = -vals.accel * nf * DIFF_BIAS_SCALE;
      bDiffDecel = -vals.decel * nf * DIFF_BIAS_SCALE;
    }
    return { ...vals, bDiffAccel, bDiffDecel, bDiffFront, bDiffRear };
  };

  const computeCheck = (spr, damp, masses) => {
    const wrF = spr.f * LB_IN_TO_NM, wrR = spr.r * LB_IN_TO_NM;
    const hF = wrF > 0 ? Math.sqrt(wrF / masses.front) / (2 * Math.PI) : 0;
    const hR = wrR > 0 ? Math.sqrt(wrR / masses.rear) / (2 * Math.PI) : 0;
    const ccF = 2 * Math.sqrt(wrF * masses.front), ccR = 2 * Math.sqrt(wrR * masses.rear);
    return {
      hF, hR,
      zRebF: ccF > 0 ? (damp.rebF / DAMPING_CALIBRATION / ccF) * 100 : 0,
      zRebR: ccR > 0 ? (damp.rebR / DAMPING_CALIBRATION / ccR) * 100 : 0,
      zBmpF: ccF > 0 ? (damp.bumpF / DAMPING_CALIBRATION / ccF) * 100 : 0,
      zBmpR: ccR > 0 ? (damp.bumpR / DAMPING_CALIBRATION / ccR) * 100 : 0
    };
  };

  return {
    KG_TO_LB, LB_IN_TO_NM, MPH_TO_MS, KMH_PER_MPH, NMM_PER_LBIN, ARB_RS_SCALE, rollCenterHeight, DAMPING_CALIBRATION,
    TIRE_LOAD_SENS, MECH_BAL_GAIN, WIDTH_GRIP_EXP, TIRE_MECH_SCALE, MECH_BALANCE_TARGET, GAME_LIMITS, HZ_MIN, HZ_MAX, HZ_RANGE,
    cornerMasses, parseTyre, rsToHz, hzToRs, flatRideRearHz, flatRideSharedHz, solveSpring, solveDamp, solveDampRaw,
    mechBalanceLLT, balanceFromRsBal, feelToPhysics, computeTune, computeAlignment, computeDiff, computeCheck
  };
}));
