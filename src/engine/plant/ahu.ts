/**
 * Single-zone Air Handling Unit (AHU) plant model.
 *
 * Air path: outside air + return air → mixed air → heating coil → cooling coil
 * → supply fan → space. The space is a lumped thermal mass losing heat to
 * outdoors and gaining it from the coils (when the fan runs) plus a constant
 * internal gain. Time constants are compressed so the loop settles in a few
 * simulated minutes — run at higher speed to watch it stabilise.
 */
import type { PlantModel, PlantState } from './types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const ahuModel: PlantModel = {
  id: 'ahu',
  name: 'Single-Zone AHU',
  description:
    'Air handler with heating + cooling coils, mixed-air dampers and a supply fan serving one thermal zone. Bind your control points and watch the space settle.',
  ports: [
    { id: 'fan', name: 'Supply Fan', dir: 'command', kind: 'binary' },
    { id: 'heatVlv', name: 'Heating Valve', dir: 'command', kind: 'analog', unit: '%' },
    { id: 'coolVlv', name: 'Cooling Valve', dir: 'command', kind: 'analog', unit: '%' },
    { id: 'oaDmpr', name: 'OA Damper', dir: 'command', kind: 'analog', unit: '%' },
    { id: 'spaceTemp', name: 'Space Temp', dir: 'sensor', kind: 'analog', unit: '°F' },
    { id: 'supplyTemp', name: 'Supply Air Temp', dir: 'sensor', kind: 'analog', unit: '°F' },
    { id: 'oat', name: 'Outside Air Temp', dir: 'sensor', kind: 'analog', unit: '°F' },
  ],
  init: (): PlantState => ({
    spaceTemp: 66,
    supplyTemp: 66,
    mixedTemp: 60,
    oat: 40,
    fan: 0,
    heatVlv: 0,
    coolVlv: 0,
    oaFrac: 20,
  }),
  step: (s, dt, cmd): PlantState => {
    const OAT = s.oat ?? 40; // outside air (scenario-driven later)
    const fanOn = (cmd.fan ?? 0) > 0.5;
    const heatVlv = Math.max(0, Math.min(100, cmd.heatVlv ?? 0));
    const coolVlv = Math.max(0, Math.min(100, cmd.coolVlv ?? 0));
    const oaFrac = clamp01((cmd.oaDmpr ?? 0) / 100);

    // Mixed air = blend of outside and return (= space) air; no mixing if fan off.
    const mixed = fanOn ? oaFrac * OAT + (1 - oaFrac) * s.spaceTemp : s.spaceTemp;

    // Coil effect on supply air (max authority per coil), first-order lag.
    const heatEff = (heatVlv / 100) * 45; // up to +45 °F
    const coolEff = (coolVlv / 100) * 28; // up to −28 °F
    const satTarget = fanOn ? mixed + heatEff - coolEff : s.spaceTemp;
    const supplyTemp = s.supplyTemp + (satTarget - s.supplyTemp) * (dt / (8 + dt));

    // Space thermal mass.
    const Cspace = 240; // lumped time-constant scaler
    const airK = fanOn ? 1.3 : 0; // airflow coupling to supply air
    const envK = 0.15; // envelope loss to outdoors
    const gain = 0.45; // constant internal heat gain
    const dSpace = (airK * (supplyTemp - s.spaceTemp) + envK * (OAT - s.spaceTemp) + gain) / Cspace;
    const spaceTemp = s.spaceTemp + dSpace * dt;

    return {
      spaceTemp,
      supplyTemp,
      mixedTemp: mixed,
      oat: OAT,
      fan: fanOn ? 1 : 0,
      heatVlv,
      coolVlv,
      oaFrac: oaFrac * 100,
    };
  },
};
