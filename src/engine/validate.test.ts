import { describe, it, expect } from 'vitest';
import { validateChart } from './validate';
import type { CfcNode } from '../store/chartStore';
import type { Edge } from '@xyflow/react';

function n(id: string, blockType: string, label = ''): CfcNode {
  return { id, type: 'cfcBlock', position: { x: 0, y: 0 }, data: { blockType, params: {}, sequence: 0, label } };
}
function e(source: string, sh: string, target: string, th: string): Edge {
  return { id: `${source}-${target}`, source, target, sourceHandle: sh, targetHandle: th };
}

describe('chart validation', () => {
  it('flags a BOOL→REAL type-mismatched connection', () => {
    // BCONST output y is BOOL; AO input x is REAL.
    const nodes = [n('b', 'BCONST', 'Flag'), n('ao', 'AO', 'Cmd')];
    const edges = [e('b', 'y', 'ao', 'x')];
    const problems = validateChart(nodes, edges);
    const mismatch = problems.find((p) => p.id.startsWith('type:'));
    expect(mismatch && /mismatch/i.test(mismatch.message)).toBeTruthy();
    // and it offers a one-click B_R CONVERT fix
    expect(mismatch?.fix?.kind).toBe('insertConvert');
    expect(mismatch?.fix?.convertType).toBe('B_R');
  });

  it('accepts a type-matched connection', () => {
    // CONST output y is REAL; AO input x is REAL.
    const nodes = [n('c', 'CONST', 'SP'), n('ao', 'AO', 'Cmd')];
    const edges = [e('c', 'y', 'ao', 'x')];
    expect(validateChart(nodes, edges).filter((p) => p.id.startsWith('type:'))).toHaveLength(0);
  });

  it('flags duplicate labels', () => {
    const nodes = [n('a', 'AI', 'Space Temp'), n('b', 'AI', 'Space Temp')];
    const problems = validateChart(nodes, []);
    expect(problems.some((p) => p.id.startsWith('dup:'))).toBe(true);
  });
});
