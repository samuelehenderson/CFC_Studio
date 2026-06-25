/**
 * Counter function blocks (IEC): CTU (up), CTD (down), CTUD (up/down).
 * Counting is edge-triggered on the count inputs.
 */
import type { BlockDefinition } from '../types';

const bool = (v: unknown) => v === true || (typeof v === 'number' && v !== 0);
const num = (v: unknown) => Number(v) || 0;

export const counterBlocks: BlockDefinition[] = [
  {
    type: 'CTU',
    name: 'Count Up',
    category: 'Counters',
    description: 'CV increments on each rising edge of CU. Q TRUE when CV ≥ PV. RESET clears CV.',
    color: '#db2777',
    stateful: true,
    inputs: [
      { id: 'cu', name: 'CU', type: 'BOOL', default: false },
      { id: 'reset', name: 'R', type: 'BOOL', default: false },
      { id: 'pv', name: 'PV', type: 'INT', default: 10 },
    ],
    outputs: [
      { id: 'q', name: 'Q', type: 'BOOL' },
      { id: 'cv', name: 'CV', type: 'INT' },
    ],
    initState: () => ({ cv: 0, prevCu: false }),
    evaluate: ({ inputs, state }) => {
      let cv = state.cv as number;
      const cu = bool(inputs.cu);
      const rising = cu && !(state.prevCu as boolean);
      if (bool(inputs.reset)) cv = 0;
      else if (rising) cv += 1;
      state.cv = cv;
      state.prevCu = cu;
      return { q: cv >= num(inputs.pv), cv };
    },
  },
  {
    type: 'CTD',
    name: 'Count Down',
    category: 'Counters',
    description: 'CV decrements on each rising edge of CD from preset PV. Q TRUE when CV ≤ 0. LOAD reloads PV.',
    color: '#db2777',
    stateful: true,
    inputs: [
      { id: 'cd', name: 'CD', type: 'BOOL', default: false },
      { id: 'load', name: 'LD', type: 'BOOL', default: false },
      { id: 'pv', name: 'PV', type: 'INT', default: 10 },
    ],
    outputs: [
      { id: 'q', name: 'Q', type: 'BOOL' },
      { id: 'cv', name: 'CV', type: 'INT' },
    ],
    initState: () => ({ cv: 0, prevCd: false, loaded: false }),
    evaluate: ({ inputs, state }) => {
      let cv = state.cv as number;
      if (!state.loaded) {
        cv = num(inputs.pv);
        state.loaded = true;
      }
      const cd = bool(inputs.cd);
      const rising = cd && !(state.prevCd as boolean);
      if (bool(inputs.load)) cv = num(inputs.pv);
      else if (rising && cv > 0) cv -= 1;
      state.cv = cv;
      state.prevCd = cd;
      return { q: cv <= 0, cv };
    },
  },
  {
    type: 'CTUD',
    name: 'Count Up/Down',
    category: 'Counters',
    description: 'CV counts up on CU edges, down on CD edges. QU = CV ≥ PV, QD = CV ≤ 0. R resets to 0, LD loads PV.',
    color: '#db2777',
    stateful: true,
    inputs: [
      { id: 'cu', name: 'CU', type: 'BOOL', default: false },
      { id: 'cd', name: 'CD', type: 'BOOL', default: false },
      { id: 'reset', name: 'R', type: 'BOOL', default: false },
      { id: 'load', name: 'LD', type: 'BOOL', default: false },
      { id: 'pv', name: 'PV', type: 'INT', default: 10 },
    ],
    outputs: [
      { id: 'qu', name: 'QU', type: 'BOOL' },
      { id: 'qd', name: 'QD', type: 'BOOL' },
      { id: 'cv', name: 'CV', type: 'INT' },
    ],
    initState: () => ({ cv: 0, prevCu: false, prevCd: false }),
    evaluate: ({ inputs, state }) => {
      let cv = state.cv as number;
      const cu = bool(inputs.cu);
      const cd = bool(inputs.cd);
      const upEdge = cu && !(state.prevCu as boolean);
      const dnEdge = cd && !(state.prevCd as boolean);
      const pv = num(inputs.pv);
      if (bool(inputs.reset)) cv = 0;
      else if (bool(inputs.load)) cv = pv;
      else {
        if (upEdge) cv += 1;
        if (dnEdge) cv -= 1;
      }
      state.cv = cv;
      state.prevCu = cu;
      state.prevCd = cd;
      return { qu: cv >= pv, qd: cv <= 0, cv };
    },
  },
];
