/**
 * Behavioral auto-checker.
 *
 * The pedagogical core: instead of comparing a trainee's chart to a fixed
 * "answer" topology, we RUN their chart against a scripted stimulus and assert
 * on the observed behavior (analog within a tolerance band, boolean exact,
 * transitions within a time window). Any correct solution passes — there's no
 * single right wiring — and it stays robust to solver tweaks.
 *
 * runChart() is standalone (it doesn't touch the live simulator), so it's also
 * unit-testable on its own.
 */
import type { BlockInstance, Connection, Value } from './types';
import { registry } from './blocks';
import { Simulator } from './simulator';
import { getPlantModel } from './plant';

/** Minimal node/edge shapes so the checker doesn't depend on the store. */
export interface NodeInput {
  id: string;
  data: { blockType: string; params: Record<string, Value | string>; sequence: number; label?: string };
}
export interface EdgeInput {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** A timed input event: set a block's parameter (by block label) at time t. */
export interface Stimulus {
  t: number;
  label: string;
  param?: string; // default 'value'
  value: Value;
}

export interface RunOptions {
  duration: number; // simulated seconds
  dt?: number; // cycle size (default 0.5)
  stimulus?: Stimulus[];
  plantModelId?: string; // run a plant in lockstep, auto-bound by label
}

interface Frame {
  t: number;
  outputs: Record<string, Record<string, Value>>;
}

/** Recorded run, with query helpers used by lesson checks. */
export class RunResult {
  private labelMap = new Map<string, string>(); // lowercased label -> nodeId

  constructor(
    readonly frames: Frame[],
    nodes: NodeInput[],
  ) {
    for (const n of nodes) {
      if (n.data.label) this.labelMap.set(n.data.label.toLowerCase(), n.id);
    }
  }

  nodeId(label: string): string | undefined {
    return this.labelMap.get(label.toLowerCase());
  }

  /** Time series of a block's output pin as numbers (bool -> 0/1). */
  series(label: string, pin: string): { t: number; v: number }[] {
    const id = this.nodeId(label);
    if (!id) return [];
    return this.frames.map((f) => ({ t: f.t, v: toNum(f.outputs[id]?.[pin]) }));
  }

  /** Final value of a block's output pin. */
  final(label: string, pin: string): number {
    const s = this.series(label, pin);
    return s.length ? s[s.length - 1].v : 0;
  }

  /** Value nearest a given time. */
  valueAt(label: string, pin: string, t: number): number {
    const s = this.series(label, pin);
    if (!s.length) return 0;
    let best = s[0];
    for (const p of s) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
    return best.v;
  }

  /** True if the pin stays within ±tol of target for all samples at/after fromT. */
  settles(label: string, pin: string, target: number, tol: number, fromT: number): boolean {
    const s = this.series(label, pin).filter((p) => p.t >= fromT);
    return s.length > 0 && s.every((p) => Math.abs(p.v - target) <= tol);
  }

  /** Max value over the whole run (e.g. to check an output actually moved). */
  max(label: string, pin: string): number {
    return this.series(label, pin).reduce((m, p) => Math.max(m, p.v), -Infinity);
  }
  min(label: string, pin: string): number {
    return this.series(label, pin).reduce((m, p) => Math.min(m, p.v), Infinity);
  }
}

function toNum(v: Value | undefined): number {
  if (v === undefined) return 0;
  return typeof v === 'boolean' ? (v ? 1 : 0) : Number(v);
}

function toModel(nodes: NodeInput[], edges: EdgeInput[]) {
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

/** Build a fresh Simulator from a chart, run it, and record every cycle. */
export function runChart(nodes: NodeInput[], edges: EdgeInput[], opts: RunOptions): RunResult {
  const dt = opts.dt ?? 0.5;
  const { instances, connections } = toModel(nodes, edges);
  const sim = new Simulator(instances, connections, registry);

  // label -> nodeId for stimulus targeting
  const byLabel = new Map<string, string>();
  for (const n of nodes) if (n.data.label) byLabel.set(n.data.label.toLowerCase(), n.id);

  const events = [...(opts.stimulus ?? [])].sort((a, b) => a.t - b.t);
  let nextEvent = 0;

  const plant = opts.plantModelId ? getPlantModel(opts.plantModelId) : undefined;
  const bindings: Record<string, string> = {};
  let plantState: Record<string, number> | null = null;
  if (plant) {
    for (const port of plant.ports) {
      const id = byLabel.get(port.name.toLowerCase());
      if (id) bindings[port.id] = id;
    }
    plantState = plant.init();
  }

  const frames: Frame[] = [];
  const steps = Math.ceil(opts.duration / dt);
  for (let i = 0; i < steps; i++) {
    const time = i * dt;
    // apply due stimulus events
    while (nextEvent < events.length && events[nextEvent].t <= time) {
      const e = events[nextEvent++];
      const id = byLabel.get(e.label.toLowerCase());
      if (id) sim.setParam(id, e.param ?? 'value', e.value);
    }

    const live = sim.step(dt);

    if (plant && plantState) {
      const cmd: Record<string, number> = {};
      for (const port of plant.ports) {
        if (port.dir !== 'command') continue;
        const nid = bindings[port.id];
        const raw = nid ? live.outputs[nid]?.y : undefined;
        cmd[port.id] = typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw ?? 0);
      }
      plantState = plant.step(plantState, dt, cmd);
      for (const port of plant.ports) {
        if (port.dir !== 'sensor') continue;
        const nid = bindings[port.id];
        if (nid) sim.setParam(nid, 'value', plantState[port.id]);
      }
    }

    // record a shallow copy of outputs
    const outputs: Record<string, Record<string, Value>> = {};
    for (const id of Object.keys(live.outputs)) outputs[id] = { ...live.outputs[id] };
    frames.push({ t: sim.time, outputs });
  }

  return new RunResult(frames, nodes);
}
