/**
 * Comparator blocks — Siemens CFC `COMPARE` family (CMP_R for REAL, CMP_I for
 * INT). Unlike LAD/FBD where GT/LT/EQ are separate instructions, one CFC
 * comparator compares IN1 and IN2 and exposes ALL six relational results
 * simultaneously: GT, GE, EQ, NE, LE, LT. EN/ENO via elementary().
 */
import type { BlockDefinition } from '../types';
import { elementary } from './elementary';

const num = (v: unknown) => Number(v) || 0;
const C = '#0891b2';

function comparator(type: string, name: string, dtype: 'REAL' | 'INT'): BlockDefinition {
  return elementary({
    type,
    name,
    category: 'Compare',
    description: `Compares IN1 with IN2 and drives all six relational outputs (GT, GE, EQ, NE, LE, LT).`,
    color: C,
    inputs: [
      { id: 'in1', name: 'IN1', type: dtype, default: 0 },
      { id: 'in2', name: 'IN2', type: dtype, default: 0 },
    ],
    outputs: [
      { id: 'gt', name: 'GT', type: 'BOOL', description: 'IN1 > IN2' },
      { id: 'ge', name: 'GE', type: 'BOOL', description: 'IN1 ≥ IN2' },
      { id: 'eq', name: 'EQ', type: 'BOOL', description: 'IN1 = IN2' },
      { id: 'ne', name: 'NE', type: 'BOOL', description: 'IN1 ≠ IN2' },
      { id: 'le', name: 'LE', type: 'BOOL', description: 'IN1 ≤ IN2' },
      { id: 'lt', name: 'LT', type: 'BOOL', description: 'IN1 < IN2' },
    ],
    evaluate: ({ inputs }) => {
      const a = num(inputs.in1);
      const b = num(inputs.in2);
      return {
        gt: a > b,
        ge: a >= b,
        eq: a === b,
        ne: a !== b,
        le: a <= b,
        lt: a < b,
      };
    },
  });
}

export const compareBlocks: BlockDefinition[] = [
  comparator('CMP_R', 'Compare (REAL)', 'REAL'),
  comparator('CMP_I', 'Compare (INT)', 'INT'),
];
