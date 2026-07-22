import { ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getApprovedPullRequestBlockedReason,
  hasAddressedRequestedChanges,
  hasPullRequestConflicts,
  hasUnaddressedRequestedChanges,
  type PullRequestRerunMode,
  type PullRequestSummary,
} from '../../../shared/pullRequest';
import type { MergeMethod } from '../../../shared/settings';
import {
  MultiStateActionButton,
  type MultiStateActionButtonOption,
} from './MultiStateActionButton';

type PullRequestCardProps = {
  draftBorder?: boolean;
  highlighted?: boolean;
  onPullRequestChanged?: () => Promise<void>;
  pullRequest: PullRequestSummary;
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));

const getCardTone = (pullRequest: PullRequestSummary): string => {
  if (pullRequest.state === 'MERGED') {
    return 'merged';
  }

  if (hasPullRequestConflicts(pullRequest)) {
    return 'conflicts';
  }

  const approvedBlockedReason = getApprovedPullRequestBlockedReason(pullRequest);

  if (approvedBlockedReason === 'failed-checks' || approvedBlockedReason === 'out-of-date') {
    return 'blocked';
  }

  if (hasUnaddressedRequestedChanges(pullRequest)) {
    return 'changes-requested';
  }

  if (pullRequest.canBeMerged) {
    return 'mergeable';
  }

  return 'quiet';
};

const getReviewLabel = (pullRequest: PullRequestSummary): string => {
  if (pullRequest.approved) {
    return 'Approved';
  }

  if (hasAddressedRequestedChanges(pullRequest)) {
    return 'Changes addressed / Review Pending';
  }

  if (pullRequest.reviewDecision === 'CHANGES_REQUESTED') {
    return 'Changes requested';
  }

  return 'Review pending';
};

const getMergeLabel = (pullRequest: PullRequestSummary): string => {
  if (pullRequest.mergeInProgress) {
    return 'Merging';
  }

  if (pullRequest.state === 'MERGED') {
    return pullRequest.hasActiveActions ? 'Actions running' : 'Merged';
  }

  if (hasPullRequestConflicts(pullRequest)) {
    return 'Conflicts';
  }

  const approvedBlockedReason = getApprovedPullRequestBlockedReason(pullRequest);

  if (approvedBlockedReason === 'failed-checks') {
    return 'Failed Checks';
  }

  if (approvedBlockedReason === 'out-of-date') {
    return 'Out of Date';
  }

  if (approvedBlockedReason === 'actions-pending') {
    return 'Actions Pending';
  }

  if (!pullRequest.canBeMerged) {
    return 'Blocked';
  }

  return 'Ready';
};

const mergeMethodOptions = [
  {
    value: 'SQUASH',
    label: 'Squash and merge',
    actionLabel: 'Squash and merge',
    description: 'The commits from this branch will be combined into one commit in the base branch.',
    color: 'var(--accent)',
  },
  {
    value: 'MERGE',
    label: 'Create a merge commit',
    actionLabel: 'Create a merge commit',
    description: 'All commits from this branch will be added to the base branch via a merge commit.',
    color: '#2f6fed',
  },
  {
    value: 'REBASE',
    label: 'Rebase and merge',
    actionLabel: 'Rebase and merge',
    description: 'The commits from this branch will be rebased and added to the base branch.',
    color: '#b45309',
  },
] satisfies readonly MultiStateActionButtonOption<MergeMethod>[];

const rerunModeOptions = [
  {
    value: 'failed',
    label: 'Rerun failed jobs',
    actionLabel: 'Rerun failed jobs',
    description: 'Runs only the jobs that failed or were canceled in the workflow run.',
    color: 'var(--danger)',
  },
  {
    value: 'all',
    label: 'Rerun all jobs',
    actionLabel: 'Rerun all jobs',
    description: 'Runs every job in the workflow run again, including jobs that already passed.',
    color: '#2f6fed',
  },
] satisfies readonly MultiStateActionButtonOption<PullRequestRerunMode>[];

