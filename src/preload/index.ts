import { contextBridge, ipcRenderer } from 'electron';
import type { PullRequestSummary } from '../shared/pullRequest';
import type { MergeMethod, TeamMember } from '../shared/settings';

contextBridge.exposeInMainWorld('githubg', {
  appName: 'githubg',
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
});
