import { useCallback, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type ReactFlowInstance,
  useReactFlow,
} from '@xyflow/react';
import { BlockNode } from './BlockNode';
import { useChartStore, type CfcNode } from '../store/chartStore';
import { registry } from '../engine/blocks';

const nodeTypes = { cfcBlock: BlockNode };

function Flow() {
  const nodes = useChartStore((s) => s.nodes);
  const edges = useChartStore((s) => s.edges);
  const feedbackIds = useChartStore((s) => s.sim?.feedbackConnIds);
  const onNodesChange = useChartStore((s) => s.onNodesChange);
  const onEdgesChange = useChartStore((s) => s.onEdgesChange);
  const onConnect = useChartStore((s) => s.onConnect);
  const setSelected = useChartStore((s) => s.setSelected);
  const addBlock = useChartStore((s) => s.addBlock);
  const warnings = useChartStore((s) => s.warnings);

  const wrapper = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<CfcNode, Edge> | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Tag feedback edges so they render dashed/amber.
  const styledEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        className: feedbackIds?.has(e.id) ? 'feedback' : undefined,
        animated: true,
      })),
    [edges, feedbackIds],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/cfc-block');
      if (!type || !registry[type]) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addBlock(type, position);
    },
    [screenToFlowPosition, addBlock],
  );

  return (
    <div className="canvas" ref={wrapper}>
      <ReactFlow<CfcNode, Edge>
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onInit={(inst) => (rfRef.current = inst)}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => setSelected(n.id)}
        onPaneClick={() => setSelected(null)}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background gap={16} color="#1e293b" />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => registry[(n as CfcNode).data.blockType]?.color ?? '#475569'}
          maskColor="rgba(15,23,42,0.6)"
        />
      </ReactFlow>
      {warnings.length > 0 && (
        <div className="warnings">
          {warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
