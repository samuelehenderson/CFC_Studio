import { describe, it, expect } from 'vitest';
import { runChart, type NodeInput, type EdgeInput } from './checker';
import { findLesson } from './lessons';
import { buildAhuSample } from './ahuSample';

function n(id: string, blockType: string, label: string, params: Record<string, number | boolean | string> = {}): NodeInput {
  return { id, data: { blockType, params, sequence: 0, label } };
}
function e(source: string, sh: string, target: string, th: string): EdgeInput {
  return { id: `${source}-${target}`, source, target, sourceHandle: sh, targetHandle: th };
}

describe('behavioral auto-checker', () => {
  it('passes a correct occupancy-AND solution and fails a naive one', () => {
    const lesson = findLesson('occupancy-and')!;

    // Correct: Fan = Occupied AND NOT Override
    const correct = {
      nodes: [
        n('occ', 'BI', 'Occupied', { value: false }),
        n('ovr', 'BI', 'Override', { value: false }),
        n('not', 'NOT', 'not'),
        n('and', 'AND', 'and'),
        n('fan', 'BO', 'Supply Fan'),
      ] as NodeInput[],
      edges: [
        e('occ', 'y', 'and', 'in1'),
        e('ovr', 'y', 'not', 'in1'),
        e('not', 'out', 'and', 'in2'),
        e('and', 'out', 'fan', 'x'),
      ] as EdgeInput[],
    };
    for (const c of lesson.checks) {
      expect(c.test(runChart(correct.nodes, correct.edges, c.run)), c.label).toBe(true);
    }

    // Naive: Fan = Occupied (ignores override) — must fail the override check.
    const naive = {
      nodes: [
        n('occ', 'BI', 'Occupied', { value: false }),
        n('ovr', 'BI', 'Override', { value: false }),
        n('fan', 'BO', 'Supply Fan'),
      ] as NodeInput[],
      edges: [e('occ', 'y', 'fan', 'x')] as EdgeInput[],
    };
    const overrideCheck = lesson.checks.find((c) => c.id === 'off-on-override')!;
    expect(overrideCheck.test(runChart(naive.nodes, naive.edges, overrideCheck.run))).toBe(false);
  });

  it('grades the AHU capstone: the wired solution settles the zone', () => {
    const lesson = findLesson('ahu-heating-loop')!;
    // buildAhuSample is a correct solution (LOOP wired to the AHU points).
    const { nodes, edges } = buildAhuSample();
    const ninputs: NodeInput[] = nodes.map((nd) => ({ id: nd.id, data: nd.data }));
    const einputs: EdgeInput[] = edges.map((ed) => ({
      id: ed.id,
      source: ed.source,
      target: ed.target,
      sourceHandle: ed.sourceHandle,
      targetHandle: ed.targetHandle,
    }));
    for (const c of lesson.checks) {
      expect(c.test(runChart(ninputs, einputs, c.run)), c.label).toBe(true);
    }
  });

  it('alarm-latch lesson is solvable (CMP_R + SR_FF)', () => {
    const lesson = findLesson('alarm-latch')!;
    const nodes = [
      n('t', 'AI', 'Temp', { value: 70 }),
      n('hi', 'CONST', 'Hi Limit', { value: 85 }),
      n('rst', 'BI', 'Reset', { value: false }),
      n('al', 'BO', 'Alarm'),
      n('cmp', 'CMP_R', 'cmp'),
      n('sr', 'SR_FF', 'sr'),
    ] as NodeInput[];
    const edges = [
      e('t', 'y', 'cmp', 'in1'),
      e('hi', 'y', 'cmp', 'in2'),
      e('cmp', 'gt', 'sr', 'set'),
      e('rst', 'y', 'sr', 'reset'),
      e('sr', 'q', 'al', 'x'),
    ] as EdgeInput[];
    for (const c of lesson.checks) {
      expect(c.test(runChart(nodes, edges, c.run)), c.label).toBe(true);
    }
  });

  it('count-to-start lesson is solvable (CTU)', () => {
    const lesson = findLesson('count-to-start')!;
    const nodes = [
      n('req', 'BI', 'Request', { value: false }),
      n('rst', 'BI', 'Reset', { value: false }),
      n('pv', 'CONST', 'Stages', { value: 3 }),
      n('en', 'BO', 'Enabled'),
      n('ctu', 'CTU', 'ctu'),
    ] as NodeInput[];
    const edges = [
      e('req', 'y', 'ctu', 'cu'),
      e('rst', 'y', 'ctu', 'reset'),
      e('pv', 'y', 'ctu', 'pv'),
      e('ctu', 'q', 'en', 'x'),
    ] as EdgeInput[];
    for (const c of lesson.checks) {
      expect(c.test(runChart(nodes, edges, c.run)), c.label).toBe(true);
    }
  });

  it('enthalpy-economizer lesson is solvable (ENTHALPY + CMP_R)', () => {
    const lesson = findLesson('enthalpy-econ')!;
    const nodes = [
      n('oat', 'AI', 'OA-T', { value: 60 }),
      n('oarh', 'AI', 'OA-RH', { value: 50 }),
      n('rat', 'AI', 'RA-T', { value: 75 }),
      n('rarh', 'AI', 'RA-RH', { value: 50 }),
      n('en', 'BO', 'Econ Enable'),
      n('oae', 'ENTHALPY', 'oae'),
      n('rae', 'ENTHALPY', 'rae'),
      n('cmp', 'CMP_R', 'cmp'),
    ] as NodeInput[];
    const edges = [
      e('oat', 'y', 'oae', 't'),
      e('oarh', 'y', 'oae', 'rh'),
      e('rat', 'y', 'rae', 't'),
      e('rarh', 'y', 'rae', 'rh'),
      e('oae', 'h', 'cmp', 'in1'),
      e('rae', 'h', 'cmp', 'in2'),
      e('cmp', 'lt', 'en', 'x'),
    ] as EdgeInput[];
    for (const c of lesson.checks) {
      expect(c.test(runChart(nodes, edges, c.run)), c.label).toBe(true);
    }
  });

  it('PPCL economizer exercise is solvable (CMP_R + SEL_R)', () => {
    const lesson = findLesson('ppcl-economizer')!;
    const nodes = [
      n('oat', 'AI', 'OAT', { value: 50 }),
      n('rat', 'AI', 'RAT', { value: 72 }),
      n('lo', 'CONST', 'Min OA', { value: 20 }),
      n('hiv', 'CONST', 'Full OA', { value: 100 }),
      n('oad', 'AO', 'OA Damper'),
      n('cmp', 'CMP_R', 'cmp'),
      n('sel', 'SEL_R', 'sel'),
    ] as NodeInput[];
    const edges = [
      e('oat', 'y', 'cmp', 'in1'),
      e('rat', 'y', 'cmp', 'in2'),
      e('lo', 'y', 'sel', 'in0'),
      e('hiv', 'y', 'sel', 'in1'),
      e('cmp', 'lt', 'sel', 'k'),
      e('sel', 'out', 'oad', 'x'),
    ] as EdgeInput[];
    for (const c of lesson.checks) {
      expect(c.test(runChart(nodes, edges, c.run)), c.label).toBe(true);
    }
  });

  it('PPCL hot-water reset exercise is solvable (SUB_R/MUL_R chain)', () => {
    const lesson = findLesson('ppcl-hw-reset')!;
    // HWSP = 180 - ((OAT - 20) * 1.5)
    const nodes = [
      n('oat', 'AI', 'OAT', { value: 50 }),
      n('dz', 'CONST', 'Design', { value: 20 }),
      n('g', 'CONST', 'Gain', { value: 1.5 }),
      n('mx', 'CONST', 'Max', { value: 180 }),
      n('sp', 'AO', 'HW Setpoint'),
      n('s1', 'SUB_R', 's1'),
      n('m1', 'MUL_R', 'm1'),
      n('s2', 'SUB_R', 's2'),
    ] as NodeInput[];
    const edges = [
      e('oat', 'y', 's1', 'in1'),
      e('dz', 'y', 's1', 'in2'),
      e('s1', 'out', 'm1', 'in1'),
      e('g', 'y', 'm1', 'in2'),
      e('mx', 'y', 's2', 'in1'),
      e('m1', 'out', 's2', 'in2'),
      e('s2', 'out', 'sp', 'x'),
    ] as EdgeInput[];
    for (const c of lesson.checks) {
      expect(c.test(runChart(nodes, edges, c.run)), c.label).toBe(true);
    }
  });
});
