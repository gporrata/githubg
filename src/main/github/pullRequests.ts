import type {
  PullRequestActionRun,
  PullRequestRerunMode,
  PullRequestReviewer,
  PullRequestSummary,
} from '../../shared/pullRequest';
import { githubGraphql } from './graphqlClient';
import {
  PULL_REQUEST_SEARCH_QUERY,
  PULL_REQUEST_NODES_QUERY,
  REQUEST_REVIEWS_MUTATION,
  UPDATE_PULL_REQUEST_BRANCH_MUTATION,
  VIEWER_QUERY,
  type GithubPullRequestNode,
  type GithubPullRequestNodesResponse,
  type GithubPullRequestSearchResponse,
  type GithubViewerResponse,
  type RequestReviewsResponse,
  type UpdatePullRequestBranchResponse,
} from './pullRequestQueries';
import { getVisibleTrackedMergedPullRequestIds } from './mergedPullRequestTracking';
import { getAppStore } from '../store';
import { getGithubToken } from '../githubAuth';

const ticketNumberPattern = /[a-z]+-\d+/i;
const actionRunPattern = /\/actions\/runs\/(\d+)/;
const failedCheckRunConclusions = new Set([
  'ACTION_REQUIRED',
  'CANCELLED',
  'FAILURE',
  'STARTUP_FAILURE',
  'TIMED_OUT',
]);
const failedStatusStates = new Set(['ERROR', 'FAILURE']);

const startOfToday = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

const githubDate = (date: Date): string => date.toISOString().slice(0, 10);

const isToday = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const parseTicketNumber = (branchName: string): string | null => {
  const match = ticketNumberPattern.exec(branchName);
  return match ? match[0].toLowerCase() : null;
};

const compareTicketNumbers = (left: string | null, right: string | null): number => {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
};

const comparePullRequests = (left: PullRequestSummary, right: PullRequestSummary): number => {
  if (left.ticketNumber === null && right.ticketNumber !== null) {
    return 1;
  }

  if (left.ticketNumber !== null && right.ticketNumber === null) {
    return -1;
  }

  const branchCompare = left.branchName.localeCompare(right.branchName, undefined, {
    numeric: true,
    sensitivity: 'base',
  });

  if (branchCompare !== 0) {
    return branchCompare;
  }

  const ticketCompare = compareTicketNumbers(left.ticketNumber, right.ticketNumber);

  if (ticketCompare !== 0) {
    return ticketCompare;
  }

  return left.repositoryNameWithOwner.localeCompare(right.repositoryNameWithOwner);
};

const mergeableStates = new Set(['CLEAN', 'HAS_HOOKS', 'UNSTABLE']);

const getRequestedChangeReviewers = (node: GithubPullRequestNode): PullRequestReviewer[] => {
  const latestDecisiveReviewByAuthor = new Map<
    string,
    { id: string; state: 'APPROVED' | 'CHANGES_REQUESTED'; submittedAt: string }
  >();

  for (const review of node.reviews.nodes) {
    if (!review?.author?.id || !review.submittedAt) {
      continue;
    }

    if (review.state !== 'APPROVED' && review.state !== 'CHANGES_REQUESTED') {
      continue;
    }

    const existing = latestDecisiveReviewByAuthor.get(review.author.login);

    if (!existing || review.submittedAt > existing.submittedAt) {
      latestDecisiveReviewByAuthor.set(review.author.login, {
        id: review.author.id,
        state: review.state,
        submittedAt: review.submittedAt,
      });
    }
  }

  return [...latestDecisiveReviewByAuthor.entries()]
    .filter(([, review]) => review.state === 'CHANGES_REQUESTED')
    .map(([login, review]) => ({ id: review.id, login }))
    .sort((left, right) => left.login.localeCompare(right.login));
};

const parseActionRunId = (url: string | null | undefined): number | null => {
  if (!url) {
    return null;
  }

  const match = actionRunPattern.exec(url);

  return match ? Number(match[1]) : null;
};

