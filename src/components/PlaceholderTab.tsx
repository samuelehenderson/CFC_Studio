import type { TabId } from '../store/chartStore';

interface PlannedTab {
  title: string;
  lede: string;
  cards: { title: string; body: string }[];
}

type PendingTab = Extract<TabId, 'learn' | 'translate'>;

const CONTENT: Record<PendingTab, PlannedTab> = {
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

/** Polished "coming soon" view for tabs whose runtime lands in a later phase. */
export function PlaceholderTab({ tab }: { tab: PendingTab }) {
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
