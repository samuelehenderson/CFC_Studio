import { registry } from '../engine/blocks';
import { useChartStore } from '../store/chartStore';
import { ProvBadge } from './ProvBadge';
import type { ParamDef, Value } from '../engine/types';

/** Right-hand inspector: edit the selected block's params, sequence, label,
 *  and watch its live input/output values. */
export function Inspector() {
  const selectedId = useChartStore((s) => s.selectedId);
  const node = useChartStore((s) => s.nodes.find((n) => n.id === s.selectedId));
  const live = useChartStore((s) => s.live);
  const updateParam = useChartStore((s) => s.updateParam);
  const setSequence = useChartStore((s) => s.setSequence);
  const setLabel = useChartStore((s) => s.setLabel);
  const deleteNode = useChartStore((s) => s.deleteNode);

  if (!node || !selectedId) {
    return (
      <aside className="inspector">
        <div className="empty">
          Select a block to edit its parameters and watch live values.
          <br />
          <br />
          Drag blocks from the palette, wire output pins to input pins, then press Run.
        </div>
      </aside>
    );
  }

  const def = registry[node.data.blockType];
  if (!def) return <aside className="inspector">Unknown block.</aside>;

  const inputs = live.inputs[selectedId] ?? {};
  const outputs = live.outputs[selectedId] ?? {};

  return (
    <aside className="inspector">
      <h2>{def.name}</h2>
      <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span>
          {def.type} · {def.category}
        </span>
        <ProvBadge provenance={def.provenance ?? 'inferred'} />
      </p>
      <p className="muted">{def.description}</p>
      {def.sourceDoc && <p className="source-note">Source: {def.sourceDoc}</p>}

      <div className="field">
        <label>Label</label>
        <input
          value={node.data.label ?? ''}
          placeholder="(optional name)"
          onChange={(e) => setLabel(selectedId, e.target.value)}
        />
      </div>
      <div className="field">
        <label>Execution sequence</label>
        <input
          type="number"
          value={node.data.sequence}
          onChange={(e) => setSequence(selectedId, Number(e.target.value))}
        />
      </div>

      {def.params && def.params.length > 0 && (
        <>
          <hr />
          <strong>Parameters</strong>
          {def.params.map((p) => (
            <ParamField
              key={p.id}
              param={p}
              value={node.data.params[p.id] ?? p.default}
              onChange={(v) => updateParam(selectedId, p.id, v)}
            />
          ))}
        </>
      )}

      <hr />
      <strong>Live values</strong>
      <div style={{ marginTop: 6 }}>
        {def.inputs.map((pin) => (
          <div className="pinrow" key={pin.id}>
            <span>{pin.name} (in)</span>
            <span className="v">{fmt(inputs[pin.id], pin.type)}</span>
          </div>
        ))}
        {def.outputs.map((pin) => (
          <div className="pinrow" key={pin.id}>
            <span>{pin.name} (out)</span>
            <span className="v">{fmt(outputs[pin.id], pin.type)}</span>
          </div>
        ))}
      </div>

      <hr />
      <button onClick={() => deleteNode(selectedId)}>Delete block</button>
    </aside>
  );
}

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ParamDef;
  value: Value | string;
  onChange: (v: Value | string) => void;
}) {
  if (param.type === 'BOOL') {
    return (
      <div className="field row">
        <input
          type="checkbox"
          checked={value === true || value === 1}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 'auto' }}
        />
        <label style={{ margin: 0 }}>{param.name}</label>
      </div>
    );
  }
  if (param.type === 'ENUM') {
    return (
      <div className="field">
        <label>{param.name}</label>
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {param.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div className="field">
      <label>{param.name}</label>
      <input
        type="number"
        value={Number(value)}
        min={param.min}
        max={param.max}
        step="any"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function fmt(v: Value | undefined, type: 'BOOL' | 'REAL' | 'INT'): string {
  if (v === undefined) return '–';
  if (type === 'BOOL') return v ? 'TRUE' : 'FALSE';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return Number.isInteger(n) ? n.toFixed(0) : n.toFixed(3);
}