const getFailedActionWorkflowRuns = (node: GithubPullRequestNode): PullRequestActionRun[] => {
  const latestCommit = node.commits.nodes.at(0)?.commit;
  const actionWorkflowRuns = new Map<number, PullRequestActionRun>();

  for (const context of latestCommit?.statusCheckRollup?.contexts.nodes ?? []) {
    if (!context) {
      continue;
    }

    const isFailedCheckRun =
      context.__typename === 'CheckRun' &&
      context.conclusion !== null &&
      failedCheckRunConclusions.has(context.conclusion);
    const isFailedStatusContext =
      context.__typename === 'StatusContext' &&
      context.state !== null &&
      failedStatusStates.has(context.state);

    if (!isFailedCheckRun && !isFailedStatusContext) {
      continue;
    }

    const runId = parseActionRunId(
      context.__typename === 'CheckRun' ? context.detailsUrl : context.targetUrl,
    );

    if (runId !== null) {
      actionWorkflowRuns.set(runId, {
        id: runId,
        name: context.__typename === 'CheckRun' ? (context.name ?? 'GitHub Actions') : (context.context ?? 'GitHub Actions'),
      });
    }
  }

  return [...actionWorkflowRuns.values()].sort((left, right) => left.name.localeCompare(right.name));
};

const mapPullRequest = (node: GithubPullRequestNode, hasActiveActions = false): PullRequestSummary => {
  const latestCommit = node.commits.nodes.at(0)?.commit;
  const checksState = latestCommit?.statusCheckRollup?.state ?? null;
  const ticketNumber = parseTicketNumber(node.headRefName);
  const requestedChangeReviewers =
    node.reviewDecision === 'CHANGES_REQUESTED' ? getRequestedChangeReviewers(node) : [];

  return {
    id: node.id,
    databaseId: node.databaseId,
    repositoryId: node.repository.id,
    repositoryName: node.repository.name,
    repositoryNameWithOwner: node.repository.nameWithOwner,
    number: node.number,
    title: node.title,
    url: node.url,
    state: node.state,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    mergedAt: node.mergedAt,
    authorLogin: node.author?.login ?? null,
    branchName: node.headRefName,
    headSha: latestCommit?.oid ?? null,
    ticketNumber,
    commentCount: node.comments.totalCount + node.reviewThreads.totalCount,
    reviewDecision: node.reviewDecision,
    approved: node.reviewDecision === 'APPROVED',
    mergeable: node.mergeable === 'MERGEABLE',
    mergeStateStatus: node.mergeStateStatus,
    hasConflicts: node.mergeable === 'CONFLICTING' || node.mergeStateStatus === 'DIRTY',
    canBeMerged:
      node.state === 'OPEN' &&
      node.mergeable === 'MERGEABLE' &&
      mergeableStates.has(node.mergeStateStatus),
    mergeInProgress: false,
    hasActiveActions,
    checksState,
    requiredStatusChecksPassed: checksState === 'SUCCESS',
    isDraft: node.isDraft,
    actionWorkflowRuns: getFailedActionWorkflowRuns(node),
    requestedChangeReviewers,
    hasPendingReviewRequest: node.reviewRequests.totalCount > 0,
    reviewThreadCount: node.reviewThreads.totalCount,
    commentThreads: node.reviewThreads.nodes
      .filter((thread) => thread !== null)
      .map((thread) => ({
        id: thread.id,
        path: thread.path,
        line: thread.line,
        isResolved: thread.isResolved,
        isOutdated: thread.isOutdated,
        comments: thread.comments.nodes
          .filter((comment) => comment !== null)
          .map((comment) => ({
            id: comment.id,
            url: comment.url,
            bodyText: comment.bodyText,
            createdAt: comment.createdAt,
            authorLogin: comment.author?.login ?? null,
          })),
      })),
  };
};

const fetchPullRequestsByIds = async (
  ids: string[],
  hasActiveActions = false,
): Promise<PullRequestSummary[]> => {
  if (ids.length === 0) {
    return [];
  }

  const response = await githubGraphql<GithubPullRequestNodesResponse>(PULL_REQUEST_NODES_QUERY, {
    ids,
  });

  return response.nodes
    .filter((node) => node?.__typename === 'PullRequest')
    .map((node) => mapPullRequest(node, hasActiveActions));
};

export const fetchViewerLogin = async (): Promise<string> => {
  const response = await githubGraphql<GithubViewerResponse>(VIEWER_QUERY);
  return response.viewer.login;
};

