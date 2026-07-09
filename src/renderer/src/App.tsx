import { Plus, RefreshCw, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  JiraAuthState,
  JiraCredentials,
  JiraPullRequestLink,
  JiraTicketSummary,
} from '../../shared/jira';
import type { PullRequestSummary } from '../../shared/pullRequest';
import type { TeamMember, ThemeId } from '../../shared/settings';
import { themeOptions } from '../../shared/settings';
import { JiraTicketCard } from './components/JiraTicketCard';
import { PullRequestCard } from './components/PullRequestCard';

type TabId = 'open-prs' | 'reviews' | 'jira';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'open-prs', label: 'Open PRs' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'jira', label: 'Jira' },
];

const atlassianApiTokenUrl = 'https://id.atlassian.com/manage-profile/security/api-tokens';

const emptyJiraCredentials: JiraCredentials = {
  siteUrl: '',
  email: '',
  apiToken: '',
};

const formatJiraAuthState = (authState: JiraAuthState | null): string => {
  if (!authState?.isAuthenticated) {
    return 'Not connected';
  }

  if (authState.email && authState.siteUrl) {
    return `Connected as ${authState.email} to ${authState.siteUrl}`;
  }

  return authState.siteUrl ? `Connected to ${authState.siteUrl}` : 'Connected';
};

const toJiraPullRequestLink = (pullRequest: PullRequestSummary): JiraPullRequestLink => ({
  id: pullRequest.id,
  title: pullRequest.title,
  number: pullRequest.number,
  repositoryNameWithOwner: pullRequest.repositoryNameWithOwner,
  url: pullRequest.url,
});

const pullRequestMatchesTicket = (pullRequest: PullRequestSummary, ticketKey: string): boolean => {
  const normalizedTicketKey = ticketKey.toLowerCase();

  return (
    pullRequest.ticketNumber?.toLowerCase() === normalizedTicketKey ||
    pullRequest.branchName.toLowerCase().includes(normalizedTicketKey) ||
    pullRequest.title.toLowerCase().includes(normalizedTicketKey)
  );
};

