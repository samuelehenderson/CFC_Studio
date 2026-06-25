/**
 * I/O point blocks and signal sources/sinks.
 *
 * On a real panel these map to physical/virtual points. In the simulator,
 * input points are live sources the user drives (via a parameter or slider)
 * and output points are sinks that display the commanded value. Generators
 * produce test stimuli.
 */
import type { BlockDefinition } from '../types';

const num = (v: unknown) => Number(v) || 0;
const bool = (v: unknown) => v === true || (typeof v === 'number' && v !== 0);

export const ioBlocks: BlockDefinition[] = [
  {
    type: 'AI',
    name: 'Analog Input',
    category: 'I/O',
    description: 'Analog input point. Drive its live value from the inspector to simulate a sensor.',
    color: '#16a34a',
    inputs: [],
    params: [
      { id: 'value', name: 'Value', type: 'REAL', default: 0 },
      { id: 'units', name: 'Units', type: 'ENUM', default: '°F', options: ['°F', '°C', '%', 'psi', 'cfm', 'kW', 'none'] },
    ],
    outputs: [{ id: 'y', name: 'OUT', type: 'REAL' }],
    evaluate: ({ params }) => ({ y: num(params.value) }),
  },
  {
    type: 'BI',
    name: 'Binary Input',
    category: 'I/O',
    description: 'Binary input point (digital). Toggle its state from the inspector.',
    color: '#16a34a',
    inputs: [],
    params: [{ id: 'value', name: 'State', type: 'BOOL', default: false }],
    outputs: [{ id: 'y', name: 'OUT', type: 'BOOL' }],
    evaluate: ({ params }) => ({ y: bool(params.value) }),
  },
  {
    type: 'AO',
    name: 'Analog Output',
    category: 'I/O',
    description: 'Analog output point. Displays the commanded value (e.g. a damper or valve %).',
    color: '#16a34a',
    inputs: [{ id: 'x', name: 'IN', type: 'REAL', default: 0 }],
    outputs: [{ id: 'y', name: 'CMD', type: 'REAL' }],
    evaluate: ({ inputs }) => ({ y: num(inputs.x) }),
  },
  {
    type: 'BO',
    name: 'Binary Output',
    category: 'I/O',
    description: 'Binary output point. Displays the commanded digital state (e.g. a fan or pump).',
    color: '#16a34a',
    inputs: [{ id: 'x', name: 'IN', type: 'BOOL', default: false }],
    outputs: [{ id: 'y', name: 'CMD', type: 'BOOL' }],
    evaluate: ({ inputs }) => ({ y: bool(inputs.x) }),
  },
];