const fetchOpenPullRequestsBySearchQuery = async (query: string): Promise<PullRequestSummary[]> => {
  const pullRequests: PullRequestSummary[] = [];
  let cursor: string | null = null;

  do {
    const response = await githubGraphql<GithubPullRequestSearchResponse>(
      PULL_REQUEST_SEARCH_QUERY,
      {
        searchQuery: query,
        cursor,
      },
    );

    for (const node of response.search.nodes) {
      if (node?.__typename === 'PullRequest') {
        pullRequests.push(mapPullRequest(node));
      }
    }

    cursor = response.search.pageInfo.hasNextPage ? response.search.pageInfo.endCursor : null;
  } while (cursor);

  return pullRequests;
};

const fetchMergedTodayPullRequestsForAuthor = async (authorLogin: string): Promise<PullRequestSummary[]> => {
  const queryStartDate = githubDate(startOfToday());
  const query = `is:pr is:merged archived:false author:${authorLogin} merged:>=${queryStartDate}`;
  const pullRequests = await fetchOpenPullRequestsBySearchQuery(query);

  return pullRequests.filter((pullRequest) => isToday(pullRequest.mergedAt));
};

const dedupePullRequests = (pullRequests: PullRequestSummary[]): PullRequestSummary[] => {
  const byId = new Map<string, PullRequestSummary>();

  for (const pullRequest of pullRequests) {
    byId.set(pullRequest.id, pullRequest);
  }

  return [...byId.values()];
};

export const fetchOpenPullRequestsForViewer = async (): Promise<PullRequestSummary[]> => {
  const viewerLogin = await fetchViewerLogin();
  const query = `is:pr is:open archived:false author:${viewerLogin}`;
  const pullRequests = await fetchOpenPullRequestsBySearchQuery(query);
  const mergedTodayPullRequests = await fetchMergedTodayPullRequestsForAuthor(viewerLogin);
  const trackedMergedIds = await getVisibleTrackedMergedPullRequestIds();
  const trackedMergedPullRequests = await fetchPullRequestsByIds(trackedMergedIds, true);

  return dedupePullRequests([
    ...pullRequests,
    ...mergedTodayPullRequests,
    ...trackedMergedPullRequests,
  ]).sort(comparePullRequests);
};

export const requestPullRequestReview = async (
  pullRequestId: string,
  userIds: string[],
): Promise<void> => {
  if (userIds.length === 0) {
    return;
  }

  await githubGraphql<RequestReviewsResponse>(REQUEST_REVIEWS_MUTATION, {
    pullRequestId,
    userIds,
  });
};

export const updatePullRequestBranch = async (pullRequestId: string): Promise<void> => {
  await githubGraphql<UpdatePullRequestBranchResponse>(UPDATE_PULL_REQUEST_BRANCH_MUTATION, {
    pullRequestId,
  });
};

const githubRestRequest = async (path: string, init: RequestInit = {}): Promise<void> => {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${getGithubToken()}`,
      'X-GitHub-Api-Version': '2026-03-10',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText} ${bodyText}`.trim());
  }
};

export const rerunPullRequestWorkflowRuns = async (
  repositoryNameWithOwner: string,
  runIds: number[],
  mode: PullRequestRerunMode,
): Promise<void> => {
  const [owner, repo] = repositoryNameWithOwner.split('/');

  if (!owner || !repo || runIds.length === 0) {
    return;
  }

  const endpoint = mode === 'failed' ? 'rerun-failed-jobs' : 'rerun';

  await Promise.all(
    [...new Set(runIds)].map((runId) =>
      githubRestRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}/${endpoint}`,
        { method: 'POST' },
      ),
    ),
  );
};

export const fetchOpenPullRequestsForAuthors = async (
  authorLogins: string[],
): Promise<PullRequestSummary[]> => {
  const batches = await Promise.all(
    authorLogins.map(async (login) => {
      const [openPullRequests, mergedTodayPullRequests] = await Promise.all([
        fetchOpenPullRequestsBySearchQuery(`is:pr is:open archived:false author:${login}`),
        fetchMergedTodayPullRequestsForAuthor(login),
      ]);

      return [...openPullRequests, ...mergedTodayPullRequests];
    }),
  );

  return dedupePullRequests(batches.flat()).sort(comparePullRequests);
};

export const fetchOpenPullRequestsForTeamMembers = async (): Promise<PullRequestSummary[]> => {
  const teamMembers = getAppStore().get('teamMembers', []);
  return fetchOpenPullRequestsForAuthors(teamMembers.map((member) => member.login));
};
