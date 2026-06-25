/**
 * Constants and test-signal generators.
 */
import type { BlockDefinition } from '../types';

const num = (v: unknown) => Number(v) || 0;

export const sourceBlocks: BlockDefinition[] = [
  {
    type: 'CONST',
    name: 'Constant',
    category: 'Constants',
    description: 'Emits a fixed analog value.',
    color: '#64748b',
    inputs: [],
    params: [{ id: 'value', name: 'Value', type: 'REAL', default: 0 }],
    outputs: [{ id: 'y', name: 'Y', type: 'REAL' }],
    evaluate: ({ params }) => ({ y: num(params.value) }),
  },
  {
    type: 'BCONST',
    name: 'Boolean Constant',
    category: 'Constants',
    description: 'Emits a fixed digital value (TRUE/FALSE).',
    color: '#64748b',
    inputs: [],
    params: [{ id: 'value', name: 'Value', type: 'BOOL', default: true }],
    outputs: [{ id: 'y', name: 'Y', type: 'BOOL' }],
    evaluate: ({ params }) => ({ y: params.value === true || params.value === 1 }),
  },
  {
    type: 'SINE',
    name: 'Sine Generator',
    category: 'Signal',
    description: 'Y = Offset + Amplitude·sin(2π·t/Period). Useful for exercising loops.',
    color: '#9333ea',
    inputs: [],
    params: [
      { id: 'amp', name: 'Amplitude', type: 'REAL', default: 10 },
      { id: 'period', name: 'Period (s)', type: 'REAL', default: 60, min: 0.1 },
      { id: 'offset', name: 'Offset', type: 'REAL', default: 50 },
    ],
    outputs: [{ id: 'y', name: 'Y', type: 'REAL' }],
    evaluate: ({ params, time }) => {
      const period = Math.max(0.1, num(params.period));
      return { y: num(params.offset) + num(params.amp) * Math.sin((2 * Math.PI * time) / period) };
    },
  },
  {
    type: 'SQUARE',
    name: 'Square Wave',
    category: 'Signal',
    description: 'Digital square wave with adjustable period and duty cycle (%).',
    color: '#9333ea',
    inputs: [],
    params: [
      { id: 'period', name: 'Period (s)', type: 'REAL', default: 10, min: 0.1 },
      { id: 'duty', name: 'Duty (%)', type: 'REAL', default: 50, min: 0, max: 100 },
    ],
    outputs: [{ id: 'y', name: 'Y', type: 'BOOL' }],
    evaluate: ({ params, time }) => {
      const period = Math.max(0.1, num(params.period));
      const phase = (time % period) / period;
      return { y: phase < num(params.duty) / 100 };
    },
  },
];
