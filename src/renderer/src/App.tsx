import { Plus, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [knownUsers, setKnownUsers] = useState<TeamMember[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedLogin, setSelectedLogin] = useState('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('system');
  const activePullRequests = activeTab === 'open-prs' ? openPullRequests : reviewPullRequests;
  const selectedKnownUser = knownUsers.find((user) => user.login === selectedLogin);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let isCurrent = true;

    const loadPullRequests = async (): Promise<void> => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [settings, openPrs, reviewPrs] = await Promise.all([
          window.githubg.getSettings(),
          window.githubg.listOpenPullRequests(),
          window.githubg.listReviewPullRequests(),
        ]);

        if (isCurrent) {
          setTheme(settings.theme);
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
              <button type="button" className="text-button" onClick={() => setIsTeamModalOpen(false)}>
                Close
              </button>
            </header>

            <div className="team-picker">
              <select value={selectedLogin} onChange={(event) => setSelectedLogin(event.target.value)}>
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
              {teamMembers.length === 0 ? <div className="empty-member-list">No members selected.</div> : null}
            </div>
          </section>
        </div>
      ) : null}

      {isSettingsModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal modal--compact" role="dialog" aria-modal="true" aria-labelledby="settings-title">
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
