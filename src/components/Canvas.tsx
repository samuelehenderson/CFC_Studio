import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { RunSequencePanel } from './RunSequencePanel';
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
  const theme = useChartStore((s) => s.theme);
  const showSequence = useChartStore((s) => s.showSequence);
  const beginInteraction = useChartStore((s) => s.beginInteraction);

  // Keyboard: undo/redo, copy/paste/duplicate, delete. Ignored while typing
  // in an input, and only active on the Editor tab (this component mounts there).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        return;
      }
      const s = useChartStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        s.copySelection();
      } else if (mod && e.key.toLowerCase() === 'v') {
        s.paste();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelection();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.deleteSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        onNodeDragStart={() => beginInteraction()}
        onNodeClick={(_, n) => setSelected(n.id)}
        onPaneClick={() => setSelected(null)}
        deleteKeyCode={null}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background gap={16} color={theme === 'light' ? '#dbe2ea' : '#1e293b'} />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => registry[(n as CfcNode).data.blockType]?.color ?? '#475569'}
          maskColor="rgba(15,23,42,0.6)"
        />
      </ReactFlow>
      {showSequence && <RunSequencePanel />}
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
