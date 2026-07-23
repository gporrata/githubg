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
  hasPendingReviewRequest: boolean;
  reviewThreadCount: number;
  commentThreads: PullRequestCommentThread[];
};

export const hasCommentedPendingReview = (pullRequest: PullRequestSummary): boolean =>
  pullRequest.commentCount > 0 &&
  (pullRequest.reviewDecision === 'REVIEW_REQUIRED' || pullRequest.reviewDecision === null);

export const hasUnaddressedRequestedChanges = (pullRequest: PullRequestSummary): boolean => {
  if (pullRequest.reviewDecision !== 'CHANGES_REQUESTED') {
    return false;
  }

  const activeThreads = pullRequest.commentThreads.filter(
    (thread) => !thread.isResolved && !thread.isOutdated,
  );

  return (
    activeThreads.length > 0 ||
    pullRequest.commentThreads.length === 0 ||
    pullRequest.commentThreads.length < pullRequest.reviewThreadCount
  );
};

export const hasAddressedRequestedChanges = (pullRequest: PullRequestSummary): boolean =>
  pullRequest.reviewDecision === 'CHANGES_REQUESTED' &&
  !hasUnaddressedRequestedChanges(pullRequest) &&
  pullRequest.hasPendingReviewRequest;

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
