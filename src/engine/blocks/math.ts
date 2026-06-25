/**
 * Arithmetic and math-function blocks — Siemens CFC `MATH_FP` (REAL) and
 * `MATH_INT` (INT) families. Naming convention is <OP>_<type>, e.g. ADD_R
 * (REAL add) and ADD_I (INT add). Math functions (SQRT, EXP, ...) operate on
 * REAL. All carry EN/ENO via elementary().
 */
import type { BlockDefinition } from '../types';
import { elementary } from './elementary';

const num = (v: unknown) => Number(v) || 0;
const C = '#2563eb';

/** Two-operand arithmetic for a given data type. */
function arith(
  type: string,
  name: string,
  dtype: 'REAL' | 'INT',
  desc: string,
  fn: (a: number, b: number) => number,
  defA = 0,
  defB = 0,
): BlockDefinition {
  return elementary({
    type,
    name,
    category: 'Math',
    description: desc,
    color: C,
    inputs: [
      { id: 'in1', name: 'IN1', type: dtype, default: defA },
      { id: 'in2', name: 'IN2', type: dtype, default: defB },
    ],
    outputs: [{ id: 'out', name: 'OUT', type: dtype }],
    evaluate: ({ inputs }) => ({ out: fn(num(inputs.in1), num(inputs.in2)) }),
  });
}

/** Single-operand REAL math function. */
function func1(
  type: string,
  name: string,
  desc: string,
  fn: (a: number) => number,
  guardErr?: (a: number) => boolean,
): BlockDefinition {
  return elementary({
    type,
    name,
    category: 'Math',
    description: desc,
    color: C,
    inputs: [{ id: 'in1', name: 'IN', type: 'REAL', default: 0 }],
    outputs: [{ id: 'out', name: 'OUT', type: 'REAL' }],
    evaluate: ({ inputs }) => {
      const a = num(inputs.in1);
      if (guardErr?.(a)) return { out: 0, _eno: false };
      return { out: fn(a) };
    },
  });
}

export const mathBlocks: BlockDefinition[] = [
  arith('ADD_R', 'Add (REAL)', 'REAL', 'OUT = IN1 + IN2.', (a, b) => a + b),
  arith('SUB_R', 'Subtract (REAL)', 'REAL', 'OUT = IN1 − IN2.', (a, b) => a - b),
  arith('MUL_R', 'Multiply (REAL)', 'REAL', 'OUT = IN1 × IN2.', (a, b) => a * b, 1, 1),
  elementary({
    type: 'DIV_R',
    name: 'Divide (REAL)',
    category: 'Math',
    description: 'OUT = IN1 ÷ IN2. Divide-by-zero yields 0 and sets ENO = 0.',
    color: C,
    inputs: [
      { id: 'in1', name: 'IN1', type: 'REAL', default: 0 },
      { id: 'in2', name: 'IN2', type: 'REAL', default: 1 },
    ],
    outputs: [{ id: 'out', name: 'OUT', type: 'REAL' }],
    evaluate: ({ inputs }) => {
      const b = num(inputs.in2);
      if (b === 0) return { out: 0, _eno: false };
      return { out: num(inputs.in1) / b };
    },
  }),

  arith('ADD_I', 'Add (INT)', 'INT', 'OUT = IN1 + IN2 (integer).', (a, b) => a + b),
  arith('SUB_I', 'Subtract (INT)', 'INT', 'OUT = IN1 − IN2 (integer).', (a, b) => a - b),
  arith('MUL_I', 'Multiply (INT)', 'INT', 'OUT = IN1 × IN2 (integer).', (a, b) => a * b, 1, 1),

  func1('ABS_R', 'Absolute', 'OUT = |IN|.', (a) => Math.abs(a)),
  func1('SQRT', 'Square Root', 'OUT = √IN. Negative input sets ENO = 0.', (a) => Math.sqrt(a), (a) => a < 0),
  func1('EXP', 'Exponential', 'OUT = e^IN.', (a) => Math.exp(a)),
  func1('LN', 'Natural Log', 'OUT = ln(IN). IN ≤ 0 sets ENO = 0.', (a) => Math.log(a), (a) => a <= 0),
  func1('LOG10', 'Log Base 10', 'OUT = log₁₀(IN). IN ≤ 0 sets ENO = 0.', (a) => Math.log10(a), (a) => a <= 0),
  func1('SIN', 'Sine', 'OUT = sin(IN), IN in radians.', (a) => Math.sin(a)),
  func1('COS', 'Cosine', 'OUT = cos(IN), IN in radians.', (a) => Math.cos(a)),
];
