import { useChartStore, type TabId } from '../store/chartStore';

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: 'learn', label: 'Learn', hint: 'Guided lessons & challenges' },
  { id: 'editor', label: 'Editor', hint: 'Build & simulate charts' },
  { id: 'plant', label: 'Plant', hint: 'Live animated equipment' },
  { id: 'scope', label: 'Scope', hint: 'Trends & data recorder' },
  { id: 'translate', label: 'Translate', hint: 'PPCL → CFC migration bench' },
  { id: 'reference', label: 'Reference', hint: 'Block datasheets & glossary' },
  { id: 'report', label: 'Report', hint: 'Daily field report builder — export Word / PDF' },
];

/** Global top bar: brand, primary tab navigation, theme toggle. */
export function Topbar() {
  const activeTab = useChartStore((s) => s.activeTab);
  const setTab = useChartStore((s) => s.setTab);
  const theme = useChartStore((s) => s.theme);
  const toggleTheme = useChartStore((s) => s.toggleTheme);

  return (
    <header className="topbar">
      <div className="brand">
        CFC<span>Studio</span>
      </div>
      <nav className="tabbar" role="tablist" aria-label="Primary">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={`tab${activeTab === t.id ? ' active' : ''}`}
            title={t.hint}
            onClick={() => setTab(t.id)}
          >
            {activeTab === t.id && <span className="dot" />}
            {t.label}
          </button>
        ))}
      </nav>
      <div className="spacer" />
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        title="Toggle light / dark theme"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀ Light' : '☾ Dark'}
      </button>
    </header>
  );
}
