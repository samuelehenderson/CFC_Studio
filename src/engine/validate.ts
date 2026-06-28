/**
 * Static chart validation — surfaced in the Editor's Diagnostics drawer.
 *
 * These are teaching-oriented checks. The simulator itself coerces types so a
 * chart always runs, but real CFC rejects a type-mismatched wire and makes you
 * insert a CONVERT block — so we flag it rather than hide it.
 */
import type { CfcNode } from '../store/chartStore';
import type { Edge } from '@xyflow/react';
import type { DataType } from './types';
import { registry } from './blocks';

export interface Problem {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
}

function convertHint(from: DataType, to: DataType): string {
  if (from === 'REAL' && to === 'INT') return 'R_I';
  if (from === 'INT' && to === 'REAL') return 'I_R';
  if (to === 'BOOL') return 'R_B';
  if (from === 'BOOL') return 'B_R';
  return 'a CONVERT';
}

export function validateChart(nodes: CfcNode[], edges: Edge[]): Problem[] {
  const problems: Problem[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // 1. Type-mismatched connections.
  for (const e of edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) continue;
    const sdef = registry[s.data.blockType];
    const tdef = registry[t.data.blockType];
    if (!sdef || !tdef) continue;
    const op = sdef.outputs.find((p) => p.id === e.sourceHandle);
    const ip = tdef.inputs.find((p) => p.id === e.targetHandle);
    if (op && ip && op.type !== ip.type) {
      problems.push({
        id: `type:${e.id}`,
        severity: 'warning',
        message: `Type mismatch: ${s.data.label || sdef.type}.${op.name} (${op.type}) → ${t.data.label || tdef.type}.${ip.name} (${ip.type}). Real CFC needs a ${convertHint(op.type, ip.type)} CONVERT block here.`,
        nodeId: t.id,
      });
    }
  }

  // 2. Duplicate labels (plant binding and lessons match blocks by label).
  const labelMap = new Map<string, string[]>();
  for (const n of nodes) {
    const l = (n.data.label || '').trim();
    if (!l) continue;
    const key = l.toLowerCase();
    labelMap.set(key, [...(labelMap.get(key) ?? []), n.id]);
  }
  for (const ids of labelMap.values()) {
    if (ids.length > 1) {
      const label = byId.get(ids[0])?.data.label;
      problems.push({
        id: `dup:${ids[0]}`,
        severity: 'info',
        message: `Duplicate label "${label}" on ${ids.length} blocks — Plant binding and lessons match by label, so keep them unique.`,
        nodeId: ids[0],
      });
    }
  }

  return problems;
}
