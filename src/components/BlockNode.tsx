import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { registry } from '../engine/blocks';
import { useChartStore, type CfcNode } from '../store/chartStore';
import type { PinDef, Value } from '../engine/types';

function formatVal(v: Value | undefined, type: PinDef['type']): string {
  if (v === undefined) return '–';
  if (type === 'BOOL') return v ? '1' : '0';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return Math.abs(n) >= 100 || Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2);
}

export const BlockNode = memo(({ id, data, selected }: NodeProps<CfcNode>) => {
  const def = registry[data.blockType];
  const live = useChartStore((s) => s.live);
  if (!def) {
    return <div className="cfc-node">Unknown: {data.blockType}</div>;
  }

  const outputs = live.outputs[id] ?? {};
  const inputs = live.inputs[id] ?? {};
  const header = def.color ?? '#475569';

  return (
    <div className={`cfc-node${selected ? ' selected' : ''}`}>
      <div className="hd" style={{ background: header }}>
        <span>{data.label || def.name}</span>
        <span className="seq" title="Execution sequence">#{data.sequence}</span>
      </div>
      <div className="body">
        <div className="pins in">
          {def.inputs.map((pin) => (
            <div className="pin" key={pin.id}>
              <Handle
                type="target"
                position={Position.Left}
                id={pin.id}
                className={pin.type === 'BOOL' ? 'bool' : ''}
                title={`${pin.name} (${pin.type})`}
              />
              <span className="nm">{pin.name}</span>
              <span className={valClass(inputs[pin.id], pin.type)}>
                {formatVal(inputs[pin.id], pin.type)}
              </span>
            </div>
          ))}
        </div>
        <div className="pins out">
          {def.outputs.map((pin) => (
            <div className="pin" key={pin.id}>
              <span className={valClass(outputs[pin.id], pin.type)}>
                {formatVal(outputs[pin.id], pin.type)}
              </span>
              <span className="nm">{pin.name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={pin.id}
                className={pin.type === 'BOOL' ? 'bool' : ''}
                title={`${pin.name} (${pin.type})`}
              />
            </div>
          ))}
        </div>
      </div>
      {def.category === 'I/O' || def.category === 'Constants' ? (
        <div className="label">{describeSource(def.type, data.params)}</div>
      ) : null}
    </div>
  );
});

BlockNode.displayName = 'BlockNode';

function valClass(v: Value | undefined, type: PinDef['type']): string {
  if (type === 'BOOL') return `val bool-${v ? 'true' : 'false'}`;
  return 'val';
}

function describeSource(type: string, params: Record<string, Value | string>): string {
  if (type === 'AI' || type === 'CONST') return `= ${params.value ?? 0}`;
  if (type === 'BI' || type === 'BCONST') return params.value ? 'TRUE' : 'FALSE';
  return '';
}
