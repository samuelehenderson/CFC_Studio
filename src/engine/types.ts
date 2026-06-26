/**
 * Core type system for the CFC simulation engine.
 *
 * CFC (Continuous Function Chart) is a graphical, function-block-diagram
 * language (rooted in IEC 61131-3 FBD) used by Siemens Desigo PXC field
 * panels — the successor to PPCL on APOGEE panels. A chart is a set of
 * function blocks whose pins are wired together; the panel re-solves the
 * whole chart cyclically.
 */

/** Pin / value data types carried on connections. */
export type DataType = 'BOOL' | 'REAL' | 'INT';

/** A runtime value flowing on a pin. BOOL -> boolean, REAL/INT -> number. */
export type Value = number | boolean;

/** Definition of a single input or output pin on a block. */
export interface PinDef {
  /** Stable id, unique within the block (used as the React Flow handle id). */
  id: string;
  /** Short label shown next to the pin. */
  name: string;
  type: DataType;
  /** Value used when the pin is unconnected. */
  default?: Value;
  /** Longer tooltip/help text. */
  description?: string;
}

/** A configurable parameter (not a wired pin) — e.g. a gain or a setpoint. */
export interface ParamDef {
  id: string;
  name: string;
  type: DataType | 'ENUM';
  default: Value | string;
  /** For ENUM params. */
  options?: string[];
  /** Suggested min/max for numeric editors. */
  min?: number;
  max?: number;
  description?: string;
}

/**
 * What a block's evaluate() returns: a value for each output pin id, plus an
 * optional `_eno` flag a block can set FALSE to report an error (e.g. divide
 * by zero). The elementary() wrapper consumes `_eno` and drives the ENO pin.
 */
export interface EvalResult {
  [pin: string]: Value | undefined;
  /** Optional error flag; FALSE drives the ENO pin low. */
  _eno?: boolean;
}

/** Context handed to a block's evaluate() on every solver cycle. */
export interface EvalContext {
  /** Resolved input pin values, keyed by pin id (falls back to pin default). */
  inputs: Record<string, Value>;
  /** Current parameter values, keyed by param id. */
  params: Record<string, Value | string>;
  /**
   * Persistent per-instance state that survives between cycles
   * (timer accumulators, previous edges, integrator sums, ...).
   * Mutate it freely.
   */
  state: Record<string, unknown>;
  /** Cycle time in seconds (delta-t since last solve). */
  dt: number;
  /** Total simulated time in seconds since the run started. */
  time: number;
  /** This block's output values from the previous cycle (keyed by pin id). */
  prev: Record<string, Value>;
}

/**
 * How well a block's behaviour is verified against Siemens documentation:
 *   confirmed — pin/semantics seen in Siemens/IEC docs
 *   inferred  — modelled from the documented equivalent; exact Desigo spec not public
 *   gap       — simulator convenience or unknown spec; NOT a real Siemens block
 */
export type Provenance = 'confirmed' | 'inferred' | 'gap';

/** Static definition of a block type (one per block kind, shared by instances). */
export interface BlockDefinition {
  /** Unique type key, e.g. 'ADD', 'PID', 'TON'. */
  type: string;
  /** Display name. */
  name: string;
  /** Palette category. */
  category: BlockCategory;
  /** One-line description. */
  description: string;
  inputs: PinDef[];
  outputs: PinDef[];
  params?: ParamDef[];
  /** Optional fixed accent colour for the node header. */
  color?: string;
  /** Fidelity of this block vs Siemens docs (defaults applied in the registry). */
  provenance?: Provenance;
  /** Short citation/source for the block's behaviour. */
  sourceDoc?: string;
  /**
   * Whether this block "breaks" feedback for ordering purposes — i.e. it is
   * a state element (timer, flip-flop, integrator) that legitimately reads
   * last cycle's value, so cycles through it are not flagged as errors.
   */
  stateful?: boolean;
  /** Build the initial persistent state object for a new instance. */
  initState?: () => Record<string, unknown>;
  /**
   * Compute output pin values for one cycle.
   * Must return a value for every output pin id (plus optional `_eno`).
   */
  evaluate: (ctx: EvalContext) => EvalResult;
}

export type BlockCategory =
  | 'I/O'
  | 'Math'
  | 'Logic'
  | 'Compare'
  | 'Timers'
  | 'Counters'
  | 'Selectors'
  | 'Control'
  | 'Memory'
  | 'Signal'
  | 'Constants';

/** An instance of a block placed on the chart. */
export interface BlockInstance {
  id: string;
  type: string;
  /** Override parameter values, keyed by param id. */
  params: Record<string, Value | string>;
  /**
   * Siemens-style execution sequence number. Blocks solve in ascending
   * order; ties broken by data-flow topology.
   */
  sequence: number;
  /** Optional user label shown on the node. */
  label?: string;
}

/** A wire from one block's output pin to another block's input pin. */
export interface Connection {
  id: string;
  source: string; // block instance id
  sourcePin: string; // output pin id
  target: string; // block instance id
  targetPin: string; // input pin id
}
