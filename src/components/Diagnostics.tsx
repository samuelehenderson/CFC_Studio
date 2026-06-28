import { useEffect, useMemo, useState } from 'react';
import { useChartStore } from '../store/chartStore';
import { validateChart, type Problem } from '../engine/validate';

/** Editor bottom drawer: validation problems + solver warnings. */
export function Diagnostics() {
  const nodes = useChartStore((s) => s.nodes);
  const edges = useChartStore((s) => s.edges);
  const warnings = useChartStore((s) => s.warnings);
  const setSelected = useChartStore((s) => s.setSelected);
  const insertConvert = useChartStore((s) => s.insertConvert);
  const [open, setOpen] = useState(false);

  const problems = useMemo<Problem[]>(() => {
    const loops: Problem[] = warnings.map((m, i) => ({ id: `loop:${i}`, severity: 'warning', message: m }));
    return [...loops, ...validateChart(nodes, edges)];
  }, [nodes, edges, warnings]);

  const errs = problems.filter((p) => p.severity === 'error').length;
  const warns = problems.filter((p) => p.severity === 'warning').length;
  const infos = problems.filter((p) => p.severity === 'info').length;

  // Auto-open when a problem first appears so it isn't missed.
  useEffect(() => {
    if (problems.length > 0) setOpen(true);
  }, [problems.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`diagnostics${open ? ' open' : ''}`}>
      <button className="diag-head" onClick={() => setOpen((o) => !o)}>
        <span className="diag-caret">{open ? '▾' : '▸'}</span>
        <strong>Diagnostics</strong>
        {problems.length === 0 ? (
          <span className="diag-ok">✓ no problems</span>
        ) : (
          <span className="diag-counts">
            {warns > 0 && <span className="c warning">⚠ {warns}</span>}
            {errs > 0 && <span className="c error">✗ {errs}</span>}
            {infos > 0 && <span className="c info">ⓘ {infos}</span>}
          </span>
        )}
      </button>
      {open && (
        <div className="diag-list">
          {problems.length === 0 ? (
            <div className="diag-empty">No validation problems. Type-mismatched wires, algebraic loops, and duplicate labels show up here.</div>
          ) : (
            problems.map((p) => (
              <div key={p.id} className={`diag-item ${p.severity}`}>
                <span className="ic">{p.severity === 'error' ? '✗' : p.severity === 'warning' ? '⚠' : 'ⓘ'}</span>
                <button className="diag-msg" onClick={() => p.nodeId && setSelected(p.nodeId)} disabled={!p.nodeId}>
                  {p.message}
                </button>
                {p.fix && (
                  <button className="diag-fix" onClick={() => insertConvert(p.fix!)} title={`Insert a ${p.fix.convertType} block`}>
                    Fix: insert {p.fix.convertType}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
