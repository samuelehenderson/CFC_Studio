import { Toolbar } from './Toolbar';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';
import { Diagnostics } from './Diagnostics';

/** The Editor tab: authoring + simulation. */
export function EditorView() {
  return (
    <div className="editor-grid">
      <Toolbar />
      <Palette />
      <Canvas />
      <Inspector />
      <Diagnostics />
    </div>
  );
}
