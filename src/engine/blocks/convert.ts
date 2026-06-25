/**
 * Type conversion blocks. Siemens CFC requires a CONVERT block between pins of
 * different data types (you cannot wire e.g. INT straight into a REAL pin).
 * Naming convention is <source>_<dest>: R_I (REAL→INT), I_R (INT→REAL).
 *
 * B_R / R_B (BOOL↔REAL) are simulator conveniences — on real hardware BOOL↔REAL
 * is done via an INT intermediate, but a direct pair is handy when prototyping.
 */
import type { BlockDefinition } from '../types';
import { elementary } from './elementary';

const num = (v: unknown) => Number(v) || 0;
const bool = (v: unknown) => v === true || (typeof v === 'number' && v !== 0);
const C = '#475569';

function convert(
  type: string,
  name: string,
  from: 'REAL' | 'INT' | 'BOOL',
  to: 'REAL' | 'INT' | 'BOOL',
  fn: (v: number | boolean) => number | boolean,
  desc: string,
): BlockDefinition {
  return elementary({
    type,
    name,
    category: 'Math',
    description: desc,
    color: C,
    inputs: [{ id: 'in1', name: 'IN', type: from, default: from === 'BOOL' ? false : 0 }],
    outputs: [{ id: 'out', name: 'OUT', type: to }],
    evaluate: ({ inputs }) => ({
      out: fn(from === 'BOOL' ? bool(inputs.in1) : num(inputs.in1)),
    }),
  });
}

export const convertBlocks: BlockDefinition[] = [
  convert('R_I', 'REAL → INT', 'REAL', 'INT', (v) => Math.round(Number(v)), 'Rounds a REAL to the nearest integer.'),
  convert('I_R', 'INT → REAL', 'INT', 'REAL', (v) => Number(v), 'Widens an integer to REAL.'),
  convert('R_B', 'REAL → BOOL', 'REAL', 'BOOL', (v) => Number(v) !== 0, 'OUT = 1 when IN ≠ 0 (simulator convenience).'),
  convert('B_R', 'BOOL → REAL', 'BOOL', 'REAL', (v) => (v ? 1 : 0), 'OUT = 1.0 when IN is TRUE, else 0.0 (simulator convenience).'),
];
