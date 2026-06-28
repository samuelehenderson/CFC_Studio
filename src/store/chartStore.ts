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
import { buildAhuSample } from '../engine/ahuSample';
import { getPlantModel } from '../engine/plant';
import type { PlantState, PlantScenario } from '../engine/plant/types';
import { runChart } from '../engine/checker';
import { findLesson } from '../engine/lessons';

export interface CfcNodeData extends Record<string, unknown> {
  blockType: string;
  params: Record<string, Value | string>;
  sequence: number;
  label?: string;
  feedbackStart?: boolean;
}

export type CfcNode = Node<CfcNodeData>;

/** Live values for one block: pin id -> value. */
export interface LiveValues {
  inputs: Record<string, Record<string, Value>>;
  outputs: Record<string, Record<string, Value>>;
}

let nodeCounter = 0;
const nextId = (type: string) => `${type}_${++nodeCounter}`;

interface Snapshot {
  nodes: CfcNode[];
  edges: Edge[];
}
const AUTOSAVE_KEY = 'cfc.autosave';
const HISTORY_LIMIT = 60;
let historyTag: string | null = null; // coalesces rapid same-field edits
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let clipboard: CfcNode[] = [];

export type TabId = 'learn' | 'editor' | 'plant' | 'scope' | 'translate' | 'reference';
export type Theme = 'dark' | 'light';

const THEME_KEY = 'cfc.theme';
const TAB_KEY = 'cfc.tab';
const DONE_KEY = 'cfc.completedLessons';

export interface LessonResult {
  id: string;
  label: string;
  pass: boolean;
}

function readCompleted(): string[] {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return [];
}

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

/** A signal followed by the Scope. */
export interface WatchSeries {
  id: string; // `${nodeId}:${source}:${pinId}`
  nodeId: string;
  pinId: string;
  source: 'output' | 'input';
  label: string;
  kind: 'analog' | 'binary';
  color: string;
}

/** One recorded time sample: simulated time + value per watched series id. */
export interface Sample {
  t: number;
  v: Record<string, number>;
}

/** Plant binding: which chart node feeds each plant port. */
export interface PlantConfig {
  modelId: string;
  bindings: Record<string, string>; // portId -> nodeId
}

const SERIES_COLORS = [
  '#38bdf8', '#22c55e', '#f59e0b', '#e879f9', '#fb7185',
  '#a3e635', '#2dd4bf', '#facc15', '#c084fc', '#60a5fa',
];
const HISTORY_MAX = 3000;

interface ChartState {
  nodes: CfcNode[];
  edges: Edge[];
  selectedId: string | null;

  // shell
  activeTab: TabId;
  theme: Theme;
  setTab: (t: TabId) => void;
  toggleTheme: () => void;

  // scope (trends)
  watch: WatchSeries[];
  history: Sample[];
  addWatch: (s: Omit<WatchSeries, 'color'>) => void;
  removeWatch: (id: string) => void;
  clearWatch: () => void;
  autoWatchIO: () => void;

  // forced (overridden) output values: `${nodeId}:${pinId}` -> value
  forces: Record<string, Value>;
  setForce: (nodeId: string, pinId: string, value: Value) => void;
  clearForce: (nodeId: string, pinId: string) => void;

  // plant
  plant: PlantConfig | null;
  plantState: PlantState | null;
  setPlantModel: (modelId: string | null) => void;
  setPlantBinding: (portId: string, nodeId: string) => void;
  plantScenario: PlantScenario;
  setPlantScenario: (s: Partial<PlantScenario>) => void;

  // learn
  activeLessonId: string | null;
  lessonResults: LessonResult[] | null;
  completedLessons: string[];
  setActiveLesson: (id: string | null) => void;
  startLesson: (id: string) => void;
  checkLesson: () => void;

  // simulation
  running: boolean;
  sim: Simulator | null;
  live: LiveValues;
  time: number;
  cycleMs: number; // wall-clock ms between cycles
  speed: number; // simulated-time multiplier
  warnings: string[];

  // history / clipboard / persistence
  past: Snapshot[];
  future: Snapshot[];
  pushHistory: (tag?: string) => void;
  beginInteraction: () => void;
  undo: () => void;
  redo: () => void;
  copySelection: () => void;
  paste: () => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  scheduleSave: () => void;
  restore: () => void;

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
  setFeedbackStart: (id: string, value: boolean) => void;
  reorderSequence: (orderedIds: string[]) => void;
  showSequence: boolean;
  toggleSequence: () => void;

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
  loadAhuDemo: () => void;
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
      feedbackStart: n.data.feedbackStart,
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

