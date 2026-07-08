import { Plus, Settings } from 'lucide-react';
import { useState } from 'react';

type TabId = 'open-prs' | 'reviews';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'open-prs', label: 'Open PRs' },
  { id: 'reviews', label: 'Reviews' },
];

export const App = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<TabId>('open-prs');

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <img src="/icon.png" alt="" className="brand-icon" />
          <h1>githubg</h1>
        </div>
        <nav className="tabs" aria-label="Main views">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="tab-button"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="content-region">
        {activeTab === 'open-prs' ? (
          <section className="panel" aria-labelledby="open-prs-heading">
            <div className="panel-header">
              <h2 id="open-prs-heading">Open PRs</h2>
              <span className="count-pill">0</span>
            </div>
            <div className="empty-list">No open PRs loaded.</div>
          </section>
        ) : (
          <section className="panel" aria-labelledby="reviews-heading">
            <div className="panel-header">
              <h2 id="reviews-heading">Reviews</h2>
              <span className="count-pill">0</span>
            </div>
            <div className="empty-list">No team PRs loaded.</div>
          </section>
        )}
      </main>

      <footer className="footer-bar">
        <button type="button" className="icon-button" title="Team members" aria-label="Team members">
          <Plus size={18} strokeWidth={2.2} />
        </button>
        <button type="button" className="icon-button" title="Settings" aria-label="Settings">
          <Settings size={18} strokeWidth={2.2} />
        </button>
      </footer>
    </div>
  );
};
