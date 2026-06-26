/**
 * Closed-loop control blocks (Desigo building-automation names).
 *
 *   LOOP   — building-automation universal PID (the PPCL LOOP successor).
 *            Setpoint W, process value X, output Y; tuning Kp / Tn / Tv;
 *            direct/reverse acting; external tracking. [INFERRED pin names]
 *   CONT_C — SIMATIC continuous PID (SFB 41) with its documented pin table.
 *            A DISTINCT block from LOOP — different pins, not interchangeable.
 *   INT_P  — integrator (with hold/reset)
 *   DIF_P  — differentiator (rate of change)
 *   PT1_P  — first-order lag / exponential filter
 *   RAMP_P — rate-limited tracking of a target
 *   HYST   — two-position (bang-bang) controller with deadband
 *
 * These re-solve every cycle using dt, matching continuous panel integration.
 * LOOP uses the ideal/parallel form the engineer tunes:
 *   Y = Kp·[e + (1/Tn)∫e dt + Tv·de/dt],  e = W − X (reverse) or X − W (direct)
 * Note: in HVAC, reverse-acting (raise output as PV falls below SP) is typical
 * for heating; direct-acting for cooling.
 */
import type { BlockDefinition } from '../types';

const num = (v: unknown) => Number(v) || 0;
const bool = (v: unknown) => v === true || (typeof v === 'number' && v !== 0);
const C = '#ea580c';

