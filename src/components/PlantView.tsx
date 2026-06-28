import { useChartStore } from '../store/chartStore';
import { plantModels, getPlantModel } from '../engine/plant';
import type { PlantState } from '../engine/plant/types';

/** Plant tab: a live animated AHU the chart controls, plus point bindings. */
export function PlantView() {
  const plant = useChartStore((s) => s.plant);
  const plantState = useChartStore((s) => s.plantState);
  const nodes = useChartStore((s) => s.nodes);
  const running = useChartStore((s) => s.running);
  const setPlantModel = useChartStore((s) => s.setPlantModel);
  const setPlantBinding = useChartStore((s) => s.setPlantBinding);
  const loadAhuDemo = useChartStore((s) => s.loadAhuDemo);
  const start = useChartStore((s) => s.start);
  const scenario = useChartStore((s) => s.plantScenario);
  const setScenario = useChartStore((s) => s.setPlantScenario);

  const model = plant ? getPlantModel(plant.modelId) : undefined;

  if (!plant || !model) {
    return (
      <div className="tabview">
        <div className="tabview-inner">
          <h1>Plant Simulator</h1>
          <p className="lede">
            Connect your control chart to a live mechanical model and watch it run. The plant reads
            your command points (valves, fan, dampers) and feeds back sensor readings every cycle —
            a closed loop, just like real I/O. Physics is lumped and qualitative, meant for teaching,
            not energy modelling.
          </p>
          <div className="card-grid" style={{ maxWidth: 560 }}>
            <div className="card">
              <h3>Load the AHU demo</h3>
              <p>Loads a control-only air-handler chart and auto-binds it to the AHU plant. The fastest way to see it work.</p>
              <button className="primary" style={{ marginTop: 12 }} onClick={loadAhuDemo}>
                Load AHU demo chart
              </button>
            </div>
            <div className="card">
              <h3>Attach to this chart</h3>
              <p>Bind a plant model to whatever you have open. You'll map each plant port to one of your I/O points.</p>
              <select
                style={{ marginTop: 12, width: '100%' }}
                value=""
                onChange={(e) => e.target.value && setPlantModel(e.target.value)}
              >
                <option value="">Choose a plant model…</option>
                {plantModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const st = plantState ?? model.init();
  const nodeLabel = (id: string | undefined) => {
    if (!id) return '— unbound —';
    const n = nodes.find((x) => x.id === id);
    return n ? n.data.label || n.data.blockType : '(missing)';
  };

  return (
    <div className="tabview">
      <div className="tabview-inner" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: 0 }}>{model.name}</h1>
          <span className="muted" style={{ color: 'var(--text-dim)', fontSize: 13 }}>{model.description}</span>
        </div>
        {!running && (
          <p style={{ marginTop: 8 }}>
            <button className="primary" onClick={start}>
              ▶ Run simulation
            </button>{' '}
            <span className="muted" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Tip: bump the speed on the Editor toolbar to watch the space settle faster.
            </span>
          </p>
        )}

        <div className="plant-layout">
          <AhuSchematic st={st} />

          <div className="plant-side">
            <div className="plant-bindings">
              <h2 style={{ marginTop: 0 }}>Scenario</h2>
              <div className="field">
                <label>
                  Outside air temp: <b>{(scenario.oat ?? 40).toFixed(0)}°F</b>
                </label>
                <input
                  type="range"
                  min={-10}
                  max={100}
                  step={1}
                  value={scenario.oat ?? 40}
                  onChange={(e) => setScenario({ oat: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="field row">
                <input
                  type="checkbox"
                  checked={!!scenario.heatStuck}
                  onChange={(e) => setScenario({ heatStuck: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                <label style={{ margin: 0 }}>Stuck heating valve (closed)</label>
              </div>
              <div className="field row">
                <input
                  type="checkbox"
                  checked={!!scenario.sensorFail}
                  onChange={(e) => setScenario({ sensorFail: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                <label style={{ margin: 0 }}>Failed space sensor (frozen)</label>
              </div>
              <p className="source-note" style={{ marginBottom: 0 }}>
                Inject a fault and watch the loop respond — a stuck valve can’t hold setpoint; a failed
                sensor flies blind while the real space drifts.
              </p>
            </div>

          <div className="plant-bindings">
            <h2 style={{ marginTop: 0 }}>Point bindings</h2>
            {model.ports.map((port) => {
              const eligible = nodes.filter((n) => {
                const t = n.data.blockType;
                if (port.dir === 'command') return port.kind === 'binary' ? t === 'BO' : t === 'AO';
                return port.kind === 'binary' ? t === 'BI' : t === 'AI';
              });
              return (
                <div className="field" key={port.id}>
                  <label>
                    {port.name}{' '}
                    <span className="muted" style={{ color: 'var(--text-dim)' }}>
                      ({port.dir === 'command' ? 'chart → plant' : 'plant → chart'})
                    </span>
                  </label>
                  <select
                    value={plant.bindings[port.id] ?? ''}
                    onChange={(e) => setPlantBinding(port.id, e.target.value)}
                  >
                    <option value="">— unbound —</option>
                    {eligible.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.data.label || n.data.blockType}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            <p className="source-note" style={{ marginTop: 12 }}>
              Bound now: Space Temp ← {nodeLabel(plant.bindings.spaceTemp)}, Heating Valve →{' '}
              {nodeLabel(plant.bindings.heatVlv)}.
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Animated SVG air-handling-unit schematic driven by live plant state. */
function AhuSchematic({ st }: { st: PlantState }) {
  const fanOn = (st.fan ?? 0) > 0.5;
  const heat = Math.max(0, Math.min(100, st.heatVlv ?? 0));
  const cool = Math.max(0, Math.min(100, st.coolVlv ?? 0));
  const oa = Math.max(0, Math.min(100, st.oaFrac ?? 0));

  return (
    <svg className="ahu-svg" viewBox="0 0 760 360">
      {/* main duct */}
      <rect x={60} y={70} width={640} height={70} rx={6} className="duct" />

      {/* outside air inlet + damper */}
      <text x={20} y={60} className="ahu-label">Outside air</text>
      <text x={20} y={120} className="ahu-temp">{fmtT(st.oat)}</text>
      <line x1={20} y1={130} x2={60} y2={105} className="duct-edge" />
      <g transform="translate(70,105)">
        <line x1={0} y1={-30} x2={0} y2={30} className="duct-edge" />
        {/* damper blade rotates with OA fraction */}
        <line
          x1={0}
          y1={-20}
          x2={0}
          y2={20}
          className="damper"
          transform={`rotate(${(oa / 100) * 70 - 35})`}
        />
        <text x={-6} y={48} className="ahu-small">{oa.toFixed(0)}%</text>
      </g>

      {/* return air path */}
      <path d="M380 200 L380 175 Q380 160 365 160 L100 160 Q70 160 70 135" className="return" fill="none" />
      <text x={300} y={195} className="ahu-small">return air ({fmtT(st.spaceTemp)})</text>

      {/* mixing -> shows mixed temp */}
      <text x={120} y={62} className="ahu-label">Mix</text>
      <text x={120} y={160} className="ahu-temp">{fmtT(st.mixedTemp)}</text>

      {/* heating coil */}
      <g transform="translate(220,75)">
        <rect x={0} y={0} width={70} height={60} rx={4} className="coil" style={{ fill: heatFill(heat) }} />
        <path d="M8 12 q9 -10 18 0 q9 -10 18 0 q9 -10 18 0" className="coil-wave" />
        <path d="M8 30 q9 -10 18 0 q9 -10 18 0 q9 -10 18 0" className="coil-wave" />
        <path d="M8 48 q9 -10 18 0 q9 -10 18 0 q9 -10 18 0" className="coil-wave" />
        <text x={35} y={-6} className="ahu-small" textAnchor="middle">Heat {heat.toFixed(0)}%</text>
      </g>

      {/* cooling coil */}
      <g transform="translate(310,75)">
        <rect x={0} y={0} width={70} height={60} rx={4} className="coil" style={{ fill: coolFill(cool) }} />
        <path d="M8 12 q9 -10 18 0 q9 -10 18 0 q9 -10 18 0" className="coil-wave" />
        <path d="M8 30 q9 -10 18 0 q9 -10 18 0 q9 -10 18 0" className="coil-wave" />
        <path d="M8 48 q9 -10 18 0 q9 -10 18 0 q9 -10 18 0" className="coil-wave" />
        <text x={35} y={-6} className="ahu-small" textAnchor="middle">Cool {cool.toFixed(0)}%</text>
      </g>

      {/* supply fan */}
      <g transform="translate(470,105)">
        <circle r={28} className="fan-housing" />
        <g className={fanOn ? 'fan spinning' : 'fan'}>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <line key={a} x1={0} y1={0} x2={0} y2={-24} className="fan-blade" transform={`rotate(${a})`} />
          ))}
        </g>
        <circle r={4} className="fan-hub" />
        <text x={0} y={48} className="ahu-small" textAnchor="middle">Fan {fanOn ? 'ON' : 'OFF'}</text>
      </g>

      {/* supply air temp */}
      <text x={545} y={62} className="ahu-label">Supply air</text>
      <text x={545} y={160} className="ahu-temp">{fmtT(st.supplyTemp)}</text>

      {/* zone — shows the real (physical) temperature */}
      <rect x={560} y={210} width={150} height={110} rx={8} className="zone" />
      <text x={635} y={235} className="ahu-label" textAnchor="middle">Zone</text>
      <text x={635} y={278} className="zone-temp" textAnchor="middle">{fmtT(st.spaceTempReal ?? st.spaceTemp)}</text>
      <text x={635} y={300} className="ahu-small" textAnchor="middle">
        {(st.sensorFault ?? 0) > 0.5 ? `⚠ sensor frozen at ${fmtT(st.spaceTemp)}` : 'space temperature'}
      </text>
      {/* supply into zone */}
      <line x1={635} y1={140} x2={635} y2={210} className="duct-edge" />
    </svg>
  );
}

const fmtT = (t: number | undefined) => `${(t ?? 0).toFixed(1)}°F`;
const heatFill = (pct: number) => `color-mix(in srgb, #ef4444 ${Math.round(pct)}%, var(--panel-2))`;
const coolFill = (pct: number) => `color-mix(in srgb, #3b82f6 ${Math.round(pct)}%, var(--panel-2))`;
