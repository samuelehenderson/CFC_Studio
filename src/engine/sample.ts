/**
 * A ready-to-run example chart: a single-loop heating control.
 *
 *   Setpoint (72°F) ─► LOOP (reverse-acting PID) ─► Heating valve %
 *
 * A small "plant" model closes the loop so the simulation is self-running:
 * valve % → heat input (×gain) + ambient → first-order thermal lag → room
 * temperature, which feeds back into the controller's process value. Watch
 * the room temperature settle at setpoint after pressing Run.
 */
import type { CfcNode } from '../store/chartStore';
import type { Edge } from '@xyflow/react';
import type { Value } from './types';

interface Spec {
  id: string;
  type: string;
  x: number;
  y: number;
  label?: string;
  seq: number;
  params?: Record<string, Value | string>;
}

const specs: Spec[] = [
  { id: 'sp', type: 'CONST', x: 20, y: 40, label: 'Setpoint', seq: 10, params: { value: 72 } },
  { id: 'loop', type: 'LOOP', x: 240, y: 60, label: 'Heating PID', seq: 20, params: { kp: 6, tn: 25, tv: 0, action: 'REVERSE', ymin: 0, ymax: 100 } },
  { id: 'valve', type: 'AO', x: 500, y: 40, label: 'Heat Valve %', seq: 30 },
  { id: 'gain', type: 'CONST', x: 470, y: 250, label: 'Heat gain', seq: 40, params: { value: 0.5 } },
  { id: 'mul', type: 'MUL_R', x: 680, y: 150, label: 'Valve→Heat', seq: 50 },
  { id: 'amb', type: 'CONST', x: 680, y: 320, label: 'Ambient °F', seq: 60, params: { value: 58 } },
  { id: 'add', type: 'ADD_R', x: 880, y: 220, label: 'Heat balance', seq: 70 },
  { id: 'lag', type: 'PT1_P', x: 1080, y: 230, label: 'Room thermal lag', seq: 80, params: { t: 18 } },
  { id: 'room', type: 'AO', x: 1280, y: 230, label: 'Room Temp °F', seq: 90 },
];

const wires: [string, string, string, string][] = [
  // [sourceId, sourcePin, targetId, targetPin]
  ['sp', 'y', 'loop', 'w'],
  ['loop', 'y', 'valve', 'x'],
  ['loop', 'y', 'mul', 'in1'],
  ['gain', 'y', 'mul', 'in2'],
  ['mul', 'out', 'add', 'in1'],
  ['amb', 'y', 'add', 'in2'],
  ['add', 'out', 'lag', 'in1'],
  ['lag', 'out', 'room', 'x'],
  ['lag', 'out', 'loop', 'x'], // feedback: room temp → controller PV
];

export function buildSample(): { nodes: CfcNode[]; edges: Edge[] } {
  const nodes: CfcNode[] = specs.map((s) => ({
    id: s.id,
    type: 'cfcBlock',
    position: { x: s.x, y: s.y },
    data: { blockType: s.type, params: s.params ?? {}, sequence: s.seq, label: s.label },
  }));

  const edges: Edge[] = wires.map(([source, sourceHandle, target, targetHandle]) => ({
    id: `e_${source}.${sourceHandle}-${target}.${targetHandle}`,
    source,
    target,
    sourceHandle,
    targetHandle,
  }));

  return { nodes, edges };
}
