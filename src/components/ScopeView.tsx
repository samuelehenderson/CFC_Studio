import { useMemo, useState } from 'react';
import { useChartStore, type WatchSeries } from '../store/chartStore';
import { registry } from '../engine/blocks';

const WINDOWS = [30, 60, 120, 300];

type Sample = { t: number; v: Record<string, number> };

/** Scope tab: a live oscilloscope + data recorder with a hover cursor and
 *  per-signal control metrics. */
export function ScopeView() {
  const watch = useChartStore((s) => s.watch);
  const history = useChartStore((s) => s.history);
  const time = useChartStore((s) => s.time);
  const nodes = useChartStore((s) => s.nodes);
  const addWatch = useChartStore((s) => s.addWatch);
  const removeWatch = useChartStore((s) => s.removeWatch);
  const clearWatch = useChartStore((s) => s.clearWatch);
  const autoWatchIO = useChartStore((s) => s.autoWatchIO);
  const [windowSec, setWindowSec] = useState(60);
  const [cursorT, setCursorT] = useState<number | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);

  const analog = watch.filter((w) => w.kind === 'analog');
  const binary = watch.filter((w) => w.kind === 'binary');

  const options = useMemo(() => {
    const out: { id: string; nodeId: string; pinId: string; label: string; kind: 'analog' | 'binary' }[] = [];
    for (const n of nodes) {
      const def = registry[n.data.blockType];
      if (!def) continue;
      for (const pin of def.outputs) {
        const id = `${n.id}:output:${pin.id}`;
        if (watch.some((w) => w.id === id)) continue;
        out.push({
          id,
          nodeId: n.id,
          pinId: pin.id,
          label: `${n.data.label || def.name} · ${pin.name}`,
          kind: pin.type === 'BOOL' ? 'binary' : 'analog',
        });
      }
    }
    return out;
  }, [nodes, watch]);

  const last = history[history.length - 1] ?? null;

  // Sample nearest the hover cursor (snaps the readout to real data).
  const cursorSample = useMemo<Sample | null>(() => {
    if (cursorT == null || !history.length) return null;
    let best = history[0];
    for (const s of history) if (Math.abs(s.t - cursorT) < Math.abs(best.t - cursorT)) best = s;
    return best;
  }, [cursorT, history]);
  const readout = cursorSample ?? last;

  // Per-analog-signal metrics over the whole recorded run.
  const metrics = useMemo(
    () =>
      analog.map((a) => {
        const ys: number[] = [];
        for (const s of history) {
          const v = s.v[a.id];
          if (v !== undefined && !Number.isNaN(v)) ys.push(v);
        }
        if (ys.length < 2) return { id: a.id, label: a.label, color: a.color, empty: true } as const;
        const final = ys[ys.length - 1];
        const min = Math.min(...ys);
        const max = Math.max(...ys);
        const band = Math.max((max - min) * 0.02, Math.abs(final) * 0.02, 0.01);
        let lastOut = -1;
        for (let i = 0; i < history.length; i++) {
          const v = history[i].v[a.id];
          if (v !== undefined && Math.abs(v - final) > band) lastOut = i;
        }
        const settled =
          lastOut < 0 ? 0 : lastOut < history.length - 1 ? history[lastOut + 1].t : null;
        return {
          id: a.id,
          label: a.label,
          color: a.color,
          empty: false,
          final,
          min,
          max,
          overshoot: Math.max(0, max - final),
          settled,
        } as const;
      }),
    [analog, history],
  );

  return (
    <div className="tabview" style={{ padding: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="scope-toolbar">
          <strong style={{ fontSize: 14 }}>Scope</strong>
          <span className="muted" style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {watch.length} signals · t = {time.toFixed(1)}s
            {cursorSample && <> · cursor @ {cursorSample.t.toFixed(1)}s</>}
          </span>
          <div className="spacer" style={{ flex: 1 }} />
          <button
            onClick={() => setShowMetrics((m) => !m)}
            style={showMetrics ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
            title="Show control metrics"
          >
            Metrics
          </button>
          <label style={{ color: 'var(--text-dim)', fontSize: 12 }}>Window</label>
          <select value={windowSec} onChange={(e) => setWindowSec(Number(e.target.value))}>
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}s
              </option>
            ))}
          </select>
          <select
            value=""
            onChange={(e) => {
              const o = options.find((x) => x.id === e.target.value);
              if (o) addWatch({ id: o.id, nodeId: o.nodeId, pinId: o.pinId, source: 'output', label: o.label, kind: o.kind });
            }}
          >
            <option value="">+ Add signal…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button onClick={autoWatchIO}>Auto: I/O points</button>
          <button onClick={() => exportCsv(watch, history)} disabled={!history.length}>
            Export CSV
          </button>
          <button onClick={clearWatch} disabled={!watch.length}>
            Clear
          </button>
        </div>

        {watch.length === 0 ? (
          <div className="empty" style={{ margin: 'auto' }}>
            No signals watched yet.
            <br />
            Add a signal above, or click <b>Auto: I/O points</b>, then press Run on the Editor tab.
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px 16px' }}>
            <Chart
              watch={watch}
              history={history}
              windowSec={windowSec}
              currentTime={time}
              cursor={cursorSample}
              onCursor={setCursorT}
            />
            <div className="scope-legend">
              {[...analog, ...binary].map((w) => (
                <button key={w.id} className="legend-item" onClick={() => removeWatch(w.id)} title="Remove">
                  <span className="sw" style={{ background: w.color }} />
                  <span>{w.label}</span>
                  <span className="val" style={{ color: w.color }}>
                    {readout ? fmt(readout.v[w.id], w.kind) : '–'}
                  </span>
                  <span className="x">✕</span>
                </button>
              ))}
            </div>

            {showMetrics && (
              <table className="scope-metrics">
                <thead>
                  <tr>
                    <th>Signal</th>
                    <th>Final</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Overshoot</th>
                    <th>Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className="sw" style={{ background: m.color }} /> {m.label}
                      </td>
                      {m.empty ? (
                        <td colSpan={5} className="muted">run the simulation to collect data</td>
                      ) : (
                        <>
                          <td className="num">{m.final.toFixed(2)}</td>
                          <td className="num">{m.min.toFixed(2)}</td>
                          <td className="num">{m.max.toFixed(2)}</td>
                          <td className="num">{m.overshoot.toFixed(2)}</td>
                          <td className="num">{m.settled == null ? '—' : `${m.settled.toFixed(1)}s`}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Chart({
  watch,
  history,
  windowSec,
  currentTime,
  cursor,
  onCursor,
}: {
  watch: WatchSeries[];
  history: Sample[];
  windowSec: number;
  currentTime: number;
  cursor: Sample | null;
  onCursor: (t: number | null) => void;
}) {
  const W = 1000;
  const H = 440;
  const padL = 46;
  const padR = 12;
  const padT = 12;
  const analog = watch.filter((w) => w.kind === 'analog');
  const binary = watch.filter((w) => w.kind === 'binary');
  const laneH = 20;
  const binAreaH = binary.length * (laneH + 4);
  const analogBottom = H - binAreaH - 26;

  const tEnd = Math.max(currentTime, history.length ? history[history.length - 1].t : 0);
  const tStart = tEnd - windowSec;
  const vis = history.filter((s) => s.t >= tStart - 1);

  let min = Infinity;
  let max = -Infinity;
  for (const s of vis) {
    for (const a of analog) {
      const v = s.v[a.id];
      if (v === undefined || Number.isNaN(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  if (max - min < 1e-6) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;

  const xOf = (t: number) => padL + ((t - tStart) / windowSec) * (W - padL - padR);
  const yOf = (v: number) => padT + (1 - (v - min) / (max - min)) * (analogBottom - padT);

  const linePath = (s: WatchSeries) => {
    let d = '';
    let started = false;
    for (const sample of vis) {
      const v = sample.v[s.id];
      if (v === undefined) continue;
      const x = xOf(sample.t);
      const y = yOf(v);
      d += `${started ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
      started = true;
    }
    return d;
  };

  const ticks = 4;
  const gridY = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xVB = ((e.clientX - rect.left) / rect.width) * W;
    const t = tStart + ((xVB - padL) / (W - padL - padR)) * windowSec;
    onCursor(Math.max(tStart, Math.min(tEnd, t)));
  };

  const cursorVisible = cursor && cursor.t >= tStart && cursor.t <= tEnd;
  const cx = cursorVisible ? xOf(cursor!.t) : 0;

  return (
    <svg
      className="scope-svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      onMouseMove={handleMove}
      onMouseLeave={() => onCursor(null)}
    >
      {gridY.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={yOf(g)} y2={yOf(g)} className="grid" />
          <text x={4} y={yOf(g) + 3} className="axis">
            {g.toFixed(0)}
          </text>
        </g>
      ))}
      {Array.from({ length: 5 }, (_, i) => {
        const t = tStart + (windowSec * i) / 4;
        return (
          <text key={i} x={xOf(t)} y={analogBottom + 14} className="axis" textAnchor="middle">
            {t.toFixed(0)}s
          </text>
        );
      })}
      {analog.map((s) => (
        <path key={s.id} d={linePath(s)} fill="none" stroke={s.color} strokeWidth={1.5} />
      ))}
      {binary.map((s, i) => {
        const top = analogBottom + 24 + i * (laneH + 4);
        const yHi = top + 2;
        const yLo = top + laneH - 2;
        let d = '';
        let started = false;
        let prevY = yLo;
        for (const sample of vis) {
          const v = sample.v[s.id];
          if (v === undefined) continue;
          const x = xOf(sample.t);
          const y = v > 0.5 ? yHi : yLo;
          if (!started) {
            d += `M${x.toFixed(1)} ${y.toFixed(1)} `;
            started = true;
          } else {
            d += `L${x.toFixed(1)} ${prevY.toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)} `;
          }
          prevY = y;
        }
        return (
          <g key={s.id}>
            <rect x={padL} y={top} width={W - padL - padR} height={laneH} className="lane" />
            <path d={d} fill="none" stroke={s.color} strokeWidth={1.5} />
            <text x={padL + 4} y={top + laneH - 6} className="axis" style={{ fill: s.color }}>
              {s.label}
            </text>
          </g>
        );
      })}
      {/* hover cursor */}
      {cursorVisible && (
        <g>
          <line x1={cx} x2={cx} y1={padT} y2={H - 16} className="scope-cursor" />
          {analog.map((s) => {
            const v = cursor!.v[s.id];
            if (v === undefined) return null;
            return <circle key={s.id} cx={cx} cy={yOf(v)} r={3} fill={s.color} />;
          })}
        </g>
      )}
    </svg>
  );
}

function fmt(v: number | undefined, kind: 'analog' | 'binary'): string {
  if (v === undefined) return '–';
  if (kind === 'binary') return v > 0.5 ? 'ON' : 'OFF';
  return Number.isInteger(v) ? v.toFixed(0) : v.toFixed(2);
}

function exportCsv(watch: WatchSeries[], history: Sample[]) {
  const header = ['t', ...watch.map((w) => w.label)].join(',');
  const rows = history.map((s) => [s.t.toFixed(2), ...watch.map((w) => (s.v[w.id] ?? '').toString())].join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scope.csv';
  a.click();
  URL.revokeObjectURL(url);
}
