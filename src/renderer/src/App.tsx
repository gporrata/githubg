import { Plus, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PullRequestSummary } from '../../shared/pullRequest';
import { PullRequestCard } from './components/PullRequestCard';

type TabId = 'open-prs' | 'reviews';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'open-prs', label: 'Open PRs' },
  { id: 'reviews', label: 'Reviews' },
];

export const App = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<TabId>('open-prs');
  const [openPullRequests, setOpenPullRequests] = useState<PullRequestSummary[]>([]);
  const [reviewPullRequests, setReviewPullRequests] = useState<PullRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activePullRequests = activeTab === 'open-prs' ? openPullRequests : reviewPullRequests;

  useEffect(() => {
    let isCurrent = true;

    const loadPullRequests = async (): Promise<void> => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [openPrs, reviewPrs] = await Promise.all([
          window.githubg.listOpenPullRequests(),
          window.githubg.listReviewPullRequests(),
        ]);

        if (isCurrent) {
          setOpenPullRequests(openPrs);
          setReviewPullRequests(reviewPrs);
        }
      } catch (error) {
        if (isCurrent) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load pull requests.');
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    void loadPullRequests();

    return () => {
      isCurrent = false;
    };
  }, []);

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
        <section
          className="panel"
          aria-labelledby={activeTab === 'open-prs' ? 'open-prs-heading' : 'reviews-heading'}
        >
          <div className="panel-header">
            <h2 id={activeTab === 'open-prs' ? 'open-prs-heading' : 'reviews-heading'}>
              {activeTab === 'open-prs' ? 'Open PRs' : 'Reviews'}
            </h2>
            <span className="count-pill">{activePullRequests.length}</span>
          </div>
          {loadError ? (
            <div className="empty-list empty-list--error">{loadError}</div>
          ) : isLoading ? (
            <div className="empty-list">Loading pull requests.</div>
          ) : activePullRequests.length > 0 ? (
            <div className="pr-list">
              {activePullRequests.map((pullRequest) => (
                <PullRequestCard key={pullRequest.id} pullRequest={pullRequest} />
              ))}
            </div>
          ) : (
            <div className="empty-list">
              {activeTab === 'open-prs' ? 'No open PRs loaded.' : 'No team PRs loaded.'}
            </div>
          )}
        </section>
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
