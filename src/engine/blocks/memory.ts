/**
 * Bistable / latch and edge-detection blocks (Siemens CFC names).
 *   SR_FF — set-dominant flip-flop
 *   RS_FF — reset-dominant flip-flop
 *   R_TRIG / F_TRIG — rising / falling edge detectors
 */
import type { BlockDefinition } from '../types';

const bool = (v: unknown) => v === true || (typeof v === 'number' && v !== 0);

export const memoryBlocks: BlockDefinition[] = [
  {
    type: 'SR_FF',
    name: 'SR Flip-Flop (set dom.)',
    category: 'Memory',
    description: 'Set-dominant latch. SET=1 forces Q=1; RESET=1 clears unless SET also active.',
    color: '#0d9488',
    stateful: true,
    inputs: [
      { id: 'set', name: 'S1', type: 'BOOL', default: false },
      { id: 'reset', name: 'R', type: 'BOOL', default: false },
    ],
    outputs: [{ id: 'q', name: 'Q', type: 'BOOL' }],
    initState: () => ({ q: false }),
    evaluate: ({ inputs, state }) => {
      let q = state.q as boolean;
      if (bool(inputs.reset)) q = false;
      if (bool(inputs.set)) q = true; // set wins
      state.q = q;
      return { q };
    },
  },
  {
    type: 'RS_FF',
    name: 'RS Flip-Flop (reset dom.)',
    category: 'Memory',
    description: 'Reset-dominant latch. RESET=1 forces Q=0; SET=1 sets unless RESET also active.',
    color: '#0d9488',
    stateful: true,
    inputs: [
      { id: 'set', name: 'S', type: 'BOOL', default: false },
      { id: 'reset', name: 'R1', type: 'BOOL', default: false },
    ],
    outputs: [{ id: 'q', name: 'Q', type: 'BOOL' }],
    initState: () => ({ q: false }),
    evaluate: ({ inputs, state }) => {
      let q = state.q as boolean;
      if (bool(inputs.set)) q = true;
      if (bool(inputs.reset)) q = false; // reset wins
      state.q = q;
      return { q };
    },
  },
  {
    type: 'R_TRIG',
    name: 'Rising Edge',
    category: 'Memory',
    description: 'Q pulses TRUE for one cycle on each FALSE→TRUE transition of CLK.',
    color: '#0d9488',
    stateful: true,
    inputs: [{ id: 'clk', name: 'CLK', type: 'BOOL', default: false }],
    outputs: [{ id: 'q', name: 'Q', type: 'BOOL' }],
    initState: () => ({ prev: false }),
    evaluate: ({ inputs, state }) => {
      const clk = bool(inputs.clk);
      const q = clk && !(state.prev as boolean);
      state.prev = clk;
      return { q };
    },
  },
  {
    type: 'F_TRIG',
    name: 'Falling Edge',
    category: 'Memory',
    description: 'Q pulses TRUE for one cycle on each TRUE→FALSE transition of CLK.',
    color: '#0d9488',
    stateful: true,
    inputs: [{ id: 'clk', name: 'CLK', type: 'BOOL', default: false }],
    outputs: [{ id: 'q', name: 'Q', type: 'BOOL' }],
    initState: () => ({ prev: false }),
    evaluate: ({ inputs, state }) => {
      const clk = bool(inputs.clk);
      const q = !clk && (state.prev as boolean);
      state.prev = clk;
      return { q };
    },
  },
];