  watch: [],
  history: [],
  forces: {},
  plant: null,
  plantState: null,
  plantScenario: { oat: 40, heatStuck: false, sensorFail: false },
  activeLessonId: null,
  lessonResults: null,
  completedLessons: readCompleted(),

  past: [],
  future: [],

  pushHistory: (tag) => {
    if (tag && tag === historyTag) return; // coalesce consecutive same-field edits
    historyTag = tag ?? null;
    const past = [...get().past, { nodes: get().nodes, edges: get().edges }].slice(-HISTORY_LIMIT);
    set({ past, future: [] });
  },

  beginInteraction: () => get().pushHistory(),

  undo: () => {
    const past = get().past;
    if (!past.length) return;
    historyTag = null;
    const prev = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [...get().future, { nodes: get().nodes, edges: get().edges }].slice(-HISTORY_LIMIT),
      nodes: prev.nodes,
      edges: prev.edges,
      selectedId: null,
    });
    get().buildSim();
    get().scheduleSave();
  },

  redo: () => {
    const future = get().future;
    if (!future.length) return;
    historyTag = null;
    const next = future[future.length - 1];
    set({
      future: future.slice(0, -1),
      past: [...get().past, { nodes: get().nodes, edges: get().edges }].slice(-HISTORY_LIMIT),
      nodes: next.nodes,
      edges: next.edges,
      selectedId: null,
    });
    get().buildSim();
    get().scheduleSave();
  },

  copySelection: () => {
    const sel = get().nodes.filter((n) => n.selected);
    clipboard = sel.length ? sel : get().nodes.filter((n) => n.id === get().selectedId);
  },

  paste: () => {
    if (!clipboard.length) return;
    get().pushHistory();
    const idMap = new Map<string, string>();
    const newNodes: CfcNode[] = clipboard.map((n) => {
      const id = nextId(n.data.blockType);
      idMap.set(n.id, id);
      return {
        ...n,
        id,
        selected: true,
        position: { x: n.position.x + 32, y: n.position.y + 32 },
        data: { ...n.data, params: { ...n.data.params } },
      };
    });
    // carry internal edges (both ends copied)
    const internal = get().edges.filter((e) => idMap.has(e.source) && idMap.has(e.target));
    const newEdges: Edge[] = internal.map((e) => ({
      ...e,
      id: `e_${idMap.get(e.source)}.${e.sourceHandle}-${idMap.get(e.target)}.${e.targetHandle}`,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
    }));
    const cleared = get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
    set({ nodes: [...cleared, ...newNodes], edges: [...get().edges, ...newEdges] });
    get().buildSim();
    get().scheduleSave();
  },

  duplicateSelection: () => {
    get().copySelection();
    get().paste();
  },

  deleteSelection: () => {
    const ids = new Set(get().nodes.filter((n) => n.selected).map((n) => n.id));
    const sel = get().selectedId;
    if (sel) ids.add(sel);
    if (!ids.size) return;
    get().pushHistory();
    set({
      nodes: get().nodes.filter((n) => !ids.has(n.id)),
      edges: get().edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
      selectedId: null,
    });
    get().buildSim();
    get().scheduleSave();
  },

  scheduleSave: () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, get().serialize());
      } catch {
        /* ignore */
      }
    }, 500);
  },

  restore: () => {
    let json: string | null = null;
    try {
      json = localStorage.getItem(AUTOSAVE_KEY);
    } catch {
      /* ignore */
    }
    if (json) get().load(json);
    else get().loadSample();
  },

  setActiveLesson: (id) => set({ activeLessonId: id, lessonResults: null }),

  startLesson: (id) => {
    const lesson = findLesson(id);
    if (!lesson) return;
    get().pause();
    const { nodes, edges } = lesson.starter();
    for (const n of nodes) {
      const m = /_(\d+)$/.exec(n.id);
      if (m) nodeCounter = Math.max(nodeCounter, Number(m[1]));
    }
    historyTag = null;
    set({
      nodes,
      edges,
      selectedId: null,
      time: 0,
      history: [],
      plant: null,
      plantState: null,
      activeLessonId: id,
      lessonResults: null,
      past: [],
      future: [],
    });
    get().buildSim();
    // If the lesson is graded against a plant, attach it so the learner can watch.
    const plantCheck = lesson.checks.find((c) => c.run.plantModelId);
    if (plantCheck?.run.plantModelId) get().setPlantModel(plantCheck.run.plantModelId);
    get().autoWatchIO();
  },

  checkLesson: () => {
    const lesson = findLesson(get().activeLessonId ?? '');
    if (!lesson) return;
    const nodes = get().nodes.map((n) => ({ id: n.id, data: n.data }));
    const edges = get().edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
    const results: LessonResult[] = lesson.checks.map((c) => {
      let pass = false;
      try {
        pass = c.test(runChart(nodes, edges, c.run));
      } catch {
        pass = false;
      }
      return { id: c.id, label: c.label, pass };
    });
    let completed = get().completedLessons;
    if (results.every((r) => r.pass) && !completed.includes(lesson.id)) {
      completed = [...completed, lesson.id];
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify(completed));
      } catch {
        /* ignore */
      }
    }
    set({ lessonResults: results, completedLessons: completed });
  },

  addWatch: (s) => {
    if (get().watch.some((w) => w.id === s.id)) return;
    const color = SERIES_COLORS[get().watch.length % SERIES_COLORS.length];
    set({ watch: [...get().watch, { ...s, color }] });
  },
  removeWatch: (id) => set({ watch: get().watch.filter((w) => w.id !== id) }),
  clearWatch: () => set({ watch: [], history: [] }),
  autoWatchIO: () => {
    const watch: WatchSeries[] = [];
    let i = 0;
    for (const n of get().nodes) {
      const t = n.data.blockType;
      if (t === 'AI' || t === 'AO' || t === 'BI' || t === 'BO') {
        const kind: 'analog' | 'binary' = t === 'BI' || t === 'BO' ? 'binary' : 'analog';
        watch.push({
          id: `${n.id}:output:y`,
          nodeId: n.id,
          pinId: 'y',
          source: 'output',
          label: n.data.label || t,
          kind,
          color: SERIES_COLORS[i % SERIES_COLORS.length],
        });
        i++;
      }
    }
    set({ watch, history: [] });
  },

  setPlantModel: (modelId) => {
    if (!modelId) {
      set({ plant: null, plantState: null });
      return;
    }
    const model = getPlantModel(modelId);
    if (!model) return;
    const bindings: Record<string, string> = {};
    for (const port of model.ports) {
      const want = port.name.toLowerCase();
      const match = get().nodes.find((n) => (n.data.label || '').toLowerCase() === want);
      if (match) bindings[port.id] = match.id;
    }
    set({ plant: { modelId, bindings }, plantState: model.init() });
  },
  setPlantBinding: (portId, nodeId) => {
    const plant = get().plant;
    if (!plant) return;
    set({ plant: { ...plant, bindings: { ...plant.bindings, [portId]: nodeId } } });
  },
  setPlantScenario: (partial) => set({ plantScenario: { ...get().plantScenario, ...partial } }),

  running: false,
  sim: null,
  live: { inputs: {}, outputs: {} },
  time: 0,
  cycleMs: 100,
  speed: 1,
  warnings: [],

  onNodesChange: (changes) => {
    if (changes.some((c) => c.type === 'remove')) get().pushHistory();
    set({ nodes: applyNodeChanges(changes, get().nodes) as CfcNode[] });
    if (changes.some((c) => c.type === 'remove' || c.type === 'add')) get().buildSim();
    if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) get().scheduleSave();
  },

  onEdgesChange: (changes) => {
    if (changes.some((c) => c.type === 'remove')) get().pushHistory();
    set({ edges: applyEdgeChanges(changes, get().edges) });
    if (changes.some((c) => c.type === 'remove' || c.type === 'add')) get().buildSim();
    if (changes.some((c) => c.type !== 'select')) get().scheduleSave();
  },

  onConnect: (conn) => {
    get().pushHistory();
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
    get().scheduleSave();
  },

  addBlock: (blockType, position) => {
    const def = registry[blockType];
    if (!def) return;
    get().pushHistory();
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
    get().scheduleSave();
  },

  deleteNode: (id) => {
    get().pushHistory();
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
    get().buildSim();
    get().scheduleSave();
  },

  setSelected: (id) => set({ selectedId: id }),

  updateParam: (id, paramId, value) => {
    get().pushHistory(`param:${id}:${paramId}`);
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, [paramId]: value } } } : n,
      ),
    });
    get().sim?.setParam(id, paramId, value);
    get().scheduleSave();
  },

  setSequence: (id, seq) => {
    get().pushHistory(`seq:${id}`);
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, sequence: seq } } : n,
      ),
    });
    get().buildSim();
    get().scheduleSave();
  },

  setLabel: (id, label) => {
    get().pushHistory(`label:${id}`);
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n,
      ),
    });
    get().scheduleSave();
  },

  setFeedbackStart: (id, value) => {
    get().pushHistory();
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, feedbackStart: value } } : n,
      ),
    });
    get().buildSim();
    get().scheduleSave();
  },

  reorderSequence: (orderedIds) => {
    get().pushHistory();
    const seqOf = new Map(orderedIds.map((id, i) => [id, (i + 1) * 10]));
    set({
      nodes: get().nodes.map((n) =>
        seqOf.has(n.id) ? { ...n, data: { ...n.data, sequence: seqOf.get(n.id)! } } : n,
      ),
    });
    get().buildSim();
    get().scheduleSave();
  },

  showSequence: false,
  toggleSequence: () => set({ showSequence: !get().showSequence }),

  buildSim: () => {
    const { instances, connections } = toModel(get().nodes, get().edges);
    const sim = new Simulator(instances, connections, registry);
    const nodeIds = new Set(instances.map((i) => i.id));
    for (const [key, v] of Object.entries(get().forces)) {
      const sep = key.indexOf(':');
      const nid = key.slice(0, sep);
      const pid = key.slice(sep + 1);
      if (nodeIds.has(nid)) sim.setForce(nid, pid, v);
    }
    set({ sim, warnings: sim.warnings, live: sim.snapshot() });
  },

  setForce: (nodeId, pinId, value) => {
    get().sim?.setForce(nodeId, pinId, value);
    set({ forces: { ...get().forces, [`${nodeId}:${pinId}`]: value } });
  },
  clearForce: (nodeId, pinId) => {
    get().sim?.clearForce(nodeId, pinId);
    const next = { ...get().forces };
    delete next[`${nodeId}:${pinId}`];
    set({ forces: next });
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

    // Step the plant in lockstep: read command points (this cycle's outputs),
    // advance physics, write sensor values into the bound AI/BI inputs.
    let plantState = get().plantState;
    const plant = get().plant;
    const model = plant ? getPlantModel(plant.modelId) : undefined;
    if (plant && model) {
      const cmd: Record<string, number> = {};
      for (const port of model.ports) {
        if (port.dir !== 'command') continue;
        const nodeId = plant.bindings[port.id];
        const raw = nodeId ? live.outputs[nodeId]?.y : undefined;
        cmd[port.id] = typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw ?? 0);
      }
      plantState = model.step(plantState ?? model.init(), dt, cmd, get().plantScenario);
      for (const port of model.ports) {
        if (port.dir !== 'sensor') continue;
        const nodeId = plant.bindings[port.id];
        if (nodeId) sim.setParam(nodeId, 'value', plantState[port.id]);
      }
    }

    // Record watched signals into the ring buffer.
    const watch = get().watch;
    let history = get().history;
    if (watch.length) {
      const v: Record<string, number> = {};
      for (const w of watch) {
        const bucket = w.source === 'output' ? live.outputs[w.nodeId] : live.inputs[w.nodeId];
        const raw = bucket?.[w.pinId];
        v[w.id] = typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw ?? 0);
      }
      history = history.length >= HISTORY_MAX ? history.slice(history.length - HISTORY_MAX + 1) : history.slice();
      history.push({ t: sim.time, v });
    }

    set({ live, time: sim.time, plantState, history });
  },

  reset: () => {
    get().pause();
    get().sim?.reset();
    const model = get().plant ? getPlantModel(get().plant!.modelId) : undefined;
    set({
      time: 0,
      live: get().sim?.snapshot() ?? { inputs: {}, outputs: {} },
      history: [],
      plantState: model ? model.init() : null,
    });
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
      historyTag = null;
      set({ nodes, edges, selectedId: null, past: [], future: [] });
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
    historyTag = null;
    set({ nodes, edges, selectedId: null, time: 0, plant: null, plantState: null, history: [], past: [], future: [] });
    get().buildSim();
    get().autoWatchIO();
    get().scheduleSave();
  },

  loadAhuDemo: () => {
    get().pause();
    const { nodes, edges } = buildAhuSample();
    historyTag = null;
    set({ nodes, edges, selectedId: null, time: 0, history: [], past: [], future: [] });
    get().buildSim();
    get().setPlantModel('ahu'); // auto-binds by matching labels
    get().autoWatchIO();
    get().scheduleSave();
  },

  clear: () => {
    get().pause();
    historyTag = null;
    set({
      nodes: [],
      edges: [],
      selectedId: null,
      time: 0,
      live: { inputs: {}, outputs: {} },
      watch: [],
      history: [],
      plant: null,
      plantState: null,
      past: [],
      future: [],
    });
    get().buildSim();
    get().scheduleSave();
  },
}));
