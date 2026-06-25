/**
 * Boolean logic blocks — Siemens CFC `BIT_LGC` family. Multi-input gates take
 * IN1..INn. Unconnected AND/NAND inputs default 1; OR/NOR/XOR default 0, so an
 * open input never changes the result. EN/ENO via elementary().
 */
import type { BlockDefinition } from '../types';
import { elementary } from './elementary';

const bool = (v: unknown) => v === true || (typeof v === 'number' && v !== 0);
const C = '#7c3aed';

function gate(
  type: string,
  name: string,
  desc: string,
  kind: 'all' | 'any',
  invert = false,
): BlockDefinition {
  const openDefault = kind === 'all'; // open AND/NAND inputs = 1; OR/NOR = 0
  return elementary({
    type,
    name,
    category: 'Logic',
    description: desc,
    color: C,
    inputs: ['in1', 'in2', 'in3', 'in4'].map((id, i) => ({
      id,
      name: `IN${i + 1}`,
      type: 'BOOL' as const,
      default: openDefault,
    })),
    outputs: [{ id: 'out', name: 'OUT', type: 'BOOL' }],
    evaluate: ({ inputs }) => {
      const vals = [inputs.in1, inputs.in2, inputs.in3, inputs.in4].map(bool);
      const r = kind === 'all' ? vals.every(Boolean) : vals.some(Boolean);
      return { out: invert ? !r : r };
    },
  });
}

export const logicBlocks: BlockDefinition[] = [
  gate('AND', 'AND', 'OUT = 1 when every connected input is 1.', 'all'),
  gate('OR', 'OR', 'OUT = 1 when at least one input is 1.', 'any'),
  gate('NAND', 'NAND', 'OUT = 0 only when every input is 1.', 'all', true),
  gate('NOR', 'NOR', 'OUT = 1 only when every input is 0.', 'any', true),
  elementary({
    type: 'XOR',
    name: 'XOR',
    category: 'Logic',
    description: 'Exclusive OR: OUT = 1 when an odd number of inputs are 1.',
    color: C,
    inputs: [
      { id: 'in1', name: 'IN1', type: 'BOOL', default: false },
      { id: 'in2', name: 'IN2', type: 'BOOL', default: false },
    ],
    outputs: [{ id: 'out', name: 'OUT', type: 'BOOL' }],
    evaluate: ({ inputs }) => ({ out: bool(inputs.in1) !== bool(inputs.in2) }),
  }),
  elementary({
    type: 'NOT',
    name: 'NOT',
    category: 'Logic',
    description: 'Logical inversion: OUT = ¬IN.',
    color: C,
    inputs: [{ id: 'in1', name: 'IN', type: 'BOOL', default: false }],
    outputs: [{ id: 'out', name: 'OUT', type: 'BOOL' }],
    evaluate: ({ inputs }) => ({ out: !bool(inputs.in1) }),
  }),
];
