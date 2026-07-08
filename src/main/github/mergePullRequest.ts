import type { MergeMethod } from '../../shared/settings';
import { githubGraphql } from './graphqlClient';
import {
  MERGE_PULL_REQUEST_MUTATION,
  type MergePullRequestResponse,
} from './pullRequestQueries';

export const mergePullRequest = async (
  pullRequestId: string,
  mergeMethod: MergeMethod,
): Promise<void> => {
  await githubGraphql<MergePullRequestResponse>(MERGE_PULL_REQUEST_MUTATION, {
    pullRequestId,
    mergeMethod,
  });
};
