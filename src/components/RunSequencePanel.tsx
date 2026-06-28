import { useChartStore } from '../store/chartStore';
import { registry } from '../engine/blocks';

/** Run-Sequence editor: the order the panel solves blocks each cycle, with
 *  reordering and explicit "Set Start of Feedback". */
export function RunSequencePanel() {
  const sim = useChartStore((s) => s.sim);
  const nodes = useChartStore((s) => s.nodes);
  const edges = useChartStore((s) => s.edges);
  const reorder = useChartStore((s) => s.reorderSequence);
  const setFb = useChartStore((s) => s.setFeedbackStart);
  const setSelected = useChartStore((s) => s.setSelected);
  const close = useChartStore((s) => s.toggleSequence);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const order = (sim?.orderIds ?? []).filter((id) => byId.has(id));
  const fbIds = sim?.feedbackConnIds;
  const feedbackTargets = new Set(edges.filter((e) => fbIds?.has(e.id)).map((e) => e.target));

  const move = (i: number, dir: -1 | 1) => {
    const next = [...order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    reorder(next);
  };

  return (
    <div className="seq-panel">
      <div className="seq-head">
        <strong>Run Sequence</strong>
        <span className="muted" style={{ color: 'var(--text-dim)', fontSize: 11 }}>{order.length} blocks</span>
        <div style={{ flex: 1 }} />
        <button onClick={close} title="Close">✕</button>
      </div>
      <p className="seq-note">
        Blocks solve top-to-bottom each cycle. <span className="seq-fb">⟲</span> = reads a
        previous-cycle (feedback) input. Mark a block <b>⟲ start</b> to break a loop there yourself.
      </p>
      <div className="seq-list">
        {order.length === 0 && <div className="seq-empty">No blocks yet.</div>}
        {order.map((id, i) => {
          const node = byId.get(id)!;
          const def = registry[node.data.blockType];
          return (
            <div key={id} className={`seq-row${node.data.feedbackStart ? ' fbstart' : ''}`}>
              <span className="seq-num">{i + 1}</span>
              <button className="seq-name" onClick={() => setSelected(id)}>
                <span className="t" style={{ color: def?.color }}>{def?.type ?? '?'}</span>
                <span className="l">{node.data.label || ''}</span>
              </button>
              {feedbackTargets.has(id) && <span className="seq-fb" title="reads a previous-cycle value">⟲</span>}
              <button
                className={`seq-fbbtn${node.data.feedbackStart ? ' on' : ''}`}
                title="Set Start of Feedback — read this block's inputs from the previous cycle"
                onClick={() => setFb(id, !node.data.feedbackStart)}
              >
                ⟲ start
              </button>
              <button className="seq-mv" onClick={() => move(i, -1)} disabled={i === 0} title="Move earlier">↑</button>
              <button className="seq-mv" onClick={() => move(i, 1)} disabled={i === order.length - 1} title="Move later">↓</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
