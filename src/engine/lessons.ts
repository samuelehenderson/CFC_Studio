/**
 * Lesson content for the Learn tab.
 *
 * Each lesson ships a starter chart and a set of behavioral checks. A check
 * runs the trainee's CURRENT chart (via runChart) against a scripted stimulus
 * and asserts on observed behavior — so ANY correct wiring passes, not one
 * "answer". The capstone runs against the live AHU plant.
 */
import type { CfcNode } from '../store/chartStore';
import type { Edge } from '@xyflow/react';
import type { Value } from './types';
import { RunResult, type RunOptions } from './checker';

export interface LessonCheck {
  id: string;
  label: string;
  run: RunOptions;
  test: (r: RunResult) => boolean;
}

export interface Lesson {
  id: string;
  title: string;
  blurb: string;
  objective: string;
  instructions: string[];
  hints: string[];
  successText: string;
  starter: () => { nodes: CfcNode[]; edges: Edge[] };
  checks: LessonCheck[];
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

// ---- chart builder helpers ----
function node(
  id: string,
  type: string,
  label: string,
  x: number,
  y: number,
  seq: number,
  params: Record<string, Value | string> = {},
): CfcNode {
  return { id, type: 'cfcBlock', position: { x, y }, data: { blockType: type, params, sequence: seq, label } };
}
function edge(source: string, sh: string, target: string, th: string): Edge {
  return { id: `e_${source}.${sh}-${target}.${th}`, source, target, sourceHandle: sh, targetHandle: th };
}

export const modules: Module[] = [
  {
    id: 'm0',
    title: 'Module 0 · Getting Started',
    lessons: [
      {
        id: 'wire-first-signal',
        title: 'Wire your first signal',
        blurb: 'Connect a constant to an output and run the solver.',
        objective: 'Learn the basics: pins, wires, and running the cyclic solver.',
        instructions: [
          'This chart has a Constant (72) and an Analog Output that are not yet connected.',
          'Drag a wire from the Constant’s output pin (right side) to the Analog Output’s IN pin (left side).',
          'Press Run on the toolbar. The output should read 72.',
          'Come back here and press “Check my work”.',
        ],
        hints: [
          'Hover a pin until the handle highlights, then drag to the other pin.',
          'The Constant’s output is named Y; the Analog Output’s input is named IN.',
          'Wire Setpoint.Y → Damper Cmd.IN, then press Run.',
        ],
        successText: 'That’s the core loop: blocks carry values along wires, and the panel re-solves every cycle.',
        starter: () => ({
          nodes: [
            node('c', 'CONST', 'Setpoint', 80, 140, 10, { value: 72 }),
            node('ao', 'AO', 'Damper Cmd', 420, 140, 20),
          ],
          edges: [],
        }),
        checks: [
          {
            id: 'passes-value',
            label: 'Damper Cmd outputs 72',
            run: { duration: 4 },
            test: (r) => Math.abs(r.final('Damper Cmd', 'y') - 72) < 0.5,
          },
        ],
      },
    ],
  },
  {
    id: 'm1',
    title: 'Module 1 · Digital Logic',
    lessons: [
      {
        id: 'occupancy-and',
        title: 'Occupancy with override',
        blurb: 'Run a fan only when occupied AND not overridden.',
        objective: 'Combine digital inputs with AND / NOT gates.',
        instructions: [
          'The Supply Fan should run only when Occupied is ON and Override is OFF.',
          'Add a NOT block and an AND block from the Logic palette.',
          'Wire: Occupied → AND.IN1, and Override → NOT → AND.IN2. Then AND → Supply Fan.',
          'Press “Check my work” — the checker will toggle the inputs and verify the fan.',
        ],
        hints: [
          'NOT inverts a single boolean; AND is true only when all inputs are true.',
          'Feed Override through NOT so the fan turns off when Override is ON.',
          'Occupied → AND.IN1; Override → NOT.IN → AND.IN2; AND.OUT → Supply Fan.IN.',
        ],
        successText: 'You just built a permissive — the bread and butter of equipment safeties and interlocks.',
        starter: () => ({
          nodes: [
            node('occ', 'BI', 'Occupied', 80, 80, 10, { value: false }),
            node('ovr', 'BI', 'Override', 80, 220, 20, { value: false }),
            node('fan', 'BO', 'Supply Fan', 560, 150, 40),
          ],
          edges: [],
        }),
        checks: [
          {
            id: 'on-when-occupied',
            label: 'Fan ON when occupied and not overridden',
            run: { duration: 4, stimulus: [{ t: 0, label: 'Occupied', value: true }, { t: 0, label: 'Override', value: false }] },
            test: (r) => r.valueAt('Supply Fan', 'y', 3) > 0.5,
          },
          {
            id: 'off-on-override',
            label: 'Fan OFF when overridden',
            run: { duration: 4, stimulus: [{ t: 0, label: 'Occupied', value: true }, { t: 0, label: 'Override', value: true }] },
            test: (r) => r.valueAt('Supply Fan', 'y', 3) < 0.5,
          },
          {
            id: 'off-when-empty',
            label: 'Fan OFF when unoccupied',
            run: { duration: 4, stimulus: [{ t: 0, label: 'Occupied', value: false }, { t: 0, label: 'Override', value: false }] },
            test: (r) => r.valueAt('Supply Fan', 'y', 3) < 0.5,
          },
        ],
      },
      {
        id: 'start-delay',
        title: 'Start delay',
        blurb: 'Delay the fan start by 5 seconds after occupancy.',
        objective: 'Use an on-delay timer (TON).',
        instructions: [
          'When Occupied turns ON, the Supply Fan should wait 5 seconds before starting.',
          'Add a TON (on-delay timer) from the Timers palette. Its PT preset defaults to 5 s.',
          'Wire Occupied → TON.IN, then TON.Q → Supply Fan.',
          'Press “Check my work”.',
        ],
        hints: [
          'TON’s Q output goes TRUE only after IN has been TRUE continuously for PT seconds.',
          'Leave PT at its default of 5 s (or wire a Constant of 5 into PT).',
          'Occupied → TON.IN; TON.Q → Supply Fan.IN.',
        ],
        successText: 'On/off delays prevent short-cycling and stagger equipment starts — used everywhere in HVAC.',
        starter: () => ({
          nodes: [
            node('occ', 'BI', 'Occupied', 80, 150, 10, { value: false }),
            node('fan', 'BO', 'Supply Fan', 520, 150, 30),
          ],
          edges: [],
        }),
        checks: [
          {
            id: 'off-before-delay',
            label: 'Fan still OFF 2 s after occupancy',
            run: { duration: 10, dt: 0.25, stimulus: [{ t: 0, label: 'Occupied', value: true }] },
            test: (r) => r.valueAt('Supply Fan', 'y', 2) < 0.5,
          },
          {
            id: 'on-after-delay',
            label: 'Fan ON 8 s after occupancy',
            run: { duration: 12, dt: 0.25, stimulus: [{ t: 0, label: 'Occupied', value: true }] },
            test: (r) => r.valueAt('Supply Fan', 'y', 8) > 0.5,
          },
        ],
      },
      {
        id: 'alarm-latch',
        title: 'Latch a fault',
        blurb: 'Hold a high-temperature alarm until it is acknowledged.',
        objective: 'Use a comparator and an SR (set-dominant) latch.',
        instructions: [
          'Energize the Alarm when Temp rises above the Hi Limit, and keep it latched ON even after Temp falls back — until Reset is pressed.',
          'Add a CMP_R and an SR_FF (set-dominant flip-flop).',
          'Wire Temp → CMP_R.IN1, Hi Limit → CMP_R.IN2, then CMP_R.GT → SR_FF.S1. Wire Reset → SR_FF.R and SR_FF.Q → Alarm.',
          'Press “Check my work”.',
        ],
        hints: [
          'CMP_R.GT is TRUE while Temp > Hi Limit; that should SET the latch.',
          'An SR latch holds its output after the set input clears — that’s what makes the alarm “stick”.',
          'Temp → CMP_R.IN1; Hi Limit → CMP_R.IN2; CMP_R.GT → SR_FF.S1; Reset → SR_FF.R; SR_FF.Q → Alarm.',
        ],
        successText: 'Latches turn momentary faults into alarms that demand acknowledgement — essential for safeties.',
        starter: () => ({
          nodes: [
            node('t', 'AI', 'Temp', 60, 70, 10, { value: 70, units: '°F' }),
            node('hi', 'CONST', 'Hi Limit', 60, 210, 20, { value: 85 }),
            node('rst', 'BI', 'Reset', 60, 340, 30, { value: false }),
            node('al', 'BO', 'Alarm', 560, 180, 50),
          ],
          edges: [],
        }),
        checks: [
          {
            id: 'on-high',
            label: 'Alarm ON when Temp exceeds limit',
            run: { duration: 4, stimulus: [{ t: 0, label: 'Temp', value: 90 }] },
            test: (r) => r.valueAt('Alarm', 'y', 3) > 0.5,
          },
          {
            id: 'stays-latched',
            label: 'Alarm stays latched after Temp falls',
            run: { duration: 6, stimulus: [{ t: 0, label: 'Temp', value: 90 }, { t: 2, label: 'Temp', value: 70 }] },
            test: (r) => r.valueAt('Alarm', 'y', 5) > 0.5,
          },
          {
            id: 'clears-on-reset',
            label: 'Reset clears the alarm',
            run: {
              duration: 7,
              stimulus: [
                { t: 0, label: 'Temp', value: 90 },
                { t: 2, label: 'Temp', value: 70 },
                { t: 3, label: 'Reset', value: true },
              ],
            },
            test: (r) => r.valueAt('Alarm', 'y', 6) < 0.5,
          },
        ],
      },
      {
        id: 'count-to-start',
        title: 'Count to start',
        blurb: 'Enable the system after three start requests.',
        objective: 'Use an up-counter (CTU) with a preset.',
        instructions: [
          'After Request has been pressed 3 times, turn on Enabled. Reset clears the count.',
          'Add a CTU (count up). Wire Request → CU, Reset → R, and the Stages constant (3) → PV.',
          'Wire CTU.Q → Enabled. Q goes TRUE when the count reaches PV.',
          'Press “Check my work” — the checker pulses Request for you.',
        ],
        hints: [
          'CTU increments CV on each rising edge of CU; Q is TRUE once CV ≥ PV.',
          'Drive PV from the Stages constant (3) so the threshold is three presses.',
          'Request → CTU.CU; Reset → CTU.R; Stages → CTU.PV; CTU.Q → Enabled.',
        ],
        successText: 'Counters stage equipment, debounce requests, and track events across scans.',
        starter: () => ({
          nodes: [
            node('req', 'BI', 'Request', 60, 70, 10, { value: false }),
            node('rst', 'BI', 'Reset', 60, 210, 20, { value: false }),
            node('pv', 'CONST', 'Stages', 60, 340, 30, { value: 3 }),
            node('en', 'BO', 'Enabled', 560, 180, 50),
          ],
          edges: [],
        }),
        checks: [
          {
            id: 'enables-after-3',
            label: 'Enabled after 3 requests',
            run: {
              duration: 5,
              dt: 0.25,
              stimulus: [
                { t: 0, label: 'Request', value: true },
                { t: 0.5, label: 'Request', value: false },
                { t: 1, label: 'Request', value: true },
                { t: 1.5, label: 'Request', value: false },
                { t: 2, label: 'Request', value: true },
                { t: 2.5, label: 'Request', value: false },
              ],
            },
            test: (r) => r.valueAt('Enabled', 'y', 4) > 0.5,
          },
          {
            id: 'not-after-2',
            label: 'Not enabled after only 2 requests',
            run: {
              duration: 5,
              dt: 0.25,
              stimulus: [
                { t: 0, label: 'Request', value: true },
                { t: 0.5, label: 'Request', value: false },
                { t: 1, label: 'Request', value: true },
                { t: 1.5, label: 'Request', value: false },
              ],
            },
            test: (r) => r.valueAt('Enabled', 'y', 4) < 0.5,
          },
          {
            id: 'reset-clears',
            label: 'Reset clears the count',
            run: {
              duration: 6,
              dt: 0.25,
              stimulus: [
                { t: 0, label: 'Request', value: true },
                { t: 0.5, label: 'Request', value: false },
                { t: 1, label: 'Request', value: true },
                { t: 1.5, label: 'Request', value: false },
                { t: 2, label: 'Request', value: true },
                { t: 2.5, label: 'Request', value: false },
                { t: 3, label: 'Reset', value: true },
              ],
            },
            test: (r) => r.valueAt('Enabled', 'y', 5) < 0.5,
          },
        ],
      },
    ],
  },
  {
    id: 'm2',
    title: 'Module 2 · Control & HVAC',
    lessons: [
      {
        id: 'freeze-stat',
        title: 'Freeze protection',
        blurb: 'Raise an alarm when supply air drops below 38°F.',
        objective: 'Use a comparator (CMP_R) to act on an analog threshold.',
        instructions: [
          'Energize the Freeze Alarm whenever Supply Temp falls below the 38°F setpoint.',
          'Add a CMP_R comparator. Wire Supply Temp → IN1 and Freeze SP → IN2.',
          'CMP_R drives all six relations at once — use the LT output (IN1 < IN2) → Freeze Alarm.',
          'Press “Check my work”.',
        ],
        hints: [
          'CMP_R compares IN1 to IN2 and exposes GT, GE, EQ, NE, LE, LT simultaneously.',
          'You want “Supply Temp LESS THAN 38”, so use the LT output.',
          'Supply Temp → CMP_R.IN1; Freeze SP → CMP_R.IN2; CMP_R.LT → Freeze Alarm.IN.',
        ],
        successText: 'Comparators turn analog readings into digital decisions — alarms, staging, and resets all start here.',
        starter: () => ({
          nodes: [
            node('t', 'AI', 'Supply Temp', 80, 90, 10, { value: 55, units: '°F' }),
            node('sp', 'CONST', 'Freeze SP', 80, 230, 20, { value: 38 }),
            node('al', 'BO', 'Freeze Alarm', 560, 150, 40),
          ],
          edges: [],
        }),
        checks: [
          {
            id: 'no-alarm-warm',
            label: 'No alarm at 55°F',
            run: { duration: 4, stimulus: [{ t: 0, label: 'Supply Temp', value: 55 }] },
            test: (r) => r.valueAt('Freeze Alarm', 'y', 3) < 0.5,
          },
          {
            id: 'alarm-cold',
            label: 'Alarm at 30°F',
            run: { duration: 4, stimulus: [{ t: 0, label: 'Supply Temp', value: 30 }] },
            test: (r) => r.valueAt('Freeze Alarm', 'y', 3) > 0.5,
          },
        ],
      },
      {
        id: 'ahu-heating-loop',
        title: 'Capstone: heat the zone',
        blurb: 'Build a PID loop that holds the live AHU zone at 72°F.',
        objective: 'Close a real control loop against the Plant simulator.',
        instructions: [
          'Everything is wired except the controller. Add a LOOP (PID) block from Control.',
          'Wire Space SP → LOOP.W (setpoint) and Space Temp → LOOP.X (process value).',
          'Wire LOOP.Y → Heating Valve. Set the LOOP action to REVERSE (heating).',
          'Open the Plant tab to watch it, press Run (speed 20×), then “Check my work”. The zone must settle near 72°F.',
        ],
        hints: [
          'Reverse acting means the output rises as the process value falls below setpoint — correct for heating.',
          'Start with Kp ≈ 4 and Tn ≈ 40 s; too much gain overshoots, too little is sluggish.',
          'Space SP → LOOP.W; Space Temp → LOOP.X; LOOP.Y → Heating Valve. Action = REVERSE.',
        ],
        successText: 'You closed a real loop — the controller you built just held a simulated building at setpoint.',
        starter: () => ({
          nodes: [
            node('sp', 'CONST', 'Space SP', 60, 60, 10, { value: 72 }),
            node('spaceTemp', 'AI', 'Space Temp', 60, 200, 5, { value: 66, units: '°F' }),
            node('heatVlv', 'AO', 'Heating Valve', 620, 80, 30),
            node('fanCmd', 'BCONST', 'Occupied', 60, 330, 40, { value: true }),
            node('fan', 'BO', 'Supply Fan', 360, 330, 50),
            node('oaMin', 'CONST', 'OA Min %', 60, 430, 60, { value: 20 }),
            node('oaDmpr', 'AO', 'OA Damper', 360, 430, 70),
            node('coolCmd', 'CONST', 'Cool Cmd', 60, 520, 80, { value: 0 }),
            node('coolVlv', 'AO', 'Cooling Valve', 360, 520, 90),
            node('supplyTemp', 'AI', 'Supply Air Temp', 620, 220, 5, { value: 66, units: '°F' }),
            node('oat', 'AI', 'Outside Air Temp', 620, 340, 5, { value: 40, units: '°F' }),
          ],
          edges: [
            edge('fanCmd', 'y', 'fan', 'x'),
            edge('oaMin', 'y', 'oaDmpr', 'x'),
            edge('coolCmd', 'y', 'coolVlv', 'x'),
          ],
        }),
        checks: [
          {
            id: 'valve-moves',
            label: 'Heating valve modulates (control is active)',
            run: { duration: 400, dt: 0.5, plantModelId: 'ahu' },
            test: (r) => r.max('Heating Valve', 'y') > 5,
          },
          {
            id: 'zone-settles',
            label: 'Zone settles within ±2.5°F of 72°F',
            run: { duration: 900, dt: 0.5, plantModelId: 'ahu' },
            test: (r) => r.settles('Space Temp', 'y', 72, 2.5, 750),
          },
        ],
      },
    ],
  },
];

export function findLesson(id: string): Lesson | undefined {
  for (const m of modules) {
    const l = m.lessons.find((x) => x.id === id);
    if (l) return l;
  }
  return undefined;
}

export const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
