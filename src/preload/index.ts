import { contextBridge, ipcRenderer } from 'electron';
import type { JiraAuthState, JiraCredentials, JiraTicketSummary } from '../shared/jira';
import type { PullRequestRerunMode, PullRequestSummary } from '../shared/pullRequest';
import type { GithubgSettings, MergeMethod, TeamMember, ThemeId } from '../shared/settings';

contextBridge.exposeInMainWorld('githubg', {
  appName: 'githubg',
  getSettings: (): Promise<GithubgSettings> => ipcRenderer.invoke('settings:get'),
  setTheme: (theme: ThemeId): Promise<GithubgSettings> =>
    ipcRenderer.invoke('settings:set-theme', theme),
  getJiraAuthState: (): Promise<JiraAuthState> => ipcRenderer.invoke('jira:auth-state'),
  getJiraCredentials: (): Promise<JiraCredentials> => ipcRenderer.invoke('jira:credentials:get'),
  saveJiraCredentials: (credentials: JiraCredentials): Promise<JiraAuthState> =>
    ipcRenderer.invoke('jira:credentials:save', credentials),
  disconnectJira: (): Promise<JiraAuthState> => ipcRenderer.invoke('jira:disconnect'),
  listJiraTickets: (): Promise<JiraTicketSummary[]> => ipcRenderer.invoke('jira:tickets:list'),
  listOpenPullRequests: (): Promise<PullRequestSummary[]> =>
    ipcRenderer.invoke('pull-requests:list-open'),
  listReviewPullRequests: (): Promise<PullRequestSummary[]> =>
    ipcRenderer.invoke('pull-requests:list-reviews'),
  listKnownUsers: (): Promise<TeamMember[]> => ipcRenderer.invoke('known-users:list'),
  listTeamMembers: (): Promise<TeamMember[]> => ipcRenderer.invoke('team-members:list'),
  addTeamMember: (member: TeamMember): Promise<TeamMember[]> =>
    ipcRenderer.invoke('team-members:add', member),
  removeTeamMember: (login: string): Promise<TeamMember[]> =>
    ipcRenderer.invoke('team-members:remove', login),
  getMergeMethod: (pullRequestId: string): Promise<MergeMethod> =>
    ipcRenderer.invoke('merge-method:get', pullRequestId),
  setMergeMethod: (pullRequestId: string, mergeMethod: MergeMethod): Promise<MergeMethod> =>
    ipcRenderer.invoke('merge-method:set', pullRequestId, mergeMethod),
  mergePullRequest: (pullRequestId: string, mergeMethod: MergeMethod): Promise<void> =>
    ipcRenderer.invoke('pull-request:merge', pullRequestId, mergeMethod),
  requestPullRequestReview: (pullRequestId: string, userIds: string[]): Promise<void> =>
    ipcRenderer.invoke('pull-request:request-review', pullRequestId, userIds),
  updatePullRequestBranch: (pullRequestId: string): Promise<void> =>
    ipcRenderer.invoke('pull-request:update-branch', pullRequestId),
  rerunPullRequestWorkflowRuns: (
    repositoryNameWithOwner: string,
    runIds: number[],
    mode: PullRequestRerunMode,
  ): Promise<void> =>
    ipcRenderer.invoke(
      'pull-request:rerun-workflow-runs',
      repositoryNameWithOwner,
      runIds,
      mode,
    ),
});
