import type { MergeMethod } from '../../shared/settings';
import { githubGraphql } from './graphqlClient';
import {
  MERGE_PULL_REQUEST_MUTATION,
  type MergePullRequestResponse,
} from './pullRequestQueries';
import { getAppStore } from '../store';

export const mergePullRequest = async (
  pullRequestId: string,
  mergeMethod: MergeMethod,
): Promise<void> => {
  const response = await githubGraphql<MergePullRequestResponse>(MERGE_PULL_REQUEST_MUTATION, {
    pullRequestId,
    mergeMethod,
  });

  const pullRequest = response.mergePullRequest?.pullRequest;

  if (pullRequest?.mergedAt && pullRequest.mergeCommit?.oid) {
    getAppStore().set(`mergedPullRequests.${pullRequestId}`, {
      mergedAt: pullRequest.mergedAt,
      repositoryNameWithOwner: pullRequest.repository.nameWithOwner,
      mergeCommitOid: pullRequest.mergeCommit.oid,
    });
  }
};
