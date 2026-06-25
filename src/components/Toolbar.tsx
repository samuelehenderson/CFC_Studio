import { useRef } from 'react';
import { useChartStore } from '../store/chartStore';

/** Top toolbar: run/pause/step/reset, speed, save/load, sample chart. */
export function Toolbar() {
  const running = useChartStore((s) => s.running);
  const time = useChartStore((s) => s.time);
  const speed = useChartStore((s) => s.speed);
  const start = useChartStore((s) => s.start);
  const pause = useChartStore((s) => s.pause);
  const step = useChartStore((s) => s.step);
  const reset = useChartStore((s) => s.reset);
  const setSpeed = useChartStore((s) => s.setSpeed);
  const serialize = useChartStore((s) => s.serialize);
  const load = useChartStore((s) => s.load);
  const clear = useChartStore((s) => s.clear);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const blob = new Blob([serialize()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart.cfc.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => load(String(reader.result));
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="toolbar">
      <div className="brand">
        CFC<span>Studio</span>
      </div>
      {running ? (
        <button onClick={pause}>⏸ Pause</button>
      ) : (
        <button className="primary" onClick={start}>
          ▶ Run
        </button>
      )}
      <button onClick={step} disabled={running}>
        ⏭ Step
      </button>
      <button onClick={reset}>⟲ Reset</button>

      <label style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8 }}>Speed</label>
      <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
        <option value={0.25}>0.25×</option>
        <option value={1}>1×</option>
        <option value={5}>5×</option>
        <option value={20}>20×</option>
      </select>

      <div className="spacer" />
      <span className="clock">t = {time.toFixed(1)} s</span>

      <button onClick={save}>Save</button>
      <button onClick={() => fileRef.current?.click()}>Load</button>
      <input ref={fileRef} type="file" accept=".json" hidden onChange={openFile} />
      <button onClick={() => useChartStore.getState().loadSample()}>Sample</button>
      <button onClick={clear}>Clear</button>
    </div>
  );
}
