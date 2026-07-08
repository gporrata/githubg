export type PullRequestReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;

export type PullRequestCheckState = 'EXPECTED' | 'ERROR' | 'FAILURE' | 'PENDING' | 'SUCCESS' | null;

export type PullRequestCommentThread = {
  id: string;
  path: string;
  line: number | null;
  isResolved: boolean;
  isOutdated: boolean;
  comments: Array<{
    id: string;
    url: string;
    bodyText: string;
    createdAt: string;
    authorLogin: string | null;
  }>;
};

export type PullRequestSummary = {
  id: string;
  databaseId: number | null;
  repositoryId: string;
  repositoryName: string;
  repositoryNameWithOwner: string;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  authorLogin: string | null;
  branchName: string;
  headSha: string | null;
  ticketNumber: string | null;
  commentCount: number;
  reviewDecision: PullRequestReviewDecision;
  approved: boolean;
  mergeable: boolean;
  mergeInProgress: boolean;
  checksState: PullRequestCheckState;
  requiredStatusChecksPassed: boolean;
  isDraft: boolean;
  commentThreads: PullRequestCommentThread[];
};
