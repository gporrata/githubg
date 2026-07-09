import { ipcMain } from 'electron';
import type { JiraAuthState, JiraCredentials, JiraTicketSummary } from '../shared/jira';
import type { GithubgSettings, MergeMethod, TeamMember, ThemeId } from '../shared/settings';
import { mergeMethods, themeOptions } from '../shared/settings';
import { setOpenPullRequestBadge } from './badge';
import { fetchKnownUsers } from './github/knownUsers';
import { mergePullRequest } from './github/mergePullRequest';
import {
  fetchOpenPullRequestsForTeamMembers,
  fetchOpenPullRequestsForViewer,
  requestPullRequestReview,
} from './github/pullRequests';
import {
  disconnectJira,
  fetchJiraTickets,
  getJiraAuthState,
  getJiraCredentials,
  saveJiraCredentials,
} from './jira';
import { getAppStore } from './store';

const isMergeMethod = (value: unknown): value is MergeMethod =>
  typeof value === 'string' && mergeMethods.includes(value as MergeMethod);

const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && themeOptions.includes(value as ThemeId);

export const registerIpcHandlers = (): void => {
  ipcMain.handle('settings:get', (): GithubgSettings => {
    return getAppStore().get('settings');
  });

  ipcMain.handle('settings:set-theme', (_event, theme: ThemeId): GithubgSettings => {
    if (!isThemeId(theme)) {
      throw new Error(`Invalid theme: ${String(theme)}`);
    }

    const store = getAppStore();
    const settings = { ...store.get('settings'), theme };
    store.set('settings', settings);
    return settings;
  });

  ipcMain.handle('jira:auth-state', (): JiraAuthState => getJiraAuthState());

  ipcMain.handle('jira:credentials:get', (): JiraCredentials => getJiraCredentials());

  ipcMain.handle(
    'jira:credentials:save',
    (_event, credentials: JiraCredentials): Promise<JiraAuthState> =>
      saveJiraCredentials(credentials),
  );

  ipcMain.handle('jira:disconnect', (): JiraAuthState => disconnectJira());

  ipcMain.handle('jira:tickets:list', (): Promise<JiraTicketSummary[]> => fetchJiraTickets());

  ipcMain.handle('known-users:list', () => fetchKnownUsers());

  ipcMain.handle('team-members:list', (): TeamMember[] => {
    return getAppStore().get('teamMembers', []);
  });

  ipcMain.handle('team-members:add', (_event, member: TeamMember): TeamMember[] => {
    const store = getAppStore();
    const teamMembers = store.get('teamMembers', []);

    if (!teamMembers.some((teamMember) => teamMember.login === member.login)) {
      store.set(
        'teamMembers',
        [...teamMembers, member].sort((left, right) => left.login.localeCompare(right.login)),
      );
    }

    return store.get('teamMembers', []);
  });

  ipcMain.handle('team-members:remove', (_event, login: string): TeamMember[] => {
    const store = getAppStore();
    const teamMembers = store.get('teamMembers', []);
    store.set(
      'teamMembers',
      teamMembers.filter((member) => member.login !== login),
    );
    return store.get('teamMembers', []);
  });

  ipcMain.handle('pull-requests:list-open', async () => {
    const pullRequests = await fetchOpenPullRequestsForViewer();
    setOpenPullRequestBadge(pullRequests);
    return pullRequests;
  });
  ipcMain.handle('pull-requests:list-reviews', () => fetchOpenPullRequestsForTeamMembers());

  ipcMain.handle('merge-method:get', (_event, pullRequestId: string): MergeMethod => {
    return getAppStore().get(`mergeMethods.${pullRequestId}`, 'SQUASH');
  });

  ipcMain.handle(
    'merge-method:set',
    (_event, pullRequestId: string, mergeMethod: MergeMethod): MergeMethod => {
      if (!isMergeMethod(mergeMethod)) {
        throw new Error(`Invalid merge method: ${String(mergeMethod)}`);
      }

      getAppStore().set(`mergeMethods.${pullRequestId}`, mergeMethod);
      return mergeMethod;
    },
  );

  ipcMain.handle(
    'pull-request:merge',
    async (_event, pullRequestId: string, mergeMethod: MergeMethod): Promise<void> => {
      if (!isMergeMethod(mergeMethod)) {
        throw new Error(`Invalid merge method: ${String(mergeMethod)}`);
      }

      await mergePullRequest(pullRequestId, mergeMethod);
    },
  );

  ipcMain.handle(
    'pull-request:request-review',
    async (_event, pullRequestId: string, userIds: string[]): Promise<void> => {
      await requestPullRequestReview(pullRequestId, userIds);
    },
  );
};
