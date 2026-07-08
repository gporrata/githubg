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

  return pullRequest.commentCount > 0 ? 'comments' : 'quiet';
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

export const PullRequestCard = ({ pullRequest }: PullRequestCardProps): JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>('SQUASH');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const tone = getCardTone(pullRequest);
  const reviewLabel = getReviewLabel(pullRequest);
  const createdAt = useMemo(() => formatDate(pullRequest.createdAt), [pullRequest.createdAt]);
  const canMerge = pullRequest.mergeable && pullRequest.requiredStatusChecksPassed && !isMerging;

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

  const handleMergeMethodChange = (value: MergeMethod): void => {
    setMergeMethod(value);
    void window.githubg.setMergeMethod(pullRequest.id, value);
  };

  const handleMerge = async (): Promise<void> => {
    setIsMerging(true);
    setMergeError(null);

    try {
      await window.githubg.mergePullRequest(pullRequest.id, mergeMethod);
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Merge failed.');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <article className={`pr-card pr-card--${tone}`}>
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
          <dd>{pullRequest.mergeInProgress ? 'Merging' : 'Idle'}</dd>
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
            {mergeError ? <p className="merge-error">{mergeError}</p> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
};
