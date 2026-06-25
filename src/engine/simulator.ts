/**
 * The cyclic solver.
 *
 * A Siemens PXC field panel does not execute CFC "top to bottom" once — it
 * re-solves the entire chart every panel cycle (a continuous function chart).
 * Each block has a sequence number; within a cycle blocks are evaluated in
 * ascending sequence order, refined by data-flow topology so a block sees the
 * freshest available value of its inputs. Feedback loops are legal: a wire
 * that closes a loop carries the *previous* cycle's value, exactly as on a
 * real panel (this is how integrators, PID, and latches work).
 *
 * This mirrors PPCL's continuous line-by-line re-scan, but data-flow ordered.
 */

import type {
  BlockDefinition,
  BlockInstance,
  Connection,
  DataType,
  Value,
} from './types';

export interface SolveResult {
  /** Output values per block: blockId -> pinId -> value. */
  outputs: Record<string, Record<string, Value>>;
  /** Resolved input values per block: blockId -> pinId -> value. */
  inputs: Record<string, Record<string, Value>>;
}

interface PreparedBlock {
  instance: BlockInstance;
  def: BlockDefinition;
  state: Record<string, unknown>;
  /** Incoming connections by target pin id. */
  incoming: Record<string, { source: string; sourcePin: string; connId: string }>;
}

/** Endpoint key uniquely identifying a wire by its two pins. */
function edgeKey(source: string, sourcePin: string, target: string, targetPin: string) {
  return `${source}:${sourcePin}->${target}:${targetPin}`;
}

/**
 * Holds the live state of one simulation run. Construct once, then call
 * step() each cycle. Rebuild when the chart topology changes.
 */
export class Simulator {
  private blocks: PreparedBlock[] = [];
  private order: PreparedBlock[] = [];
  private outputs: Record<string, Record<string, Value>> = {};
  private resolvedInputs: Record<string, Record<string, Value>> = {};
  private prevOutputs: Record<string, Record<string, Value>> = {};

  /** Endpoint keys of wires that carry last-cycle values. */
  private readonly feedbackKeys = new Set<string>();

  time = 0;
  /** Connection ids that form feedback loops (for UI highlighting). */
  readonly feedbackConnIds = new Set<string>();
  /** Algebraic loops through stateless blocks — surfaced as warnings. */
  readonly warnings: string[] = [];

  constructor(
    instances: BlockInstance[],
    connections: Connection[],
    private readonly registry: Record<string, BlockDefinition>,
  ) {
    this.build(instances, connections);
  }

  private build(instances: BlockInstance[], connections: Connection[]) {
    this.blocks = instances
      .filter((inst) => this.registry[inst.type])
      .map((inst) => {
        const def = this.registry[inst.type];
        const incoming: PreparedBlock['incoming'] = {};
        for (const c of connections) {
          if (c.target === inst.id) {
            incoming[c.targetPin] = { source: c.source, sourcePin: c.sourcePin, connId: c.id };
          }
        }
        return {
          instance: inst,
          def,
          state: def.initState ? def.initState() : {},
          incoming,
        };
      });

    // Seed output/prev maps with pin defaults so nothing is ever undefined.
    for (const b of this.blocks) {
      const init: Record<string, Value> = {};
      for (const pin of b.def.outputs) init[pin.id] = pin.default ?? (pin.type === 'BOOL' ? false : 0);
      this.outputs[b.instance.id] = { ...init };
      this.prevOutputs[b.instance.id] = { ...init };
    }

    this.computeOrder(connections);
  }

  /**
   * Determine evaluation order: primary key = user sequence number, then a
   * topological refinement on data-flow edges. Edges that would violate the
   * order (close a loop) or leave a stateful block are recorded as feedback
   * edges (previous-cycle value) instead of forcing an ordering constraint.
   */
  private computeOrder(connections: Connection[]) {
    const byId = new Map(this.blocks.map((b) => [b.instance.id, b]));

    const base = [...this.blocks].sort((a, b) => {
      const s = a.instance.sequence - b.instance.sequence;
      return s !== 0 ? s : a.instance.id.localeCompare(b.instance.id);
    });
    const seqIndex = new Map(base.map((b, i) => [b.instance.id, i]));

    const indeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const b of this.blocks) {
      indeg.set(b.instance.id, 0);
      adj.set(b.instance.id, []);
    }
    for (const c of connections) {
      if (!byId.has(c.source) || !byId.has(c.target)) continue;
      const fromStateful = byId.get(c.source)!.def.stateful;
      const forward = seqIndex.get(c.source)! < seqIndex.get(c.target)!;
      if (fromStateful || !forward) {
        this.feedbackKeys.add(edgeKey(c.source, c.sourcePin, c.target, c.targetPin));
        this.feedbackConnIds.add(c.id);
        continue;
      }
      adj.get(c.source)!.push(c.target);
      indeg.set(c.target, (indeg.get(c.target) ?? 0) + 1);
    }

