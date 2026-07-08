import { Plus, RefreshCw, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PullRequestSummary } from '../../shared/pullRequest';
import type { TeamMember, ThemeId } from '../../shared/settings';
import { themeOptions } from '../../shared/settings';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [knownUsers, setKnownUsers] = useState<TeamMember[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedLogin, setSelectedLogin] = useState('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('system');
  const [pollIntervalMs, setPollIntervalMs] = useState(120_000);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [nextRefreshAtMs, setNextRefreshAtMs] = useState(() => Date.now() + 120_000);
  const hasLoadedPullRequests = useRef(false);
  const refreshInFlight = useRef(false);
  const activePullRequests = activeTab === 'open-prs' ? openPullRequests : reviewPullRequests;
  const selectedKnownUser = knownUsers.find((user) => user.login === selectedLogin);
  const nextRefreshSeconds = Math.max(0, Math.ceil((nextRefreshAtMs - currentTimeMs) / 1000));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const refreshPullRequests = useCallback(async (): Promise<void> => {
    if (refreshInFlight.current) {
      return;
    }

    refreshInFlight.current = true;
    setIsRefreshing(true);

    if (!hasLoadedPullRequests.current) {
      setIsLoading(true);
    }

    setLoadError(null);

    try {
      const [openPrs, reviewPrs] = await Promise.all([
        window.githubg.listOpenPullRequests(),
        window.githubg.listReviewPullRequests(),
      ]);

      setOpenPullRequests(openPrs);
      setReviewPullRequests(reviewPrs);
      hasLoadedPullRequests.current = true;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load pull requests.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      refreshInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTimeMs(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    const loadSettings = async (): Promise<void> => {
      const settings = await window.githubg.getSettings();

      if (isCurrent) {
        setTheme(settings.theme);
        setPollIntervalMs(settings.pollIntervalMs);
      }
    };

    void loadSettings();

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    setNextRefreshAtMs(Date.now() + pollIntervalMs);
    void refreshPullRequests();

    const intervalId = window.setInterval(() => {
      setNextRefreshAtMs(Date.now() + pollIntervalMs);
      void refreshPullRequests();
    }, pollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [pollIntervalMs, refreshPullRequests]);

  useEffect(() => {
    if (!isTeamModalOpen) {
      return;
    }

    let isCurrent = true;

    const loadTeamData = async (): Promise<void> => {
      const [users, members] = await Promise.all([
        window.githubg.listKnownUsers(),
        window.githubg.listTeamMembers(),
      ]);

      if (isCurrent) {
        setKnownUsers(users);
        setTeamMembers(members);
        setSelectedLogin(users[0]?.login ?? '');
      }
    };

    void loadTeamData();

    return () => {
      isCurrent = false;
    };
  }, [isTeamModalOpen]);

  const handleAddTeamMember = async (): Promise<void> => {
    if (!selectedKnownUser) {
      return;
    }

    setTeamMembers(await window.githubg.addTeamMember(selectedKnownUser));
  };

  const handleRemoveTeamMember = async (login: string): Promise<void> => {
    setTeamMembers(await window.githubg.removeTeamMember(login));
  };

  const handleThemeChange = async (nextTheme: ThemeId): Promise<void> => {
    setTheme(nextTheme);
    const settings = await window.githubg.setTheme(nextTheme);
    setTheme(settings.theme);
  };

  const handleRefresh = (): void => {
    void refreshPullRequests();
  };

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
        <div className="footer-actions">
          <button
            type="button"
            className="icon-button"
            title="Team members"
            aria-label="Team members"
            onClick={() => setIsTeamModalOpen(true)}
          >
            <Plus size={18} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className="icon-button"
            title="Refresh pull requests"
            aria-label="Refresh pull requests"
            disabled={isRefreshing}
            onClick={handleRefresh}
          >
            <RefreshCw
              className={isRefreshing ? 'refresh-icon refresh-icon--spinning' : 'refresh-icon'}
              size={18}
              strokeWidth={2.2}
            />
          </button>
          <span className="refresh-countdown" aria-label="Seconds until next automatic refresh">
            {nextRefreshSeconds}
          </span>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Settings"
          aria-label="Settings"
          onClick={() => setIsSettingsModalOpen(true)}
        >
          <Settings size={18} strokeWidth={2.2} />
        </button>
      </footer>

      {isTeamModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="team-title">
            <header className="modal-header">
              <h2 id="team-title">Team members</h2>
              <button
                type="button"
                className="text-button"
                onClick={() => setIsTeamModalOpen(false)}
              >
                Close
              </button>
            </header>

            <div className="team-picker">
              <select
                value={selectedLogin}
                onChange={(event) => setSelectedLogin(event.target.value)}
              >
                {knownUsers.map((user) => (
                  <option key={user.login} value={user.login}>
                    {user.login}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="primary-button"
                disabled={!selectedKnownUser}
                onClick={handleAddTeamMember}
              >
                Add
              </button>
            </div>

            <div className="member-list">
              {teamMembers.map((member) => (
                <div className="member-row" key={member.login}>
                  <span>{member.login}</span>
                  <button type="button" onClick={() => void handleRemoveTeamMember(member.login)}>
                    Remove
                  </button>
                </div>
              ))}
              {teamMembers.length === 0 ? (
                <div className="empty-member-list">No members selected.</div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {isSettingsModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal modal--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <header className="modal-header">
              <h2 id="settings-title">Settings</h2>
              <button
                type="button"
                className="text-button"
                onClick={() => setIsSettingsModalOpen(false)}
              >
                Close
              </button>
            </header>

            <label className="settings-field">
              <span>Theme</span>
              <select
                value={theme}
                onChange={(event) => void handleThemeChange(event.target.value as ThemeId)}
              >
                {themeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll('-', ' ')}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </div>
      ) : null}
    </div>
  );
};
