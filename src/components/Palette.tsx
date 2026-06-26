import { blocksByCategory } from '../engine/blocks';
import { useChartStore } from '../store/chartStore';
import { ProvDot } from './ProvBadge';

/**
 * Block palette. Blocks can be dragged onto the canvas, or clicked to drop
 * one near the centre.
 */
export function Palette() {
  const addBlock = useChartStore((s) => s.addBlock);
  const groups = blocksByCategory();

  return (
    <aside className="palette">
      {groups.map((g) => (
        <div key={g.category}>
          <h3>{g.category}</h3>
          {g.blocks.map((b) => (
            <div
              key={b.type}
              className="pal-item"
              title={b.description}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/cfc-block', b.type);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() =>
                addBlock(b.type, {
                  x: 240 + Math.random() * 120,
                  y: 120 + Math.random() * 160,
                })
              }
            >
              <span className="swatch" style={{ background: b.color ?? '#475569' }} />
              <span>{b.name}</span>
              <span className="pal-type">{b.type}</span>
              <ProvDot provenance={b.provenance ?? 'inferred'} />
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}
