/**
 * Central application store (Zustand).
 *
 * Owns the React Flow graph (nodes + edges), the derived CFC model, the live
 * simulator and its per-cycle values. The visual editor reads/writes this
 * store; the simulator pushes live pin values back into it for display.
 */
import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection as RFConnection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import type { BlockInstance, Connection, Value } from '../engine/types';
import { registry } from '../engine/blocks';
import { Simulator } from '../engine/simulator';
import { buildSample } from '../engine/sample';

export interface CfcNodeData extends Record<string, unknown> {
  blockType: string;
  params: Record<string, Value | string>;
  sequence: number;
  label?: string;
}

export type CfcNode = Node<CfcNodeData>;

/** Live values for one block: pin id -> value. */
export interface LiveValues {
  inputs: Record<string, Record<string, Value>>;
  outputs: Record<string, Record<string, Value>>;
}

let nodeCounter = 0;
const nextId = (type: string) => `${type}_${++nodeCounter}`;

export type TabId = 'learn' | 'editor' | 'plant' | 'scope' | 'translate' | 'reference';
export type Theme = 'dark' | 'light';

const THEME_KEY = 'cfc.theme';
const TAB_KEY = 'cfc.tab';

/** Read persisted/system theme and apply it to <html>. Called once at boot. */
export function initTheme(): Theme {
  let theme: Theme = 'dark';
  try {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    if (saved === 'dark' || saved === 'light') theme = saved;
    else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) theme = 'light';
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}

function readTab(): TabId {
  try {
    const t = localStorage.getItem(TAB_KEY) as TabId | null;
    if (t) return t;
  } catch {
    /* ignore */
  }
  return 'editor';
}

interface ChartState {
  nodes: CfcNode[];
  edges: Edge[];
  selectedId: string | null;

  // shell
  activeTab: TabId;
  theme: Theme;
  setTab: (t: TabId) => void;
  toggleTheme: () => void;

  // simulation
  running: boolean;
  sim: Simulator | null;
  live: LiveValues;
  time: number;
  cycleMs: number; // wall-clock ms between cycles
  speed: number; // simulated-time multiplier
  warnings: string[];

  // graph editing
  onNodesChange: (c: NodeChange[]) => void;
  onEdgesChange: (c: EdgeChange[]) => void;
  onConnect: (c: RFConnection) => void;
  addBlock: (blockType: string, position: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  setSelected: (id: string | null) => void;
  updateParam: (id: string, paramId: string, value: Value | string) => void;
  setSequence: (id: string, seq: number) => void;
  setLabel: (id: string, label: string) => void;

  // simulation control
  buildSim: () => void;
  start: () => void;
  pause: () => void;
  step: () => void;
  reset: () => void;
  setSpeed: (s: number) => void;
  tick: () => void;

  // persistence
  serialize: () => string;
  load: (json: string) => void;
  loadSample: () => void;
  clear: () => void;
}

let timer: ReturnType<typeof setInterval> | null = null;

function toModel(nodes: CfcNode[], edges: Edge[]): {
  instances: BlockInstance[];
  connections: Connection[];
} {
  const instances: BlockInstance[] = nodes
    .filter((n) => registry[n.data.blockType])
    .map((n) => ({
      id: n.id,
      type: n.data.blockType,
      params: n.data.params ?? {},
      sequence: n.data.sequence ?? 0,
      label: n.data.label,
    }));
  const connections: Connection[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    sourcePin: e.sourceHandle ?? '',
    target: e.target,
    targetPin: e.targetHandle ?? '',
  }));
  return { instances, connections };
}

