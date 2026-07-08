import { ipcMain } from 'electron';
import type { MergeMethod, TeamMember } from '../shared/settings';
import { mergeMethods } from '../shared/settings';
import { fetchKnownUsers } from './github/knownUsers';
import { mergePullRequest } from './github/mergePullRequest';
import {
  fetchOpenPullRequestsForTeamMembers,
  fetchOpenPullRequestsForViewer,
} from './github/pullRequests';
import { getAppStore } from './store';

const isMergeMethod = (value: unknown): value is MergeMethod =>
  typeof value === 'string' && mergeMethods.includes(value as MergeMethod);

export const registerIpcHandlers = (): void => {
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

  ipcMain.handle('pull-requests:list-open', () => fetchOpenPullRequestsForViewer());
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
};
