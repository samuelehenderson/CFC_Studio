import { useMemo, useState } from 'react';
import { translatePpcl, PPCL_SAMPLES, type MapStatus } from '../engine/ppcl/translate';

const STATUS_LABEL: Record<MapStatus, string> = {
  ok: 'maps cleanly',
  manual: 'manual rework',
  info: 'config / external',
  comment: 'comment',
};

/** Translate tab: a PPCL → CFC migration bench (teaching aid, not a transpiler). */
export function TranslateView() {
  const [src, setSrc] = useState(PPCL_SAMPLES[0].code);
  const rows = useMemo(() => translatePpcl(src), [src]);

  const stmts = rows.filter((r) => r.status !== 'comment');
  const clean = stmts.filter((r) => r.status === 'ok').length;
  const manual = stmts.filter((r) => r.status === 'manual').length;

  return (
    <div className="tabview" style={{ padding: 0 }}>
      <div className="translate-shell">
        <div className="translate-bar">
          <strong style={{ fontSize: 14 }}>PPCL → CFC</strong>
          <span className="muted" style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {stmts.length} statements · {clean} map cleanly · {manual} need rework
          </span>
          <div style={{ flex: 1 }} />
          <label style={{ color: 'var(--text-dim)', fontSize: 12 }}>Example</label>
          <select
            value=""
            onChange={(e) => {
              const s = PPCL_SAMPLES.find((x) => x.name === e.target.value);
              if (s) setSrc(s.code);
            }}
          >
            <option value="">Load example…</option>
            {PPCL_SAMPLES.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="translate-panes">
          <div className="translate-pane">
            <div className="pane-head">PPCL source</div>
            <textarea
              className="ppcl-input"
              spellCheck={false}
              value={src}
              onChange={(e) => setSrc(e.target.value)}
            />
          </div>

          <div className="translate-pane">
            <div className="pane-head">CFC interpretation</div>
            <div className="map-list">
              {rows.map((r) => (
                <div key={r.line} className={`map-row ${r.status}`}>
                  <div className="map-ppcl">
                    <span className="ln">{r.line}</span>
                    <code>{r.ppcl}</code>
                  </div>
                  <div className="map-cfc">
                    <span className={`status-pill ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    <span>{r.cfc}</span>
                    {r.blocks.length > 0 && (
                      <span className="map-blocks">
                        {r.blocks.map((b) => (
                          <code key={b} className="blk">
                            {b}
                          </code>
                        ))}
                      </span>
                    )}
                    {r.note && <div className="map-note">{r.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="translate-foot source-note">
          A teaching aid, not an automated transpiler — Siemens migration is manual. Coverage comes
          from the PPCL→CFC map in <code>docs/CFC-reference.md §5</code> and expands as the rule set
          grows from a real APOGEE PPCL manual. Graded "now you build it" exercises (reusing the
          Learn auto-checker) are the next step.
        </div>
      </div>
    </div>
  );
}