export const useChartStore = create<ChartState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedId: null,

  activeTab: readTab(),
  theme: (document.documentElement.getAttribute('data-theme') as Theme) || 'dark',
  setTab: (t) => {
    set({ activeTab: t });
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  },
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },

  running: false,
  sim: null,
  live: { inputs: {}, outputs: {} },
  time: 0,
  cycleMs: 100,
  speed: 1,
  warnings: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as CfcNode[] });
    if (changes.some((c) => c.type === 'remove' || c.type === 'add')) get().buildSim();
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
    if (changes.some((c) => c.type === 'remove' || c.type === 'add')) get().buildSim();
  },

  onConnect: (conn) => {
    // Enforce one wire per input pin (a pin can only have one driver).
    const filtered = get().edges.filter(
      (e) => !(e.target === conn.target && e.targetHandle === conn.targetHandle),
    );
    const edges = addEdge(
      { ...conn, id: `e_${conn.source}.${conn.sourceHandle}-${conn.target}.${conn.targetHandle}` },
      filtered,
    );
    set({ edges });
    get().buildSim();
  },

  addBlock: (blockType, position) => {
    const def = registry[blockType];
    if (!def) return;
    const id = nextId(blockType);
    const params: Record<string, Value | string> = {};
    for (const p of def.params ?? []) params[p.id] = p.default;
    const maxSeq = get().nodes.reduce((m, n) => Math.max(m, n.data.sequence ?? 0), 0);
    const node: CfcNode = {
      id,
      type: 'cfcBlock',
      position,
      data: { blockType, params, sequence: maxSeq + 10 },
    };
    set({ nodes: [...get().nodes, node], selectedId: id });
    get().buildSim();
  },

  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
    get().buildSim();
  },

  setSelected: (id) => set({ selectedId: id }),

  updateParam: (id, paramId, value) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, [paramId]: value } } } : n,
      ),
    });
    get().sim?.setParam(id, paramId, value);
  },

  setSequence: (id, seq) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, sequence: seq } } : n,
      ),
    });
    get().buildSim();
  },

  setLabel: (id, label) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n,
      ),
    });
  },

  buildSim: () => {
    const { instances, connections } = toModel(get().nodes, get().edges);
    const sim = new Simulator(instances, connections, registry);
    set({ sim, warnings: sim.warnings, live: sim.snapshot() });
  },

  start: () => {
    if (get().running) return;
    if (!get().sim) get().buildSim();
    set({ running: true });
    timer = setInterval(() => get().tick(), get().cycleMs);
  },

  pause: () => {
    set({ running: false });
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  },

  step: () => {
    if (!get().sim) get().buildSim();
    const sim = get().sim!;
    const dt = (get().cycleMs / 1000) * get().speed;
    const live = sim.step(dt);
    set({ live, time: sim.time });
  },

  reset: () => {
    get().pause();
    get().sim?.reset();
    set({ time: 0, live: get().sim?.snapshot() ?? { inputs: {}, outputs: {} } });
  },

  setSpeed: (s) => set({ speed: s }),

  tick: () => get().step(),

  serialize: () => {
    const { nodes, edges } = get();
    return JSON.stringify(
      {
        version: 1,
        nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        })),
      },
      null,
      2,
    );
  },

  load: (json) => {
    try {
      const parsed = JSON.parse(json);
      const nodes: CfcNode[] = (parsed.nodes ?? []).map((n: { id: string; position: { x: number; y: number }; data: CfcNodeData }) => ({
        id: n.id,
        type: 'cfcBlock',
        position: n.position,
        data: n.data,
      }));
      const edges: Edge[] = (parsed.edges ?? []).map((e: Edge) => ({ ...e }));
      // keep the id counter ahead of loaded ids
      for (const n of nodes) {
        const m = /_(\d+)$/.exec(n.id);
        if (m) nodeCounter = Math.max(nodeCounter, Number(m[1]));
      }
      set({ nodes, edges, selectedId: null });
      get().reset();
      get().buildSim();
    } catch (err) {
      console.error('Failed to load chart', err);
    }
  },

  loadSample: () => {
    get().pause();
    const { nodes, edges } = buildSample();
    for (const n of nodes) {
      const m = /_(\d+)$/.exec(n.id);
      if (m) nodeCounter = Math.max(nodeCounter, Number(m[1]));
    }
    set({ nodes, edges, selectedId: null, time: 0 });
    get().buildSim();
  },

  clear: () => {
    get().pause();
    set({ nodes: [], edges: [], selectedId: null, time: 0, live: { inputs: {}, outputs: {} } });
    get().buildSim();
  },
}));
