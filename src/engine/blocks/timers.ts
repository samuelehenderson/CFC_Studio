/**
 * Timer function blocks (IEC 61131-3 style, used directly in CFC):
 *   TON — on-delay   TOF — off-delay   TP — pulse   TONR — retentive on-delay.
 * Times are in seconds. The accumulated elapsed time ET is exposed as an
 * output, matching Siemens/IEC timer blocks.
 */
import type { BlockDefinition } from '../types';

const bool = (v: unknown) => v === true || (typeof v === 'number' && v !== 0);
const num = (v: unknown) => Number(v) || 0;

export const timerBlocks: BlockDefinition[] = [
  {
    type: 'TON',
    name: 'On-Delay Timer',
    category: 'Timers',
    description: 'Q goes TRUE after IN has been TRUE continuously for PT seconds.',
    color: '#dc2626',
    stateful: true,
    inputs: [
      { id: 'in', name: 'IN', type: 'BOOL', default: false },
      { id: 'pt', name: 'PT', type: 'REAL', default: 5, description: 'Preset time (s)' },
    ],
    outputs: [
      { id: 'q', name: 'Q', type: 'BOOL' },
      { id: 'et', name: 'ET', type: 'REAL' },
    ],
    initState: () => ({ et: 0 }),
    evaluate: ({ inputs, dt, state }) => {
      const pt = Math.max(0, num(inputs.pt));
      let et = state.et as number;
      if (bool(inputs.in)) et = Math.min(pt, et + dt);
      else et = 0;
      state.et = et;
      return { q: bool(inputs.in) && et >= pt, et };
    },
  },
  {
    type: 'TOF',
    name: 'Off-Delay Timer',
    category: 'Timers',
    description: 'Q stays TRUE for PT seconds after IN falls to FALSE.',
    color: '#dc2626',
    stateful: true,
    inputs: [
      { id: 'in', name: 'IN', type: 'BOOL', default: false },
      { id: 'pt', name: 'PT', type: 'REAL', default: 5, description: 'Preset time (s)' },
    ],
    outputs: [
      { id: 'q', name: 'Q', type: 'BOOL' },
      { id: 'et', name: 'ET', type: 'REAL' },
    ],
    initState: () => ({ et: 0, q: false }),
    evaluate: ({ inputs, dt, state }) => {
      const pt = Math.max(0, num(inputs.pt));
      const inOn = bool(inputs.in);
      let et = state.et as number;
      let q = state.q as boolean;
      if (inOn) {
        et = 0;
        q = true;
      } else if (q) {
        et = Math.min(pt, et + dt);
        if (et >= pt) q = false;
      }
      state.et = et;
      state.q = q;
      return { q, et };
    },
  },
  {
    type: 'TP',
    name: 'Pulse Timer',
    category: 'Timers',
    description: 'A rising edge on IN produces a fixed pulse of PT seconds on Q.',
    color: '#dc2626',
    stateful: true,
    inputs: [
      { id: 'in', name: 'IN', type: 'BOOL', default: false },
      { id: 'pt', name: 'PT', type: 'REAL', default: 5, description: 'Pulse width (s)' },
    ],
    outputs: [
      { id: 'q', name: 'Q', type: 'BOOL' },
      { id: 'et', name: 'ET', type: 'REAL' },
    ],
    initState: () => ({ et: 0, q: false, prevIn: false, running: false }),
    evaluate: ({ inputs, dt, state }) => {
      const pt = Math.max(0, num(inputs.pt));
      const inOn = bool(inputs.in);
      const rising = inOn && !(state.prevIn as boolean);
      let et = state.et as number;
      let running = state.running as boolean;
      if (rising && !running) {
        running = true;
        et = 0;
      }
      if (running) {
        et = Math.min(pt, et + dt);
        if (et >= pt && !inOn) running = false;
      }
      const q = running;
      state.prevIn = inOn;
      state.et = et;
      state.running = running;
      state.q = q;
      return { q, et };
    },
  },
  {
    type: 'TONR',
    name: 'Retentive On-Delay',
    category: 'Timers',
    description: 'Accumulates the time IN is TRUE across multiple pulses. Q goes TRUE when total ≥ PT. R resets the accumulator.',
    color: '#dc2626',
    stateful: true,
    inputs: [
      { id: 'in', name: 'IN', type: 'BOOL', default: false },
      { id: 'r', name: 'R', type: 'BOOL', default: false },
      { id: 'pt', name: 'PT', type: 'REAL', default: 5, description: 'Preset time (s)' },
    ],
    outputs: [
      { id: 'q', name: 'Q', type: 'BOOL' },
      { id: 'et', name: 'ET', type: 'REAL' },
    ],
    initState: () => ({ et: 0 }),
    evaluate: ({ inputs, dt, state }) => {
      const pt = Math.max(0, num(inputs.pt));
      let et = state.et as number;
      if (bool(inputs.r)) et = 0;
      else if (bool(inputs.in)) et = Math.min(pt, et + dt);
      state.et = et;
      return { q: et >= pt && pt > 0, et };
    },
  },
];
