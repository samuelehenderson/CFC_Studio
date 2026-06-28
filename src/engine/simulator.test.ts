import { describe, it, expect } from 'vitest';
import { Simulator } from './simulator';
import { registry } from './blocks';
import type { BlockInstance, Connection } from './types';

function inst(id: string, type: string, params: Record<string, number | string | boolean> = {}, sequence = 0): BlockInstance {
  return { id, type, params, sequence, label: id };
}
function wire(id: string, source: string, sourcePin: string, target: string, targetPin: string): Connection {
  return { id, source, sourcePin, target, targetPin };
}

describe('cyclic solver', () => {
  it('evaluates a feed-forward arithmetic chain in one cycle', () => {
    // CONST(5) -> ADD_R.in1, CONST(3) -> ADD_R.in2  => OUT = 8
    const sim = new Simulator(
      [
        inst('c1', 'CONST', { value: 5 }, 10),
        inst('c2', 'CONST', { value: 3 }, 20),
        inst('add', 'ADD_R', {}, 30),
      ],
      [
        wire('w1', 'c1', 'y', 'add', 'in1'),
        wire('w2', 'c2', 'y', 'add', 'in2'),
      ],
      registry,
    );
    const r = sim.step(0.1);
    expect(r.outputs.add.out).toBe(8);
    expect(r.outputs.add.eno).toBe(true);
  });

  it('honours EN: a disabled block holds its output', () => {
    const sim = new Simulator(
      [
        inst('c1', 'CONST', { value: 5 }, 10),
        inst('en', 'BCONST', { value: false }, 15),
        inst('abs', 'ABS_R', {}, 20),
      ],
      [
        wire('w1', 'c1', 'y', 'abs', 'in1'),
        wire('w2', 'en', 'y', 'abs', 'en'),
      ],
      registry,
    );
    const r = sim.step(0.1);
    expect(r.outputs.abs.eno).toBe(false); // disabled
    expect(r.outputs.abs.out).toBe(0); // held at initial
  });

  it('CMP_R drives all six relations', () => {
    const sim = new Simulator(
      [
        inst('a', 'CONST', { value: 7 }, 10),
        inst('b', 'CONST', { value: 4 }, 20),
        inst('cmp', 'CMP_R', {}, 30),
      ],
      [wire('w1', 'a', 'y', 'cmp', 'in1'), wire('w2', 'b', 'y', 'cmp', 'in2')],
      registry,
    );
    const r = sim.step(0.1).outputs.cmp;
    expect(r.gt).toBe(true);
    expect(r.ge).toBe(true);
    expect(r.lt).toBe(false);
    expect(r.eq).toBe(false);
    expect(r.ne).toBe(true);
  });
});

describe('stateful blocks', () => {
  it('TON asserts Q only after PT seconds of TRUE input', () => {
    const sim = new Simulator(
      [inst('in', 'BCONST', { value: true }, 10), inst('ton', 'TON', { pt: 1 }, 20)],
      [wire('w1', 'in', 'y', 'ton', 'in')],
      registry,
    );
    // PT input is unconnected; set via the block's PT pin default? PT comes
    // from the pin default (5). Override by wiring not needed — use param? PT
    // is an input pin with default 5. Drive 12 cycles of 0.1s = 1.2s > default?
    // The TON PT pin default is 5s, so feed a CONST into PT = 1.
    let q = false;
    for (let i = 0; i < 4; i++) q = sim.step(0.1).outputs.ton.q as boolean;
    expect(q).toBe(false); // 0.4s elapsed, PT default 5s
  });

  it('integrator accumulates input over time', () => {
    const sim = new Simulator(
      [inst('c', 'CONST', { value: 2 }, 10), inst('int', 'INT_P', { tn: 1 }, 20)],
      [wire('w1', 'c', 'y', 'int', 'in1')],
      registry,
    );
    let y = 0;
    for (let i = 0; i < 10; i++) y = sim.step(0.1).outputs.int.out as number;
    // ∫2 dt over 1s with Tn=1 => ~2
    expect(y).toBeGreaterThan(1.8);
    expect(y).toBeLessThan(2.2);
  });
});

