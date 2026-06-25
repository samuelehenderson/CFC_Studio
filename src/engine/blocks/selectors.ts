/**
 * Selector / multiplexer / extremum / limiter blocks — Siemens CFC
 * `MULTIPLX` and `MATH_FP` families: SEL_R, SEL_BO, MUX_R, MAX_R, MIN_R,
 * LIM_R. EN/ENO via elementary().
 */
import type { BlockDefinition } from '../types';
import { elementary } from './elementary';

const num = (v: unknown) => Number(v) || 0;
const bool = (v: unknown) => v === true || (typeof v === 'number' && v !== 0);
const C = '#ca8a04';

export const selectorBlocks: BlockDefinition[] = [
  elementary({
    type: 'SEL_R',
    name: 'Select (REAL)',
    category: 'Selectors',
    description: 'OUT = K ? IN1 : IN0. Routes one of two REAL inputs by binary selector K.',
    color: C,
    inputs: [
      { id: 'in0', name: 'IN0', type: 'REAL', default: 0 },
      { id: 'in1', name: 'IN1', type: 'REAL', default: 0 },
      { id: 'k', name: 'K', type: 'BOOL', default: false },
    ],
    outputs: [{ id: 'out', name: 'OUT', type: 'REAL' }],
    evaluate: ({ inputs }) => ({ out: bool(inputs.k) ? num(inputs.in1) : num(inputs.in0) }),
  }),
  elementary({
    type: 'SEL_BO',
    name: 'Select (BOOL)',
    category: 'Selectors',
    description: 'OUT = K ? IN1 : IN0. Routes one of two binary inputs by selector K.',
    color: C,
    inputs: [
      { id: 'in0', name: 'IN0', type: 'BOOL', default: false },
      { id: 'in1', name: 'IN1', type: 'BOOL', default: false },
      { id: 'k', name: 'K', type: 'BOOL', default: false },
    ],
    outputs: [{ id: 'out', name: 'OUT', type: 'BOOL' }],
    evaluate: ({ inputs }) => ({ out: bool(inputs.k) ? bool(inputs.in1) : bool(inputs.in0) }),
  }),
  elementary({
    type: 'MUX_R',
    name: 'Multiplexer (REAL)',
    category: 'Selectors',
    description: 'Selects one of four REAL inputs IN0..IN3 by integer selector K (0–3).',
    color: C,
    inputs: [
      { id: 'k', name: 'K', type: 'INT', default: 0 },
      { id: 'in0', name: 'IN0', type: 'REAL', default: 0 },
      { id: 'in1', name: 'IN1', type: 'REAL', default: 0 },
      { id: 'in2', name: 'IN2', type: 'REAL', default: 0 },
      { id: 'in3', name: 'IN3', type: 'REAL', default: 0 },
    ],
    outputs: [{ id: 'out', name: 'OUT', type: 'REAL' }],
    evaluate: ({ inputs }) => {
      const k = Math.max(0, Math.min(3, Math.trunc(num(inputs.k))));
      return { out: num(inputs[`in${k}`]) };
    },
  }),
  extremum('MAX_R', 'Maximum (REAL)', (vals) => Math.max(...vals)),
  extremum('MIN_R', 'Minimum (REAL)', (vals) => Math.min(...vals)),
  elementary({
    type: 'LIM_R',
    name: 'Limiter (REAL)',
    category: 'Selectors',
    description: 'Clamp IN to [LO_LIM, HI_LIM]. QH / QL flag when a limit is active.',
    color: C,
    inputs: [
      { id: 'in1', name: 'IN', type: 'REAL', default: 0 },
      { id: 'lo', name: 'LO_LIM', type: 'REAL', default: 0 },
      { id: 'hi', name: 'HI_LIM', type: 'REAL', default: 100 },
    ],
    outputs: [
      { id: 'out', name: 'OUT', type: 'REAL' },
      { id: 'qh', name: 'QH', type: 'BOOL' },
      { id: 'ql', name: 'QL', type: 'BOOL' },
    ],
    evaluate: ({ inputs }) => {
      const x = num(inputs.in1);
      const lo = num(inputs.lo);
      const hi = num(inputs.hi);
      if (x > hi) return { out: hi, qh: true, ql: false };
      if (x < lo) return { out: lo, qh: false, ql: true };
      return { out: x, qh: false, ql: false };
    },
  }),
];

function extremum(type: string, name: string, fn: (vals: number[]) => number): BlockDefinition {
  return elementary({
    type,
    name,
    category: 'Selectors',
    description: `OUT = ${type === 'MAX_R' ? 'maximum' : 'minimum'} of the connected inputs IN1..IN4.`,
    color: C,
    inputs: [
      { id: 'in1', name: 'IN1', type: 'REAL', default: 0 },
      { id: 'in2', name: 'IN2', type: 'REAL', default: 0 },
      { id: 'in3', name: 'IN3', type: 'REAL', default: 0 },
      { id: 'in4', name: 'IN4', type: 'REAL', default: 0 },
    ],
    params: [{ id: 'count', name: 'Active inputs', type: 'INT', default: 2, min: 2, max: 4 }],
    outputs: [{ id: 'out', name: 'OUT', type: 'REAL' }],
    evaluate: ({ inputs, params }) => {
      const n = Math.min(4, Math.max(2, Number(params.count) || 2));
      const vals = ['in1', 'in2', 'in3', 'in4'].slice(0, n).map((k) => num(inputs[k]));
      return { out: fn(vals) };
    },
  });
}
