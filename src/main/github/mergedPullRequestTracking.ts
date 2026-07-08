import { getAppStore } from '../store';
import { areWorkflowRunsCompleteForCommit } from './workflowRuns';

const visibilityCapMs = 24 * 60 * 60 * 1000;

const isPastVisibilityCap = (mergedAt: string): boolean =>
  Date.now() - new Date(mergedAt).getTime() > visibilityCapMs;

export const getVisibleTrackedMergedPullRequestIds = async (): Promise<string[]> => {
  const store = getAppStore();
  const tracked = store.get('mergedPullRequests', {});
  const visibleIds: string[] = [];

  for (const [pullRequestId, tracking] of Object.entries(tracked)) {
    if (tracking.workflowCompletedAt || isPastVisibilityCap(tracking.mergedAt)) {
      continue;
    }

    const workflowsComplete = await areWorkflowRunsCompleteForCommit(
      tracking.repositoryNameWithOwner,
      tracking.mergeCommitOid,
    );

    if (workflowsComplete) {
      store.set(`mergedPullRequests.${pullRequestId}.workflowCompletedAt`, new Date().toISOString());
      continue;
    }

    visibleIds.push(pullRequestId);
  }

  return visibleIds;
};
