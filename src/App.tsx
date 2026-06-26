import { useEffect } from 'react';
import { Topbar } from './components/Topbar';
import { EditorView } from './components/EditorView';
import { ReferenceView } from './components/ReferenceView';
import { ScopeView } from './components/ScopeView';
import { PlantView } from './components/PlantView';
import { LearnView } from './components/LearnView';
import { TranslateView } from './components/TranslateView';
import { useChartStore } from './store/chartStore';

export function App() {
  const activeTab = useChartStore((s) => s.activeTab);

  // Load the sample chart once so the Editor isn't empty on first run.
  useEffect(() => {
    const s = useChartStore.getState();
    if (s.nodes.length === 0) s.loadSample();
  }, []);

  return (
    <div className="shell">
      <Topbar />
      <main className="tab-content">
        {/* Editor stays mounted so the simulation keeps running across tabs. */}
        <div style={{ position: 'absolute', inset: 0, display: activeTab === 'editor' ? 'block' : 'none' }}>
          <EditorView />
        </div>
        {activeTab === 'reference' && <ReferenceView />}
        {activeTab === 'scope' && <ScopeView />}
        {activeTab === 'plant' && <PlantView />}
        {activeTab === 'learn' && <LearnView />}
        {activeTab === 'translate' && <TranslateView />}
      </main>
    </div>
  );
}