export const controlBlocks: BlockDefinition[] = [
  {
    type: 'LOOP',
    name: 'PID Loop (BA)',
    category: 'Control',
    provenance: 'inferred',
    sourceDoc: 'Desigo PX/PXC LOOP (ABT); pin names inferred — see docs/CFC-reference.md §2.9e',
    description:
      'Building-automation universal PID (P/PI/PD/PID). Y = Kp·[e + (1/Tn)∫e dt + Tv·de/dt]. Reverse acting (heating): e = W − X. Output clamped to [Ymin, Ymax] with integral anti-windup; TRK forces Y to the tracking value (bumpless). Distinct from SIMATIC CONT_C.',
    color: C,
    stateful: true,
    inputs: [
      { id: 'w', name: 'W', type: 'REAL', default: 0, description: 'Setpoint' },
      { id: 'x', name: 'X', type: 'REAL', default: 0, description: 'Process value' },
      { id: 'trk', name: 'TRK', type: 'BOOL', default: false, description: 'Tracking (manual) mode' },
      { id: 'trkv', name: 'TRKV', type: 'REAL', default: 0, description: 'Tracking value' },
    ],
    params: [
      { id: 'kp', name: 'Kp (gain)', type: 'REAL', default: 1 },
      { id: 'tn', name: 'Tn reset (s)', type: 'REAL', default: 60, min: 0 },
      { id: 'tv', name: 'Tv rate (s)', type: 'REAL', default: 0, min: 0 },
      { id: 'action', name: 'Action', type: 'ENUM', default: 'REVERSE', options: ['REVERSE', 'DIRECT'] },
      { id: 'ymin', name: 'Y min', type: 'REAL', default: 0 },
      { id: 'ymax', name: 'Y max', type: 'REAL', default: 100 },
    ],
    outputs: [
      { id: 'y', name: 'Y', type: 'REAL' },
      { id: 'e', name: 'E', type: 'REAL' },
    ],
    initState: () => ({ integral: 0, prevX: 0, init: false }),
    evaluate: ({ inputs, params, state, dt }) => {
      const w = num(inputs.w);
      const x = num(inputs.x);
      const kp = num(params.kp);
      const tn = num(params.tn);
      const tv = num(params.tv);
      const ymin = num(params.ymin);
      const ymax = num(params.ymax);
      const reverse = params.action !== 'DIRECT';
      const e = reverse ? w - x : x - w;

      if (!state.init) {
        state.prevX = x;
        state.init = true;
      }

      // Tracking / manual: hold Y at TRKV and back-calculate the integral so
      // returning to auto is bumpless.
      if (bool(inputs.trk)) {
        const yt = Math.max(ymin, Math.min(ymax, num(inputs.trkv)));
        state.integral = yt - kp * e;
        state.prevX = x;
        return { y: yt, e };
      }

      let integral = state.integral as number;
      const prevIntegral = integral;
      if (tn > 0) integral += (kp / tn) * e * dt;

      // Derivative on measurement to avoid setpoint-kick.
      const dX = (x - (state.prevX as number)) / (dt || 1);
      const deriv = -kp * tv * (reverse ? -dX : dX);

      let y = kp * e + integral + deriv;

      // Clamp with conditional integration anti-windup.
      if (y > ymax) {
        y = ymax;
        if (tn > 0) integral = prevIntegral;
      } else if (y < ymin) {
        y = ymin;
        if (tn > 0) integral = prevIntegral;
      }

      state.integral = integral;
      state.prevX = x;
      return { y, e };
    },
  },
  {
    type: 'CONT_C',
    name: 'CONT_C (SIMATIC PID)',
    category: 'Control',
    provenance: 'confirmed',
    sourceDoc: 'SIMATIC Standard PID Control, Stdpid_e.pdf — SFB 41 CONT_C',
    description:
      'SIMATIC continuous PID controller (SFB 41). e = SP_INT − PV_IN (with DEADB_W deadband). Parallel P/I/D with GAIN, TI, TD and derivative lag TM_LAG. Output LMN = LIMIT(P+I+D, LMN_LLM..LMN_HLM)·LMN_FAC + LMN_OFF, with anti-windup. MAN_ON tracks MAN (bumpless). Reverse action: negative GAIN.',
    color: C,
    stateful: true,
    inputs: [
      { id: 'sp_int', name: 'SP_INT', type: 'REAL', default: 0, description: 'Internal setpoint' },
      { id: 'pv_in', name: 'PV_IN', type: 'REAL', default: 0, description: 'Process value' },
      { id: 'man', name: 'MAN', type: 'REAL', default: 0, description: 'Manual manipulated value' },
      { id: 'man_on', name: 'MAN_ON', type: 'BOOL', default: false, description: 'Manual mode on' },
    ],
    params: [
      { id: 'gain', name: 'GAIN (Kp)', type: 'REAL', default: 2 },
      { id: 'ti', name: 'TI integral (s)', type: 'REAL', default: 60, min: 0 },
      { id: 'td', name: 'TD derivative (s)', type: 'REAL', default: 10, min: 0 },
      { id: 'tm_lag', name: 'TM_LAG D-lag (s)', type: 'REAL', default: 2, min: 0 },
      { id: 'deadb_w', name: 'DEADB_W deadband', type: 'REAL', default: 0, min: 0 },
      { id: 'lmn_hlm', name: 'LMN_HLM (high)', type: 'REAL', default: 100 },
      { id: 'lmn_llm', name: 'LMN_LLM (low)', type: 'REAL', default: 0 },
      { id: 'lmn_fac', name: 'LMN_FAC scale', type: 'REAL', default: 1 },
      { id: 'lmn_off', name: 'LMN_OFF offset', type: 'REAL', default: 0 },
    ],
    outputs: [
      { id: 'lmn', name: 'LMN', type: 'REAL' },
      { id: 'qlmn_hlm', name: 'QLMN_HLM', type: 'BOOL' },
      { id: 'qlmn_llm', name: 'QLMN_LLM', type: 'BOOL' },
      { id: 'lmn_p', name: 'LMN_P', type: 'REAL' },
      { id: 'lmn_i', name: 'LMN_I', type: 'REAL' },
      { id: 'lmn_d', name: 'LMN_D', type: 'REAL' },
    ],
    initState: () => ({ integral: 0, prevPv: 0, dFilt: 0, init: false }),
    evaluate: ({ inputs, params, state, dt }) => {
      const sp = num(inputs.sp_int);
      const pv = num(inputs.pv_in);
      const gain = num(params.gain);
      const ti = num(params.ti);
      const td = num(params.td);
      const tmLag = Math.max(0, num(params.tm_lag));
      const db = Math.abs(num(params.deadb_w));
      const hlm = num(params.lmn_hlm);
      const llm = num(params.lmn_llm);
      const fac = num(params.lmn_fac);
      const off = num(params.lmn_off);

      // Error with symmetric deadband around zero.
      let e = sp - pv;
      if (Math.abs(e) <= db) e = 0;
      else e -= Math.sign(e) * db;

      if (!state.init) {
        state.prevPv = pv;
        state.init = true;
      }

      const p = gain * e;

      // Manual: hold LMN at MAN, back-calculate integral for bumpless return.
      if (bool(inputs.man_on)) {
        const limited = Math.max(llm, Math.min(hlm, num(inputs.man)));
        state.integral = limited - p;
        state.prevPv = pv;
        return {
          lmn: limited * fac + off,
          qlmn_hlm: num(inputs.man) >= hlm,
          qlmn_llm: num(inputs.man) <= llm,
          lmn_p: p,
          lmn_i: state.integral as number,
          lmn_d: 0,
        };
      }

      let integral = state.integral as number;
      const prevIntegral = integral;
      if (ti > 0) integral += (gain / ti) * e * dt;

      // Derivative on measurement, first-order lag filtered by TM_LAG.
      const dPv = (pv - (state.prevPv as number)) / (dt || 1);
      const dRaw = -gain * td * dPv;
      let dFilt = state.dFilt as number;
      dFilt += (dRaw - dFilt) * (dt / (tmLag + dt));

      let sum = p + integral + dFilt;
      let qh = false;
      let ql = false;
      if (sum > hlm) {
        sum = hlm;
        qh = true;
        if (ti > 0) integral = prevIntegral; // anti-windup
      } else if (sum < llm) {
        sum = llm;
        ql = true;
        if (ti > 0) integral = prevIntegral;
      }

      state.integral = integral;
      state.dFilt = dFilt;
      state.prevPv = pv;
      return {
        lmn: sum * fac + off,
        qlmn_hlm: qh,
        qlmn_llm: ql,
        lmn_p: p,
        lmn_i: integral,
        lmn_d: dFilt,
      };
    },
  },
  {
    type: 'INT_P',
    name: 'Integrator',
    category: 'Control',
    description: 'Y += IN·dt/Tn each cycle. HOLD freezes Y; R forces Y = 0. Output clamped to limits.',
    color: C,
    stateful: true,
    inputs: [
      { id: 'in1', name: 'IN', type: 'REAL', default: 0 },
      { id: 'hold', name: 'HOLD', type: 'BOOL', default: false },
      { id: 'r', name: 'R', type: 'BOOL', default: false },
    ],
    params: [
      { id: 'tn', name: 'Time const Tn (s)', type: 'REAL', default: 1, min: 0.001 },
      { id: 'lo', name: 'Out Low', type: 'REAL', default: -1e6 },
      { id: 'hi', name: 'Out High', type: 'REAL', default: 1e6 },
    ],
    outputs: [{ id: 'out', name: 'OUT', type: 'REAL' }],
    initState: () => ({ y: 0 }),
    evaluate: ({ inputs, params, state, dt }) => {
      let y = state.y as number;
      if (bool(inputs.r)) y = 0;
      else if (!bool(inputs.hold)) y += (num(inputs.in1) * dt) / Math.max(0.001, num(params.tn));
      y = Math.max(num(params.lo), Math.min(num(params.hi), y));
      state.y = y;
      return { out: y };
    },
  },
  {
    type: 'DIF_P',
    name: 'Differentiator',
    category: 'Control',
    description: 'Rate of change: OUT = Tv·d(IN)/dt, smoothed over the cycle.',
    color: C,
    stateful: true,
    inputs: [{ id: 'in1', name: 'IN', type: 'REAL', default: 0 }],
    params: [{ id: 'tv', name: 'Gain Tv (s)', type: 'REAL', default: 1, min: 0 }],
    outputs: [{ id: 'out', name: 'OUT', type: 'REAL' }],
    initState: () => ({ prev: 0, init: false }),
    evaluate: ({ inputs, params, state, dt }) => {
      const x = num(inputs.in1);
      if (!state.init) {
        state.prev = x;
        state.init = true;
      }
      const out = num(params.tv) * ((x - (state.prev as number)) / (dt || 1));
      state.prev = x;
      return { out };
    },
  },
  {
    type: 'PT1_P',
    name: 'First-Order Filter',
    category: 'Control',
    description: 'Exponential lag (PT1): OUT += (IN − OUT)·(dt / (T + dt)). T is the time constant in seconds.',
    color: C,
    stateful: true,
    inputs: [{ id: 'in1', name: 'IN', type: 'REAL', default: 0 }],
    params: [{ id: 't', name: 'Time const T (s)', type: 'REAL', default: 5, min: 0 }],
    outputs: [{ id: 'out', name: 'OUT', type: 'REAL' }],
    initState: () => ({ y: 0, init: false }),
    evaluate: ({ inputs, params, state, dt }) => {
      const x = num(inputs.in1);
      if (!state.init) {
        state.y = x;
        state.init = true;
      }
      const t = Math.max(0, num(params.t));
      let y = state.y as number;
      y += (x - y) * (dt / (t + dt));
      state.y = y;
      return { out: y };
    },
  },
  {
    type: 'RAMP_P',
    name: 'Ramp',
    category: 'Control',
    description: 'Drives OUT toward target IN at a maximum rate (units/second), separately up and down.',
    color: C,
    stateful: true,
    inputs: [{ id: 'in1', name: 'IN', type: 'REAL', default: 0 }],
    params: [
      { id: 'up', name: 'Rate up (/s)', type: 'REAL', default: 10, min: 0 },
      { id: 'down', name: 'Rate down (/s)', type: 'REAL', default: 10, min: 0 },
    ],
    outputs: [{ id: 'out', name: 'OUT', type: 'REAL' }],
    initState: () => ({ y: 0 }),
    evaluate: ({ inputs, params, state, dt }) => {
      const x = num(inputs.in1);
      let y = state.y as number;
      const maxUp = num(params.up) * dt;
      const maxDown = num(params.down) * dt;
      if (x > y) y = Math.min(x, y + maxUp);
      else if (x < y) y = Math.max(x, y - maxDown);
      state.y = y;
      return { out: y };
    },
  },
  {
    type: 'HYST',
    name: 'Hysteresis (2-position)',
    category: 'Control',
    description: 'Two-position controller. HEAT: Q on when X ≤ W−DB, off when X ≥ W+DB. COOL inverts.',
    color: C,
    stateful: true,
    inputs: [
      { id: 'x', name: 'X', type: 'REAL', default: 0 },
      { id: 'w', name: 'W', type: 'REAL', default: 0 },
    ],
    params: [
      { id: 'db', name: 'Deadband ±', type: 'REAL', default: 1, min: 0 },
      { id: 'mode', name: 'Mode', type: 'ENUM', default: 'HEAT', options: ['HEAT', 'COOL'] },
    ],
    outputs: [{ id: 'q', name: 'Q', type: 'BOOL' }],
    initState: () => ({ q: false }),
    evaluate: ({ inputs, params, state }) => {
      const x = num(inputs.x);
      const w = num(inputs.w);
      const db = Math.abs(num(params.db));
      let q = state.q as boolean;
      if (params.mode === 'COOL') {
        if (!q && x >= w + db) q = true;
        else if (q && x <= w - db) q = false;
      } else {
        if (!q && x <= w - db) q = true;
        else if (q && x >= w + db) q = false;
      }
      state.q = q;
      return { q };
    },
  },
];