export const App = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<TabId>('open-prs');
  const [openPullRequests, setOpenPullRequests] = useState<PullRequestSummary[]>([]);
  const [reviewPullRequests, setReviewPullRequests] = useState<PullRequestSummary[]>([]);
  const [jiraTickets, setJiraTickets] = useState<JiraTicketSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isJiraLoading, setIsJiraLoading] = useState(false);
  const [isJiraRefreshing, setIsJiraRefreshing] = useState(false);
  const [jiraLoadError, setJiraLoadError] = useState<string | null>(null);
  const [jiraAuthState, setJiraAuthState] = useState<JiraAuthState | null>(null);
  const [jiraCredentials, setJiraCredentials] =
    useState<JiraCredentials>(emptyJiraCredentials);
  const [jiraTokenError, setJiraTokenError] = useState<string | null>(null);
  const [isJiraVerifying, setIsJiraVerifying] = useState(false);
  const [verifiedJiraCredentialsKey, setVerifiedJiraCredentialsKey] = useState<string | null>(null);
  const [highlightedPullRequestId, setHighlightedPullRequestId] = useState<string | null>(null);
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
  const hasLoadedJiraTickets = useRef(false);
  const hasLoadedJiraCredentials = useRef(false);
  const refreshInFlight = useRef(false);
  const jiraRefreshInFlight = useRef(false);
  const activePullRequests = activeTab === 'open-prs' ? openPullRequests : reviewPullRequests;
  const jiraCredentialsKey = [
    jiraCredentials.siteUrl.trim().replace(/\/+$/, ''),
    jiraCredentials.email.trim(),
    jiraCredentials.apiToken.trim(),
  ].join('|');
  const isJiraCredentialsComplete = Boolean(
    jiraCredentials.siteUrl.trim() &&
      jiraCredentials.email.trim() &&
      jiraCredentials.apiToken.trim(),
  );
  const isJiraConnected =
    Boolean(jiraAuthState?.isAuthenticated) && verifiedJiraCredentialsKey === jiraCredentialsKey;
  const linkedPullRequests = [...openPullRequests, ...reviewPullRequests].filter(
    (pullRequest, index, pullRequests) =>
      pullRequest.state === 'OPEN' &&
      pullRequest.ticketNumber !== null &&
      pullRequests.findIndex((candidate) => candidate.id === pullRequest.id) === index,
  );
  const jiraTicketsWithPullRequests = jiraTickets.map((ticket) => ({
    ...ticket,
    openPullRequests: linkedPullRequests
      .filter((pullRequest) => pullRequestMatchesTicket(pullRequest, ticket.key))
      .map(toJiraPullRequestLink),
  }));
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

  const refreshJiraTickets = useCallback(async (): Promise<void> => {
    if (jiraRefreshInFlight.current) {
      return;
    }

    jiraRefreshInFlight.current = true;
    setIsJiraRefreshing(true);

    if (!hasLoadedJiraTickets.current) {
      setIsJiraLoading(true);
    }

    setJiraLoadError(null);

    try {
      const [authState, tickets] = await Promise.all([
        window.githubg.getJiraAuthState(),
        window.githubg.listJiraTickets(),
      ]);

      setJiraAuthState(authState);
      setJiraTickets(tickets);
      hasLoadedJiraTickets.current = true;
    } catch (error) {
      setJiraLoadError(error instanceof Error ? error.message : 'Unable to load Jira tickets.');
    } finally {
      setIsJiraLoading(false);
      setIsJiraRefreshing(false);
      jiraRefreshInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTimeMs(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    const loadSettings = async (): Promise<void> => {
      const [settings, authState, credentials] = await Promise.all([
        window.githubg.getSettings(),
        window.githubg.getJiraAuthState(),
        window.githubg.getJiraCredentials(),
      ]);

      if (isCurrent) {
        setTheme(settings.theme);
        setPollIntervalMs(settings.pollIntervalMs);
        setJiraCredentials(credentials);
        setJiraAuthState(authState);
        setVerifiedJiraCredentialsKey(
          authState.isAuthenticated
            ? [
                credentials.siteUrl.trim().replace(/\/+$/, ''),
                credentials.email.trim(),
                credentials.apiToken.trim(),
              ].join('|')
            : null,
        );
        hasLoadedJiraCredentials.current = true;
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
    if (activeTab === 'jira' && isJiraConnected && !hasLoadedJiraTickets.current) {
      void refreshJiraTickets();
    }
  }, [activeTab, isJiraConnected, refreshJiraTickets]);

  useEffect(() => {
    if (!hasLoadedJiraCredentials.current) {
      return;
    }

    if (!isJiraCredentialsComplete) {
      setJiraTokenError(null);
      setVerifiedJiraCredentialsKey(null);
      setJiraTickets([]);
      hasLoadedJiraTickets.current = false;
      return;
    }

    if (verifiedJiraCredentialsKey === jiraCredentialsKey) {
      return;
    }

    let isCurrent = true;
    const timeoutId = window.setTimeout(() => {
      const verifyCredentials = async (): Promise<void> => {
        setIsJiraVerifying(true);
        setJiraTokenError(null);

        try {
          const authState = await window.githubg.saveJiraCredentials(jiraCredentials);

          if (!isCurrent) {
            return;
          }

          setJiraAuthState(authState);
          setVerifiedJiraCredentialsKey(jiraCredentialsKey);
          hasLoadedJiraTickets.current = false;

          if (activeTab === 'jira') {
            await refreshJiraTickets();
          }
        } catch (error) {
          if (isCurrent) {
            setJiraTokenError(
              error instanceof Error ? error.message : 'Unable to verify Jira access.',
            );
            setVerifiedJiraCredentialsKey(null);
            setJiraTickets([]);
            hasLoadedJiraTickets.current = false;
          }
        } finally {
          if (isCurrent) {
            setIsJiraVerifying(false);
          }
        }
      };

      void verifyCredentials();
    }, 700);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    isJiraCredentialsComplete,
    jiraCredentials,
    jiraCredentialsKey,
    refreshJiraTickets,
    verifiedJiraCredentialsKey,
  ]);

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

  const handleJiraCredentialChange = (field: keyof JiraCredentials, value: string): void => {
    setJiraCredentials((credentials) => ({ ...credentials, [field]: value }));
  };

  const handleDisconnectJira = async (): Promise<void> => {
    setJiraAuthState(await window.githubg.disconnectJira());
    setJiraCredentials(emptyJiraCredentials);
    setVerifiedJiraCredentialsKey(null);
    setJiraTokenError(null);
    setJiraTickets([]);
    hasLoadedJiraTickets.current = false;
  };

  const handleOpenJiraPullRequest = (pullRequest: JiraPullRequestLink): void => {
    setActiveTab('open-prs');
    setHighlightedPullRequestId(pullRequest.id);
    window.setTimeout(() => setHighlightedPullRequestId(null), 2400);
  };

  const handleRefresh = (): void => {
    if (activeTab === 'jira') {
      void refreshJiraTickets();
    } else {
      void refreshPullRequests();
    }
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <img src="/icon-white.png" alt="" className="brand-icon" />
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
          aria-labelledby={
            activeTab === 'open-prs'
              ? 'open-prs-heading'
              : activeTab === 'reviews'
                ? 'reviews-heading'
                : 'jira-heading'
          }
        >
          {activeTab === 'jira' ? (
            <>
              <div className="panel-header">
                <div>
                  <h2 id="jira-heading">Jira</h2>
                  <p className="panel-subtitle">{formatJiraAuthState(jiraAuthState)}</p>
                </div>
                <span className="count-pill">{jiraTicketsWithPullRequests.length}</span>
              </div>

              {!isJiraConnected ? (
                <div className="jira-auth-panel">
                  <div className="jira-auth-heading">
                    <div>
                      <h3>Jira access</h3>
                      <p>
                        <a href={atlassianApiTokenUrl} target="_blank" rel="noreferrer">
                          Create an Atlassian token, then paste it here.
                        </a>
                      </p>
                      <div className="jira-scope-note">
                        <span>Required scopes: use classic scopes only.</span>
                        <ul>
                          <li>
                            <code>read:jira-work</code>
                          </li>
                          <li>
                            <code>read:jira-user</code>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="jira-auth-grid">
                    <label className="settings-field">
                      <span>Jira URL</span>
                      <input
                        type="url"
                        value={jiraCredentials.siteUrl}
                        placeholder="https://[your company].jira.com"
                        onChange={(event) =>
                          handleJiraCredentialChange('siteUrl', event.target.value)
                        }
                      />
                    </label>
                    <label className="settings-field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={jiraCredentials.email}
                        onChange={(event) =>
                          handleJiraCredentialChange('email', event.target.value)
                        }
                      />
                    </label>
                    <label className="settings-field jira-token-field">
                      <span>API token</span>
                      <span className="jira-token-input">
                        <input
                          type="password"
                          value={jiraCredentials.apiToken}
                          onChange={(event) =>
                            handleJiraCredentialChange('apiToken', event.target.value)
                          }
                        />
                        {isJiraVerifying ? (
                          <RefreshCw
                            className="refresh-icon refresh-icon--spinning"
                            size={16}
                            strokeWidth={2.2}
                          />
                        ) : null}
                      </span>
                      {jiraTokenError ? <span className="field-error">{jiraTokenError}</span> : null}
                    </label>
                  </div>
                </div>
              ) : null}

              {!isJiraCredentialsComplete ? (
                <div className="empty-list empty-list--setup">
                  <div className="setup-state">
                    <strong>Jira is not connected.</strong>
                    <span>Enter your Jira URL, email, and API token to verify access.</span>
                  </div>
                </div>
              ) : !isJiraConnected ? (
                <div className="empty-list empty-list--setup">
                  <div className="setup-state">
                    <strong>{isJiraVerifying ? 'Verifying Jira access.' : 'Jira is not connected.'}</strong>
                    <span>
                      {jiraTokenError
                        ? 'Fix the token or account details above.'
                        : 'Tickets will load after the token is verified.'}
                    </span>
                  </div>
                </div>
              ) : jiraLoadError ? (
                <div className="empty-list empty-list--error">{jiraLoadError}</div>
              ) : isJiraLoading ? (
                <div className="empty-list">Loading Jira tickets.</div>
              ) : jiraTicketsWithPullRequests.length > 0 ? (
                <div className="jira-list">
                  {jiraTicketsWithPullRequests.map((ticket) => (
                    <JiraTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onOpenPullRequest={handleOpenJiraPullRequest}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-list">No current-sprint Jira tickets loaded.</div>
              )}
            </>
          ) : (
            <>
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
                    <PullRequestCard
                      key={pullRequest.id}
                      highlighted={highlightedPullRequestId === pullRequest.id}
                      onPullRequestChanged={refreshPullRequests}
                      pullRequest={pullRequest}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-list">
                  {activeTab === 'open-prs' ? 'No open PRs loaded.' : 'No team PRs loaded.'}
                </div>
              )}
            </>
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
            disabled={activeTab === 'jira' ? isJiraRefreshing || !isJiraConnected : isRefreshing}
            aria-busy={activeTab === 'jira' ? isJiraRefreshing : isRefreshing}
            onClick={handleRefresh}
          >
            <RefreshCw
              className={
                (activeTab === 'jira' ? isJiraRefreshing : isRefreshing)
                  ? 'refresh-icon refresh-icon--spinning'
                  : 'refresh-icon'
              }
              size={18}
              strokeWidth={2.2}
            />
          </button>
          <span className="refresh-countdown" aria-label="Seconds until next automatic refresh">
            {nextRefreshSeconds}
          </span>
        </div>
        <div className="footer-secondary-actions">
          <button
            type="button"
            className="icon-button"
            title="Settings"
            aria-label="Settings"
            onClick={() => setIsSettingsModalOpen(true)}
          >
            <Settings size={18} strokeWidth={2.2} />
          </button>
          {jiraAuthState?.isAuthenticated ? (
            <button
              type="button"
              className="icon-button jira-disconnect-button"
              title="Disconnect Jira"
              aria-label="Disconnect Jira"
              onClick={() => void handleDisconnectJira()}
            >
              <span className="jira-disconnect-text">Jira</span>
            </button>
          ) : null}
        </div>
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
