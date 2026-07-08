import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PullRequestSummary } from '../../../shared/pullRequest';
import type { MergeMethod } from '../../../shared/settings';
import { mergeMethods } from '../../../shared/settings';

type PullRequestCardProps = {
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

  if (pullRequest.reviewDecision === 'CHANGES_REQUESTED') {
    return 'Changes requested';
  }

  return 'Review pending';
};

const hasUnaddressedRequestedChanges = (pullRequest: PullRequestSummary): boolean => {
  if (pullRequest.reviewDecision !== 'CHANGES_REQUESTED') {
    return false;
  }

  const activeThreads = pullRequest.commentThreads.filter(
    (thread) => !thread.isResolved && !thread.isOutdated,
  );

  return activeThreads.length > 0 || pullRequest.commentThreads.length === 0;
};

const getMergeLabel = (pullRequest: PullRequestSummary): string => {
  if (pullRequest.mergeInProgress) {
    return 'Merging';
  }

  if (pullRequest.state === 'MERGED') {
    return pullRequest.hasActiveActions ? 'Actions running' : 'Merged';
  }

  if (!pullRequest.canBeMerged) {
    return 'Blocked';
  }

  return 'Ready';
};

export const PullRequestCard = ({ pullRequest }: PullRequestCardProps): JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>('SQUASH');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [reviewRequestError, setReviewRequestError] = useState<string | null>(null);
  const [isRequestingReview, setIsRequestingReview] = useState(false);
  const [hasLocalMergedActiveActions, setHasLocalMergedActiveActions] = useState(false);
  const tone = getCardTone(pullRequest);
  const reviewLabel = getReviewLabel(pullRequest);
  const createdAt = useMemo(() => formatDate(pullRequest.createdAt), [pullRequest.createdAt]);
  const mergeLabel = hasLocalMergedActiveActions ? 'Actions running' : getMergeLabel(pullRequest);
  const canMerge = pullRequest.canBeMerged && !isMerging && !hasLocalMergedActiveActions;
  const showMergeControls = pullRequest.canBeMerged || hasLocalMergedActiveActions || isMerging;
  const requestedChangeReviewers = pullRequest.requestedChangeReviewers;
  const canRequestReview = requestedChangeReviewers.length > 0 && !isRequestingReview;
  const hasRunningAction =
    isMerging ||
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
    } catch (error) {
      setReviewRequestError(error instanceof Error ? error.message : 'Review request failed.');
    } finally {
      setIsRequestingReview(false);
    }
  };

  return (
    <article className={`pr-card pr-card--${tone}${hasRunningAction ? ' pr-card--action-running' : ''}`}>
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
              <>
                <label>
                  <span>Method</span>
                  <select
                    value={mergeMethod}
                    onChange={(event) => handleMergeMethodChange(event.target.value as MergeMethod)}
                  >
                    {mergeMethods.map((method) => (
                      <option key={method} value={method}>
                        {method.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="merge-button" disabled={!canMerge} onClick={handleMerge}>
                  {isMerging ? 'Merging' : 'Merge'}
                </button>
              </>
            ) : null}
            {mergeError ? <p className="merge-error">{mergeError}</p> : null}
            {reviewRequestError ? <p className="merge-error">{reviewRequestError}</p> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
};
