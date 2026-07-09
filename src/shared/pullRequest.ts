export type PullRequestReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;

export type PullRequestCheckState = 'EXPECTED' | 'ERROR' | 'FAILURE' | 'PENDING' | 'SUCCESS' | null;

export type PullRequestMergeStateStatus =
  | 'BEHIND'
  | 'BLOCKED'
  | 'CLEAN'
  | 'DIRTY'
  | 'DRAFT'
  | 'HAS_HOOKS'
  | 'UNKNOWN'
  | 'UNSTABLE';

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

export type PullRequestReviewer = {
  id: string;
  login: string;
};

export type PullRequestActionRun = {
  id: number;
  name: string;
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
  mergeStateStatus: PullRequestMergeStateStatus;
  hasConflicts: boolean;
  canBeMerged: boolean;
  mergeInProgress: boolean;
  hasActiveActions: boolean;
  checksState: PullRequestCheckState;
  requiredStatusChecksPassed: boolean;
  isDraft: boolean;
  actionWorkflowRuns: PullRequestActionRun[];
  requestedChangeReviewers: PullRequestReviewer[];
  commentThreads: PullRequestCommentThread[];
};

export type PullRequestRerunMode = 'failed' | 'all';

export type ApprovedPullRequestBlockedReason =
  | 'conflicts'
  | 'failed-checks'
  | 'out-of-date'
  | 'actions-pending';

export const hasPullRequestConflicts = (pullRequest: PullRequestSummary): boolean =>
  pullRequest.state === 'OPEN' && pullRequest.hasConflicts;

export const getApprovedPullRequestBlockedReason = (
  pullRequest: PullRequestSummary,
): ApprovedPullRequestBlockedReason | null => {
  if (pullRequest.state !== 'OPEN' || !pullRequest.approved) {
    return null;
  }

  if (pullRequest.hasConflicts) {
    return 'conflicts';
  }

  if (pullRequest.checksState === 'ERROR' || pullRequest.checksState === 'FAILURE') {
    return 'failed-checks';
  }

  if (pullRequest.mergeStateStatus === 'BEHIND') {
    return 'out-of-date';
  }

  if (pullRequest.checksState === 'EXPECTED' || pullRequest.checksState === 'PENDING') {
    return 'actions-pending';
  }

  return null;
};
