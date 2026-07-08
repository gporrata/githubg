import type { PullRequestSummary } from '../../shared/pullRequest';
import { githubGraphql } from './graphqlClient';
import {
  PULL_REQUEST_SEARCH_QUERY,
  PULL_REQUEST_NODES_QUERY,
  VIEWER_QUERY,
  type GithubPullRequestNode,
  type GithubPullRequestNodesResponse,
  type GithubPullRequestSearchResponse,
  type GithubViewerResponse,
} from './pullRequestQueries';
import { getVisibleTrackedMergedPullRequestIds } from './mergedPullRequestTracking';
import { getAppStore } from '../store';

const ticketNumberPattern = /[a-z]+-\d+/i;

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

const mapPullRequest = (node: GithubPullRequestNode): PullRequestSummary => {
  const latestCommit = node.commits.nodes.at(0)?.commit;
  const checksState = latestCommit?.statusCheckRollup?.state ?? null;
  const ticketNumber = parseTicketNumber(node.headRefName);

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
    mergeInProgress: false,
    checksState,
    requiredStatusChecksPassed: checksState === 'SUCCESS',
    isDraft: node.isDraft,
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

const fetchPullRequestsByIds = async (ids: string[]): Promise<PullRequestSummary[]> => {
  if (ids.length === 0) {
    return [];
  }

  const response = await githubGraphql<GithubPullRequestNodesResponse>(PULL_REQUEST_NODES_QUERY, {
    ids,
  });

  return response.nodes
    .filter((node) => node?.__typename === 'PullRequest')
    .map((node) => mapPullRequest(node));
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
  const trackedMergedIds = await getVisibleTrackedMergedPullRequestIds();
  const trackedMergedPullRequests = await fetchPullRequestsByIds(trackedMergedIds);

  return [...pullRequests, ...trackedMergedPullRequests].sort(comparePullRequests);
};

export const fetchOpenPullRequestsForAuthors = async (
  authorLogins: string[],
): Promise<PullRequestSummary[]> => {
  const batches = await Promise.all(
    authorLogins.map((login) =>
      fetchOpenPullRequestsBySearchQuery(`is:pr is:open archived:false author:${login}`),
    ),
  );

  return dedupePullRequests(batches.flat()).sort(comparePullRequests);
};

export const fetchOpenPullRequestsForTeamMembers = async (): Promise<PullRequestSummary[]> => {
  const teamMembers = getAppStore().get('teamMembers', []);
  return fetchOpenPullRequestsForAuthors(teamMembers.map((member) => member.login));
};
