import type { MergeMethod } from '../../shared/settings';
import type { PullRequestSummary } from '../../shared/pullRequest';

declare global {
  interface Window {
    githubg: {
      appName: string;
      listOpenPullRequests: () => Promise<PullRequestSummary[]>;
      listReviewPullRequests: () => Promise<PullRequestSummary[]>;
      getMergeMethod: (pullRequestId: string) => Promise<MergeMethod>;
      setMergeMethod: (pullRequestId: string, mergeMethod: MergeMethod) => Promise<MergeMethod>;
      mergePullRequest: (pullRequestId: string, mergeMethod: MergeMethod) => Promise<void>;
    };
  }
}