    const ready = base
      .filter((b) => (indeg.get(b.instance.id) ?? 0) === 0)
      .map((b) => b.instance.id);
    const result: PreparedBlock[] = [];
    while (ready.length) {
      ready.sort((a, b) => seqIndex.get(a)! - seqIndex.get(b)!);
      const id = ready.shift()!;
      result.push(byId.get(id)!);
      for (const next of adj.get(id) ?? []) {
        indeg.set(next, (indeg.get(next) ?? 0) - 1);
        if (indeg.get(next) === 0) ready.push(next);
      }
    }

    // Leftover nodes sit in an algebraic loop of stateless blocks.
    if (result.length < this.blocks.length) {
      const placed = new Set(result.map((b) => b.instance.id));
      for (const b of base) {
        if (!placed.has(b.instance.id)) {
          result.push(b);
          // Demote this block's incoming wires to feedback so it stays solvable.
          for (const [pinId, inc] of Object.entries(b.incoming)) {
            this.feedbackKeys.add(edgeKey(inc.source, inc.sourcePin, b.instance.id, pinId));
            this.feedbackConnIds.add(inc.connId);
          }
          this.warnings.push(
            `Block "${b.instance.label ?? b.instance.type}" (${b.instance.id}) is in an algebraic feedback loop with no state element; it uses last-cycle values.`,
          );
        }
      }
    }

    this.order = result;
  }

  /** Run one solver cycle. Returns the freshly computed values. */
  step(dt: number): SolveResult {
    this.prevOutputs = cloneValues(this.outputs);
    this.resolvedInputs = {};
    this.time += dt;

    for (const b of this.order) {
      const inputs: Record<string, Value> = {};
      for (const pin of b.def.inputs) {
        const inc = b.incoming[pin.id];
        if (!inc) {
          inputs[pin.id] = pin.default ?? (pin.type === 'BOOL' ? false : 0);
          continue;
        }
        const isFeedback = this.feedbackKeys.has(
          edgeKey(inc.source, inc.sourcePin, b.instance.id, pin.id),
        );
        const src = isFeedback ? this.prevOutputs[inc.source] : this.outputs[inc.source];
        inputs[pin.id] = coerce(src?.[inc.sourcePin], pin.type);
      }
      this.resolvedInputs[b.instance.id] = inputs;

      const out = b.def.evaluate({
        inputs,
        params: { ...defaultParams(b.def), ...b.instance.params },
        state: b.state,
        dt,
        time: this.time,
        prev: this.prevOutputs[b.instance.id] ?? {},
      });

      const stored: Record<string, Value> = {};
      for (const pin of b.def.outputs) stored[pin.id] = coerce(out[pin.id], pin.type);
      this.outputs[b.instance.id] = stored;
    }

    return this.snapshot();
  }

  /** Update a block's parameter live, without rebuilding the simulator. */
  setParam(blockId: string, paramId: string, value: Value | string) {
    const b = this.blocks.find((x) => x.instance.id === blockId);
    if (b) b.instance.params = { ...b.instance.params, [paramId]: value };
  }

  /** Current outputs/inputs without advancing the cycle. */
  snapshot(): SolveResult {
    return {
      outputs: cloneValues(this.outputs),
      inputs: cloneValues(this.resolvedInputs),
    };
  }

  /** Reset all outputs, state and time to initial conditions. */
  reset() {
    this.time = 0;
    for (const b of this.blocks) {
      b.state = b.def.initState ? b.def.initState() : {};
      const init: Record<string, Value> = {};
      for (const pin of b.def.outputs) init[pin.id] = pin.default ?? (pin.type === 'BOOL' ? false : 0);
      this.outputs[b.instance.id] = { ...init };
      this.prevOutputs[b.instance.id] = { ...init };
    }
    this.resolvedInputs = {};
  }
}

function cloneValues(
  m: Record<string, Record<string, Value>>,
): Record<string, Record<string, Value>> {
  const out: Record<string, Record<string, Value>> = {};
  for (const k of Object.keys(m)) out[k] = { ...m[k] };
  return out;
}

function defaultParams(def: BlockDefinition): Record<string, Value | string> {
  const p: Record<string, Value | string> = {};
  for (const param of def.params ?? []) p[param.id] = param.default;
  return p;
}

/** Coerce a raw value to the pin's declared type. */
export function coerce(v: Value | undefined, type: DataType): Value {
  if (v === undefined || v === null) return type === 'BOOL' ? false : 0;
  if (type === 'BOOL') return v !== 0 && v !== false;
  if (type === 'INT') return Math.trunc(Number(v));
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
