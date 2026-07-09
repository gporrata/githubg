import { ChevronDown, ChevronRight, ExternalLink, Link2 } from 'lucide-react';
import { useState } from 'react';
import type { JiraPullRequestLink, JiraTicketSummary } from '../../../shared/jira';

type JiraTicketCardProps = {
  onOpenPullRequest: (pullRequest: JiraPullRequestLink) => void;
  ticket: JiraTicketSummary;
};

const getCardTone = (status: string): string => {
  if (status === 'Failed Validation') {
    return 'failed-validation';
  }

  if (status === 'Done') {
    return 'done';
  }

  return 'neutral';
};

export const JiraTicketCard = ({
  onOpenPullRequest,
  ticket,
}: JiraTicketCardProps): JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const tone = getCardTone(ticket.status);
  const description = ticket.description.trim() || 'No description.';

  return (
    <article className={`jira-card jira-card--${tone}`}>
      <header className="jira-card-header">
        <button
          type="button"
          className="expand-button"
          aria-label={expanded ? 'Collapse Jira ticket details' : 'Expand Jira ticket details'}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        <div className="jira-title-block">
          <h3>{ticket.summary}</h3>
          <div className="jira-meta-line">
            <span>{ticket.key}</span>
            <span>{ticket.status}</span>
          </div>
        </div>

        <a className="github-link" href={ticket.url} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          <span>Jira</span>
        </a>
      </header>

      <dl className="jira-facts">
        <div>
          <dt>Sprint</dt>
          <dd>{ticket.sprint ?? 'Current'}</dd>
        </div>
        <div>
          <dt>Points</dt>
          <dd>{ticket.points ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Open PRs</dt>
          <dd>{ticket.openPullRequests.length}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{ticket.status}</dd>
        </div>
      </dl>

      {expanded ? (
        <div className="jira-details">
          <section className="jira-detail-section">
            <div className="thread-heading">
              <span>Description</span>
            </div>
            <p>{description}</p>
          </section>

          <section className="jira-detail-section">
            <div className="thread-heading">
              <span>Open pull requests</span>
            </div>
            {ticket.openPullRequests.length > 0 ? (
              <div className="jira-pr-links">
                {ticket.openPullRequests.map((pullRequest) => (
                  <button
                    key={pullRequest.id}
                    type="button"
                    className="jira-pr-link"
                    onClick={() => onOpenPullRequest(pullRequest)}
                  >
                    <Link2 size={14} strokeWidth={2.2} />
                    <span>
                      {pullRequest.repositoryNameWithOwner} #{pullRequest.number}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-thread-list">No open PRs linked.</div>
            )}
          </section>
        </div>
      ) : null}
    </article>
  );
};
