import { Toolbar } from './Toolbar';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';

/** The Editor tab: authoring + simulation. */
export function EditorView() {
  return (
    <div className="editor-grid">
      <Toolbar />
      <Palette />
      <Canvas />
      <Inspector />
    </div>
  );
}
