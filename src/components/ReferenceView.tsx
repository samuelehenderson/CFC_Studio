import { useState } from 'react';
import { blocksByCategory, registry } from '../engine/blocks';
import { ProvBadge, ProvDot } from './ProvBadge';
import type { PinDef } from '../engine/types';

/** Reference tab: auto-generated block datasheets with provenance + pin tables. */
export function ReferenceView() {
  const groups = blocksByCategory();
  const [selected, setSelected] = useState<string>(groups[0]?.blocks[0]?.type ?? '');
  const def = registry[selected];

  return (
    <div className="tabview">
      <div className="tabview-inner" style={{ maxWidth: 1100 }}>
        <h1>Block Reference</h1>
        <p className="lede">
          Datasheets for every block, generated from the live registry. Each block is stamped{' '}
          <ProvBadge provenance="confirmed" /> <ProvBadge provenance="inferred" />{' '}
          <ProvBadge provenance="gap" /> so you always know how faithful it is to Siemens
          documentation — the tool teaches what it knows and flags what it doesn't.
        </p>

        <div className="ref-layout">
          <div className="ref-list">
            {groups.map((g) => (
              <div key={g.category}>
                <div className="ref-cat">{g.category}</div>
                {g.blocks.map((b) => (
                  <button
                    key={b.type}
                    className={`ref-item${selected === b.type ? ' active' : ''}`}
                    onClick={() => setSelected(b.type)}
                  >
                    <span className="nm">{b.type}</span>
                    <ProvDot provenance={b.provenance ?? 'inferred'} />
                  </button>
                ))}
              </div>
            ))}
          </div>

          {def && (
            <div className="ref-detail">
              <h2>
                {def.name}
                <ProvBadge provenance={def.provenance ?? 'inferred'} />
              </h2>
              <p className="muted" style={{ color: 'var(--text-dim)' }}>
                <code style={{ fontFamily: 'var(--font-mono)' }}>{def.type}</code> · {def.category}
              </p>
              <p>{def.description}</p>
              {def.sourceDoc && <div className="source-note">Source: {def.sourceDoc}</div>}

              <PinTable title="Inputs" pins={def.inputs} />
              <PinTable title="Outputs" pins={def.outputs} />

              {def.params && def.params.length > 0 && (
                <>
                  <h3 style={{ fontSize: 13 }}>Parameters</h3>
                  <table className="ref-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Default</th>
                      </tr>
                    </thead>
                    <tbody>
                      {def.params.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td className="mono">{p.type}</td>
                          <td className="mono">{String(p.default)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PinTable({ title, pins }: { title: string; pins: PinDef[] }) {
  if (pins.length === 0) return null;
  return (
    <>
      <h3 style={{ fontSize: 13 }}>{title}</h3>
      <table className="ref-table">
        <thead>
          <tr>
            <th>Pin</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {pins.map((p) => (
            <tr key={p.id}>
              <td className="mono">{p.name}</td>
              <td className="mono">{p.type}</td>
              <td className="mono">{p.default === undefined ? '—' : String(p.default)}</td>
              <td>{p.description ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
