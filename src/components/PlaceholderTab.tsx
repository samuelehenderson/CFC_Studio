import type { TabId } from '../store/chartStore';

interface PlannedTab {
  title: string;
  lede: string;
  cards: { title: string; body: string }[];
}

const CONTENT: Record<Exclude<TabId, 'editor' | 'reference'>, PlannedTab> = {
  learn: {
    title: 'Learn',
    lede: 'The training spine: a guided, auto-checked curriculum that drives the real editor. You build charts to learn CFC by doing — from logic and timers to PID loops and full HVAC sequences — with the lesson grading your chart on its actual simulated behavior.',
    cards: [
      { title: 'Module map', body: 'Lessons with prerequisites and progress, from "What is CFC?" through PPCL migration.' },
      { title: 'In-canvas tutorials', body: 'Stepper with anchored callouts and a 3-tier hint ladder right on the chart.' },
      { title: 'Behavioral auto-checker', body: 'Runs your chart against a scripted stimulus and grades observed behavior within tolerance — any correct topology passes.' },
      { title: 'Quizzes & challenges', body: 'Spot-checks and open "build this" exercises with auto-scored signal traces.' },
    ],
  },
  plant: {
    title: 'Plant',
    lede: 'The standout feature: a live, animated mechanical schematic that your chart actually controls. PPCL engineers think in equipment, not data-flow — watch your loop spin a fan, stroke a valve, and settle a room in real time.',
    cards: [
      { title: 'Selectable equipment', body: 'AHU, VAV box, boiler, chiller plant — each a pluggable lumped-physics model.' },
      { title: 'Point-bound animation', body: 'Valves, dampers, fans and coils driven by your AO points; sensors feed your AI points.' },
      { title: 'In lockstep with the solver', body: 'The plant is just another cyclic system: it reads commands and writes sensor values every cycle.' },
      { title: 'Scenario & fault injection', body: 'Inject weather swings, stuck dampers or sensor faults and watch the control respond.' },
    ],
  },
  scope: {
    title: 'Scope',
    lede: 'An oscilloscope and data recorder for your chart. Plot any pin over time, scrub the timeline, and measure control performance — overshoot, settling time, integrated error — as you tune.',
    cards: [
      { title: 'Multi-trace plotting', body: 'Analog line traces and boolean step traces on a shared, scrubbable timeline.' },
      { title: 'Watch list', body: 'Pin any pin to follow it; cursor readout shows exact values at any instant.' },
      { title: 'Run-vs-run ghosts', body: 'Overlay a previous run to compare tuning changes side by side.' },
      { title: 'Export', body: 'CSV of the recorded signals and PNG of the trace for reports.' },
    ],
  },
  translate: {
    title: 'Translate',
    lede: 'The PPCL → CFC migration bench — the reason this project exists. Paste PPCL and see the equivalent CFC blocks, with a morph animation and a mapping table. Framed as a teaching aid, not an automated transpiler (Siemens migration is manual).',
    cards: [
      { title: 'Side-by-side view', body: 'PPCL on the left, the CFC equivalent on the right, with animated mapping between them.' },
      { title: 'Mapping table', body: 'Backed by the PPCL→CFC map in docs/CFC-reference.md §5 — every construct to its block equivalent.' },
      { title: '"Now you build it"', body: 'Graded exercises: given PPCL, build the CFC chart and get checked on behavior.' },
      { title: 'Untranslatable flags', body: 'GOTO/GOSUB and other constructs with no clean CFC equivalent are flagged for manual rework.' },
    ],
  },
};

/** Polished "coming soon" view for tabs whose runtime lands in Phase 2/3. */
export function PlaceholderTab({ tab }: { tab: Exclude<TabId, 'editor' | 'reference'> }) {
  const c = CONTENT[tab];
  return (
    <div className="tabview">
      <div className="tabview-inner">
        <span className="coming-soon">On the roadmap</span>
        <h1>{c.title}</h1>
        <p className="lede">{c.lede}</p>
        <h2>What this tab will do</h2>
        <div className="card-grid">
          {c.cards.map((card) => (
            <div className="card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