export const PullRequestCard = ({
  draftBorder = false,
  highlighted = false,
  onPullRequestChanged,
  pullRequest,
}: PullRequestCardProps): JSX.Element => {
  const cardRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>('SQUASH');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [reviewRequestError, setReviewRequestError] = useState<string | null>(null);
  const [isRequestingReview, setIsRequestingReview] = useState(false);
  const [updateBranchError, setUpdateBranchError] = useState<string | null>(null);
  const [isUpdatingBranch, setIsUpdatingBranch] = useState(false);
  const [rerunMode, setRerunMode] = useState<PullRequestRerunMode>('failed');
  const [rerunError, setRerunError] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);
  const [hasLocalMergedActiveActions, setHasLocalMergedActiveActions] = useState(false);
  const tone = getCardTone(pullRequest);
  const approvedBlockedReason = getApprovedPullRequestBlockedReason(pullRequest);
  const reviewLabel = getReviewLabel(pullRequest);
  const createdAt = useMemo(() => formatDate(pullRequest.createdAt), [pullRequest.createdAt]);
  const mergeLabel = hasLocalMergedActiveActions ? 'Actions running' : getMergeLabel(pullRequest);
  const canMerge = pullRequest.canBeMerged && !isMerging && !hasLocalMergedActiveActions;
  const showMergeControls = pullRequest.canBeMerged || hasLocalMergedActiveActions || isMerging;
  const requestedChangeReviewers = pullRequest.requestedChangeReviewers;
  const canRequestReview = requestedChangeReviewers.length > 0 && !isRequestingReview;
  const canUpdateBranch = approvedBlockedReason === 'out-of-date' && !isUpdatingBranch;
  const canRerunChecks =
    approvedBlockedReason === 'failed-checks' &&
    pullRequest.actionWorkflowRuns.length > 0 &&
    !isRerunning;
  const hasRunningAction =
    isMerging ||
    isUpdatingBranch ||
    isRerunning ||
    hasLocalMergedActiveActions ||
    pullRequest.mergeInProgress ||
    (pullRequest.state === 'MERGED' && pullRequest.hasActiveActions);

  useEffect(() => {
    let isCurrent = true;

    void window.githubg.getMergeMethod(pullRequest.id).then((storedMethod) => {
      if (isCurrent) {
        setMergeMethod(storedMethod);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [pullRequest.id]);

  useEffect(() => {
    if (pullRequest.state === 'MERGED' && !pullRequest.hasActiveActions) {
      setHasLocalMergedActiveActions(false);
    }
  }, [pullRequest.hasActiveActions, pullRequest.state]);

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [highlighted]);

  const handleMergeMethodChange = (value: MergeMethod): void => {
    setMergeMethod(value);
    void window.githubg.setMergeMethod(pullRequest.id, value);
  };

  const handleMerge = async (): Promise<void> => {
    setIsMerging(true);
    setMergeError(null);

    try {
      await window.githubg.mergePullRequest(pullRequest.id, mergeMethod);
      setHasLocalMergedActiveActions(true);
      await onPullRequestChanged?.();
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Merge failed.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleRequestReview = async (): Promise<void> => {
    setIsRequestingReview(true);
    setReviewRequestError(null);

    try {
      await window.githubg.requestPullRequestReview(
        pullRequest.id,
        requestedChangeReviewers.map((reviewer) => reviewer.id),
      );
      await onPullRequestChanged?.();
    } catch (error) {
      setReviewRequestError(error instanceof Error ? error.message : 'Review request failed.');
    } finally {
      setIsRequestingReview(false);
    }
  };

  const handleUpdateBranch = async (): Promise<void> => {
    setIsUpdatingBranch(true);
    setUpdateBranchError(null);

    try {
      await window.githubg.updatePullRequestBranch(pullRequest.id);
      await onPullRequestChanged?.();
    } catch (error) {
      setUpdateBranchError(error instanceof Error ? error.message : 'Update branch failed.');
    } finally {
      setIsUpdatingBranch(false);
    }
  };

  const handleRerunChecks = async (): Promise<void> => {
    setIsRerunning(true);
    setRerunError(null);

    try {
      await window.githubg.rerunPullRequestWorkflowRuns(
        pullRequest.repositoryNameWithOwner,
        pullRequest.actionWorkflowRuns.map((run) => run.id),
        rerunMode,
      );
      await onPullRequestChanged?.();
    } catch (error) {
      setRerunError(error instanceof Error ? error.message : 'Rerun failed.');
    } finally {
      setIsRerunning(false);
    }
  };

  return (
    <article
      ref={cardRef}
      className={`pr-card pr-card--${tone}${draftBorder ? ' pr-card--draft' : ''}${
        hasRunningAction ? ' pr-card--action-running' : ''
      }${highlighted ? ' pr-card--highlighted' : ''}`}
    >
      <header className="pr-card-header">
        <button
          type="button"
          className="expand-button"
          aria-label={expanded ? 'Collapse PR details' : 'Expand PR details'}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        <div className="pr-title-block">
          <h3>{pullRequest.title}</h3>
          <div className="pr-meta-line">
            <span>{pullRequest.repositoryNameWithOwner}</span>
            <span>#{pullRequest.number}</span>
            <span>{pullRequest.branchName}</span>
          </div>
        </div>

        <a className="github-link" href={pullRequest.url} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          <span>GitHub</span>
        </a>
      </header>

      <dl className="pr-facts">
        <div>
          <dt>Created</dt>
          <dd>{createdAt}</dd>
        </div>
        <div>
          <dt>Comments</dt>
          <dd>{pullRequest.commentCount}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>{reviewLabel}</dd>
        </div>
        <div>
          <dt>Merge</dt>
          <dd>{mergeLabel}</dd>
        </div>
      </dl>

      {expanded ? (
        <div className="thread-list">
          {pullRequest.commentThreads.length > 0 ? (
            pullRequest.commentThreads.map((thread) => {
              const firstComment = thread.comments.at(0);

              return (
                <section className="thread-row" key={thread.id}>
                  <div className="thread-heading">
                    <span>
                      {thread.path}
                      {thread.line ? `:${thread.line}` : ''}
                    </span>
                    {firstComment ? (
                      <a href={firstComment.url} target="_blank" rel="noreferrer">
                        Thread
                      </a>
                    ) : null}
                  </div>
                  <p>{firstComment?.bodyText || 'No comment text available.'}</p>
                </section>
              );
            })
          ) : (
            <div className="empty-thread-list">No review threads.</div>
          )}
          <div className="merge-row">
            {requestedChangeReviewers.length > 0 ? (
              <button
                type="button"
                className="review-request-button"
                disabled={!canRequestReview}
                onClick={handleRequestReview}
              >
                {isRequestingReview ? 'Requesting' : 'Request re-review'}
              </button>
            ) : null}
            {showMergeControls ? (
              <MultiStateActionButton
                ariaLabel="Merge pull request"
                disabled={!canMerge}
                loading={isMerging}
                loadingLabel="Merging"
                onAction={handleMerge}
                onValueChange={handleMergeMethodChange}
                options={mergeMethodOptions}
                selectionDisabled={isMerging}
                tone="accent"
                value={mergeMethod}
              />
            ) : null}
            {approvedBlockedReason === 'failed-checks' && pullRequest.actionWorkflowRuns.length > 0 ? (
              <MultiStateActionButton
                ariaLabel="Rerun workflow jobs"
                disabled={!canRerunChecks}
                leadingIcon={
                  isRerunning ? (
                    <RefreshCw
                      className="refresh-icon refresh-icon--spinning"
                      size={15}
                      strokeWidth={2.2}
                    />
                  ) : null
                }
                loading={isRerunning}
                loadingLabel="Rerunning"
                onAction={handleRerunChecks}
                onValueChange={setRerunMode}
                options={rerunModeOptions}
                selectionDisabled={isRerunning}
                tone="neutral"
                value={rerunMode}
              />
            ) : null}
            {approvedBlockedReason === 'out-of-date' ? (
              <button
                type="button"
                className="review-request-button update-branch-button"
                disabled={!canUpdateBranch}
                onClick={handleUpdateBranch}
              >
                {isUpdatingBranch ? (
                  <RefreshCw
                    className="refresh-icon refresh-icon--spinning"
                    size={15}
                    strokeWidth={2.2}
                  />
                ) : null}
                <span>{isUpdatingBranch ? 'Updating' : 'Update Branch'}</span>
              </button>
            ) : null}
            {mergeError ? <p className="merge-error">{mergeError}</p> : null}
            {reviewRequestError ? <p className="merge-error">{reviewRequestError}</p> : null}
            {updateBranchError ? <p className="merge-error">{updateBranchError}</p> : null}
            {rerunError ? <p className="merge-error">{rerunError}</p> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
};