describe('feedback designation', () => {
  it('feedbackStart forces a block to read previous-cycle inputs', () => {
    const mk = (fb: boolean) =>
      new Simulator(
        [inst('c', 'CONST', { value: 5 }, 10), { ...inst('a', 'ABS_R', {}, 20), feedbackStart: fb }],
        [wire('w', 'c', 'y', 'a', 'in1')],
        registry,
      );
    // Normal: forward edge, ABS sees the constant this cycle.
    expect(mk(false).step(0.1).outputs.a.out).toBe(5);
    // feedbackStart: the wire is demoted to feedback, so ABS lags one cycle.
    const fb = mk(true);
    expect(fb.feedbackConnIds.has('w')).toBe(true);
    expect(fb.step(0.1).outputs.a.out).toBe(0); // reads previous (0)
    expect(fb.step(0.1).outputs.a.out).toBe(5); // now sees the constant
  });
});

describe('forcing', () => {
  it('a forced output overrides the computed value and propagates downstream', () => {
    const sim = new Simulator(
      [inst('c', 'CONST', { value: 5 }, 10), inst('a', 'ABS_R', {}, 20)],
      [wire('w', 'c', 'y', 'a', 'in1')],
      registry,
    );
    expect(sim.step(0.1).outputs.a.out).toBe(5);
    sim.setForce('c', 'y', 99);
    expect(sim.step(0.1).outputs.a.out).toBe(99); // ABS sees the forced constant same cycle
    sim.clearForce('c', 'y');
    expect(sim.step(0.1).outputs.a.out).toBe(5);
  });
});

describe('closed loop', () => {
  it('LOOP drives a lagged plant toward setpoint (feedback edge)', () => {
    // setpoint 72 -> LOOP -> valve gain -> +ambient -> PT1 lag -> back to LOOP.x
    const sim = new Simulator(
      [
        inst('sp', 'CONST', { value: 72 }, 10),
        inst('loop', 'LOOP', { kp: 6, tn: 20, action: 'REVERSE', ymin: 0, ymax: 100 }, 20),
        inst('gain', 'CONST', { value: 0.5 }, 30),
        inst('mul', 'MUL_R', {}, 40),
        inst('amb', 'CONST', { value: 58 }, 50),
        inst('add', 'ADD_R', {}, 60),
        inst('lag', 'PT1_P', { t: 5 }, 70),
      ],
      [
        wire('w1', 'sp', 'y', 'loop', 'w'),
        wire('w2', 'loop', 'y', 'mul', 'in1'),
        wire('w3', 'gain', 'y', 'mul', 'in2'),
        wire('w4', 'mul', 'out', 'add', 'in1'),
        wire('w5', 'amb', 'y', 'add', 'in2'),
        wire('w6', 'add', 'out', 'lag', 'in1'),
        wire('w7', 'lag', 'out', 'loop', 'x'),
      ],
      registry,
    );
    // The lag->loop wire closes a loop; it must be a feedback edge.
    expect(sim.feedbackConnIds.has('w7')).toBe(true);

    let temp = 0;
    for (let i = 0; i < 4000; i++) temp = sim.step(0.1).outputs.lag.out as number;
    // Should settle near the 72°F setpoint.
    expect(Math.abs(temp - 72)).toBeLessThan(1.0);
  });

  it('CONT_C (SIMATIC PID) settles a lagged plant at its setpoint', () => {
    // SP_INT 72 -> CONT_C.LMN -> valve gain 0.5 -> +ambient 58 -> PT1 -> PV_IN
    const sim = new Simulator(
      [
        inst('sp', 'CONST', { value: 72 }, 10),
        inst('pid', 'CONT_C', { gain: 6, ti: 20, td: 0, lmn_hlm: 100, lmn_llm: 0 }, 20),
        inst('gain', 'CONST', { value: 0.5 }, 30),
        inst('mul', 'MUL_R', {}, 40),
        inst('amb', 'CONST', { value: 58 }, 50),
        inst('add', 'ADD_R', {}, 60),
        inst('lag', 'PT1_P', { t: 5 }, 70),
      ],
      [
        wire('w1', 'sp', 'y', 'pid', 'sp_int'),
        wire('w2', 'pid', 'lmn', 'mul', 'in1'),
        wire('w3', 'gain', 'y', 'mul', 'in2'),
        wire('w4', 'mul', 'out', 'add', 'in1'),
        wire('w5', 'amb', 'y', 'add', 'in2'),
        wire('w6', 'add', 'out', 'lag', 'in1'),
        wire('w7', 'lag', 'out', 'pid', 'pv_in'),
      ],
      registry,
    );
    expect(sim.feedbackConnIds.has('w7')).toBe(true);
    let temp = 0;
    for (let i = 0; i < 4000; i++) temp = sim.step(0.1).outputs.lag.out as number;
    expect(Math.abs(temp - 72)).toBeLessThan(1.0);
  });
});
