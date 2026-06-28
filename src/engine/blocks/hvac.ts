/**
 * HVAC-specific blocks: psychrometrics + common application functions.
 *
 * Siemens' ABT library advertises 250+ blocks including enthalpy/wet-bulb/
 * dew-point and optimum start, but the exact block names/pins aren't public.
 * These implement the standard psychrometric formulas (US units: °F, %RH, ~sea
 * level) so they're faithful in behavior — all marked INFERRED.
 */
import type { BlockDefinition } from '../types';

const num = (v: unknown) => Number(v) || 0;
const C = '#0ea5e9';

const toC = (f: number) => ((f - 32) * 5) / 9;
const toF = (c: number) => (c * 9) / 5 + 32;

/** Saturation vapor pressure over water (kPa), T in °C (Magnus/Tetens). */
function pws(tc: number): number {
  return 0.61078 * Math.exp((17.27 * tc) / (tc + 237.3));
}
/** Humidity ratio (lb water / lb dry air) from T(°F), RH(%). */
function humidityRatio(tf: number, rh: number): number {
  const tc = toC(tf);
  const pw = (Math.max(0, Math.min(100, rh)) / 100) * pws(tc); // kPa
  const patm = 101.325;
  return 0.62198 * (pw / (patm - pw));
}
/** Moist-air enthalpy (BTU/lb dry air). */
function enthalpy(tf: number, rh: number): number {
  const w = humidityRatio(tf, rh);
  return 0.24 * tf + w * (1061 + 0.444 * tf);
}
/** Dew-point temperature (°F). */
function dewPoint(tf: number, rh: number): number {
  const tc = toC(tf);
  const pw = (Math.max(1e-4, Math.min(100, rh)) / 100) * pws(tc);
  const ln = Math.log(pw / 0.61078);
  return toF((237.3 * ln) / (17.27 - ln));
}
/** Wet-bulb temperature (°F) — Stull 2011 approximation, standard pressure. */
function wetBulb(tf: number, rh: number): number {
  const tc = toC(tf);
  const r = Math.max(1, Math.min(100, rh));
  const twC =
    tc * Math.atan(0.151977 * Math.sqrt(r + 8.313659)) +
    Math.atan(tc + r) -
    Math.atan(r - 1.676331) +
    0.00391838 * Math.pow(r, 1.5) * Math.atan(0.023101 * r) -
    4.686035;
  return toF(twC);
}

export const hvacBlocks: BlockDefinition[] = [
  {
    type: 'ENTHALPY',
    name: 'Enthalpy',
    category: 'HVAC',
    description:
      'Moist-air enthalpy from dry-bulb T (°F) and RH (%): h = 0.240·T + W·(1061 + 0.444·T) BTU/lb, W from psychrometrics.',
    color: C,
    inputs: [
      { id: 't', name: 'T', type: 'REAL', default: 75, description: 'Dry-bulb °F' },
      { id: 'rh', name: 'RH', type: 'REAL', default: 50, description: 'Relative humidity %' },
    ],
    outputs: [{ id: 'h', name: 'H', type: 'REAL' }],
    evaluate: ({ inputs }) => ({ h: enthalpy(num(inputs.t), num(inputs.rh)) }),
  },
  {
    type: 'DEWPOINT',
    name: 'Dew Point',
    category: 'HVAC',
    description: 'Dew-point temperature (°F) from dry-bulb T and RH.',
    color: C,
    inputs: [
      { id: 't', name: 'T', type: 'REAL', default: 75 },
      { id: 'rh', name: 'RH', type: 'REAL', default: 50 },
    ],
    outputs: [{ id: 'td', name: 'TD', type: 'REAL' }],
    evaluate: ({ inputs }) => ({ td: dewPoint(num(inputs.t), num(inputs.rh)) }),
  },
  {
    type: 'WETBULB',
    name: 'Wet Bulb',
    category: 'HVAC',
    description: 'Wet-bulb temperature (°F) from dry-bulb T and RH (Stull approximation).',
    color: C,
    inputs: [
      { id: 't', name: 'T', type: 'REAL', default: 75 },
      { id: 'rh', name: 'RH', type: 'REAL', default: 50 },
    ],
    outputs: [{ id: 'tw', name: 'TW', type: 'REAL' }],
    evaluate: ({ inputs }) => ({ tw: wetBulb(num(inputs.t), num(inputs.rh)) }),
  },
  {
    type: 'ECON',
    name: 'Enthalpy Economizer',
    category: 'HVAC',
    description:
      'Enables free cooling when outdoor-air enthalpy is below return-air enthalpy by the deadband. Also outputs both enthalpies.',
    color: C,
    stateful: true,
    inputs: [
      { id: 'oat', name: 'OA-T', type: 'REAL', default: 60 },
      { id: 'oarh', name: 'OA-RH', type: 'REAL', default: 50 },
      { id: 'rat', name: 'RA-T', type: 'REAL', default: 75 },
      { id: 'rarh', name: 'RA-RH', type: 'REAL', default: 50 },
    ],
    params: [{ id: 'db', name: 'Deadband (BTU/lb)', type: 'REAL', default: 1, min: 0 }],
    outputs: [
      { id: 'en', name: 'ENABLE', type: 'BOOL' },
      { id: 'oah', name: 'OA-H', type: 'REAL' },
      { id: 'rah', name: 'RA-H', type: 'REAL' },
    ],
    initState: () => ({ en: false }),
    evaluate: ({ inputs, params, state }) => {
      const oah = enthalpy(num(inputs.oat), num(inputs.oarh));
      const rah = enthalpy(num(inputs.rat), num(inputs.rarh));
      const db = Math.abs(num(params.db));
      let en = state.en as boolean;
      if (!en && oah < rah - db) en = true;
      else if (en && oah > rah + db) en = false;
      state.en = en;
      return { en, oah, rah };
    },
  },
  {
    type: 'OPT_START',
    name: 'Optimum Start',
    category: 'HVAC',
    description:
      'Morning warm-up: estimated recovery time = max(0, SP − PV) / rate. Asserts START when time-to-occupancy drops to the estimated lead time.',
    color: C,
    inputs: [
      { id: 'pv', name: 'PV', type: 'REAL', default: 62, description: 'Space temp °F' },
      { id: 'sp', name: 'SP', type: 'REAL', default: 72, description: 'Occupied setpoint °F' },
      { id: 'tto', name: 'TTO', type: 'REAL', default: 120, description: 'Time to occupancy (min)' },
    ],
    params: [{ id: 'rate', name: 'Recovery rate (°F/min)', type: 'REAL', default: 0.3, min: 0.01 }],
    outputs: [
      { id: 'start', name: 'START', type: 'BOOL' },
      { id: 'lead', name: 'LEAD', type: 'REAL' },
    ],
    evaluate: ({ inputs, params }) => {
      const need = Math.max(0, num(inputs.sp) - num(inputs.pv));
      const lead = need / Math.max(0.01, num(params.rate));
      return { start: num(inputs.tto) <= lead, lead };
    },
  },
];
