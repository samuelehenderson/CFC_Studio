import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { useChartStore } from './store/chartStore';

export function App() {
  // Load the sample chart on first mount so the app isn't empty.
  useEffect(() => {
    const s = useChartStore.getState();
    if (s.nodes.length === 0) s.loadSample();
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <Palette />
      <Canvas />
      <Inspector />
    </div>
  );
}
