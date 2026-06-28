/**
 * Plant models — physical equipment the CFC chart controls.
 *
 * A plant runs in lockstep with the solver: each cycle it reads the chart's
 * COMMAND points (AO/BO outputs) and writes its SENSOR points (into AI/BI
 * inputs), closing the loop one cycle later — exactly like real I/O. Physics
 * is lumped and qualitatively-correct (thermal mass + first-order lags), not a
 * high-fidelity energy model; the Plant tab says so.
 */

export type PlantState = Record<string, number>;

export interface PlantPort {
  id: string;
  name: string;
  /** command = chart drives plant (AO/BO); sensor = plant drives chart (AI/BI). */
  dir: 'command' | 'sensor';
  kind: 'analog' | 'binary';
  unit?: string;
}

export interface PlantModel {
  id: string;
  name: string;
  description: string;
  ports: PlantPort[];
  /** Build initial state. */
  init: () => PlantState;
  /**
   * Advance physics by dt seconds given the latest command values, and an
   * optional scenario (disturbances + injected faults).
   */
  step: (
    state: PlantState,
    dt: number,
    cmd: Record<string, number>,
    scenario?: PlantScenario,
  ) => PlantState;
}

/** Disturbances and injected faults the user can apply from the Plant tab. */
export interface PlantScenario {
  oat?: number;
  heatStuck?: boolean; // heating valve stuck closed (ignores command)
  sensorFail?: boolean; // space-temp sensor frozen (control flies blind)
}
