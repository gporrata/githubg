import { contextBridge, ipcRenderer } from 'electron';
import type { PullRequestSummary } from '../shared/pullRequest';
import type { MergeMethod } from '../shared/settings';

contextBridge.exposeInMainWorld('githubg', {
  appName: 'githubg',
  listOpenPullRequests: (): Promise<PullRequestSummary[]> =>
    ipcRenderer.invoke('pull-requests:list-open'),
  listReviewPullRequests: (): Promise<PullRequestSummary[]> =>
    ipcRenderer.invoke('pull-requests:list-reviews'),
  getMergeMethod: (pullRequestId: string): Promise<MergeMethod> =>
    ipcRenderer.invoke('merge-method:get', pullRequestId),
  setMergeMethod: (pullRequestId: string, mergeMethod: MergeMethod): Promise<MergeMethod> =>
    ipcRenderer.invoke('merge-method:set', pullRequestId, mergeMethod),
  mergePullRequest: (pullRequestId: string, mergeMethod: MergeMethod): Promise<void> =>
    ipcRenderer.invoke('pull-request:merge', pullRequestId, mergeMethod),
});
