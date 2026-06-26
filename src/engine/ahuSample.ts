/**
 * A control-only AHU chart designed to be driven by the AHU plant model.
 *
 * Unlike the standalone heating sample (which fakes its own plant with
 * PT1/ADD blocks), this chart contains ONLY the control logic — a heating PID,
 * fan command, damper and cooling commands — and reads its sensors from AI
 * points the Plant tab writes. Block labels match the AHU plant port names so
 * the Plant tab can auto-bind them.
 */
import type { CfcNode } from '../store/chartStore';
import type { Edge } from '@xyflow/react';
import type { Value } from './types';

interface Spec {
  id: string;
  type: string;
  x: number;
  y: number;
  label: string;
  seq: number;
  params?: Record<string, Value | string>;
}

const specs: Spec[] = [
  { id: 'sp', type: 'CONST', x: 20, y: 40, label: 'Space SP', seq: 10, params: { value: 72 } },
  { id: 'spaceTemp', type: 'AI', x: 20, y: 170, label: 'Space Temp', seq: 5, params: { value: 66, units: '°F' } },
  { id: 'loop', type: 'LOOP', x: 280, y: 70, label: 'Heating PID', seq: 20, params: { kp: 4, tn: 40, tv: 0, action: 'REVERSE', ymin: 0, ymax: 100 } },
  { id: 'heatVlv', type: 'AO', x: 560, y: 70, label: 'Heating Valve', seq: 30 },
  { id: 'fanCmd', type: 'BCONST', x: 280, y: 250, label: 'Occupied', seq: 40, params: { value: true } },
  { id: 'fan', type: 'BO', x: 560, y: 250, label: 'Supply Fan', seq: 50 },
  { id: 'oaMin', type: 'CONST', x: 280, y: 350, label: 'OA Min %', seq: 60, params: { value: 20 } },
  { id: 'oaDmpr', type: 'AO', x: 560, y: 350, label: 'OA Damper', seq: 70 },
  { id: 'coolCmd', type: 'CONST', x: 280, y: 450, label: 'Cool Cmd', seq: 80, params: { value: 0 } },
  { id: 'coolVlv', type: 'AO', x: 560, y: 450, label: 'Cooling Valve', seq: 90 },
  { id: 'supplyTemp', type: 'AI', x: 820, y: 170, label: 'Supply Air Temp', seq: 5, params: { value: 66, units: '°F' } },
  { id: 'oat', type: 'AI', x: 820, y: 300, label: 'Outside Air Temp', seq: 5, params: { value: 40, units: '°F' } },
];

const wires: [string, string, string, string][] = [
  ['sp', 'y', 'loop', 'w'],
  ['spaceTemp', 'y', 'loop', 'x'],
  ['loop', 'y', 'heatVlv', 'x'],
  ['fanCmd', 'y', 'fan', 'x'],
  ['oaMin', 'y', 'oaDmpr', 'x'],
  ['coolCmd', 'y', 'coolVlv', 'x'],
];

export function buildAhuSample(): { nodes: CfcNode[]; edges: Edge[] } {
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
