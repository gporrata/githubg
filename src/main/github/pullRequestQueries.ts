export type GithubPullRequestSearchResponse = {
  search: {
    issueCount: number;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: Array<GithubPullRequestNode | null>;
  };
};

export type GithubPullRequestNodesResponse = {
  nodes: Array<GithubPullRequestNode | null>;
};

export type GithubViewerResponse = {
  viewer: {
    login: string;
  };
};

export type GithubPullRequestNode = {
  __typename: 'PullRequest';
  id: string;
  databaseId: number | null;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  isDraft: boolean;
  headRefName: string;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  repository: {
    id: string;
    name: string;
    nameWithOwner: string;
    owner: {
      login: string;
    };
  };
  author: {
    login: string;
    avatarUrl: string;
    url: string;
  } | null;
  comments: {
    totalCount: number;
  };
  reviewThreads: {
    totalCount: number;
    nodes: Array<{
      id: string;
      isResolved: boolean;
      isOutdated: boolean;
      path: string;
      line: number | null;
      comments: {
        nodes: Array<{
          id: string;
          url: string;
          bodyText: string;
          createdAt: string;
          author: {
            login: string;
          } | null;
        } | null>;
      };
    } | null>;
  };
  commits: {
    nodes: Array<{
      commit: {
        oid: string;
        statusCheckRollup: {
          state: 'EXPECTED' | 'ERROR' | 'FAILURE' | 'PENDING' | 'SUCCESS' | null;
          contexts: {
            nodes: Array<{
              __typename: 'CheckRun' | 'StatusContext';
              name?: string;
              context?: string;
              conclusion?: string | null;
              status?: string | null;
              state?: string | null;
              detailsUrl?: string | null;
              targetUrl?: string | null;
            } | null>;
          };
        } | null;
      };
    } | null>;
  };
};

export const VIEWER_QUERY = `
  query Viewer {
    viewer {
      login
    }
  }
`;

const PULL_REQUEST_FIELDS = `
  fragment PullRequestFields on PullRequest {
    id
    databaseId
    number
    title
    url
    state
    createdAt
    updatedAt
    mergedAt
    isDraft
    headRefName
    mergeable
    reviewDecision
    repository {
      id
      name
      nameWithOwner
      owner {
        login
      }
    }
    author {
      login
      avatarUrl
      url
    }
    comments {
      totalCount
    }
    reviewThreads(first: 25) {
      totalCount
      nodes {
        id
        isResolved
        isOutdated
        path
        line
        comments(first: 10) {
          nodes {
            id
            url
            bodyText
            createdAt
            author {
              login
            }
          }
        }
      }
    }
    commits(last: 1) {
      nodes {
        commit {
          oid
          statusCheckRollup {
            state
            contexts(first: 50) {
              nodes {
                __typename
                ... on CheckRun {
                  name
                  conclusion
                  status
                  detailsUrl
                }
                ... on StatusContext {
                  context
                  state
                  targetUrl
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const PULL_REQUEST_SEARCH_QUERY = `
  query PullRequestSearch($query: String!, $cursor: String) {
    search(query: $query, type: ISSUE, first: 50, after: $cursor) {
      issueCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        __typename
        ... on PullRequest {
          ...PullRequestFields
        }
      }
    }
  }
  ${PULL_REQUEST_FIELDS}
`;

export const PULL_REQUEST_NODES_QUERY = `
  query PullRequestNodes($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      ... on PullRequest {
        ...PullRequestFields
      }
    }
  }
  ${PULL_REQUEST_FIELDS}
`;

export type MergePullRequestResponse = {
  mergePullRequest: {
    pullRequest: {
      id: string;
      state: 'MERGED';
      mergedAt: string | null;
      mergeCommit: {
        oid: string;
      } | null;
      repository: {
        nameWithOwner: string;
      };
    } | null;
  } | null;
};

export const MERGE_PULL_REQUEST_MUTATION = `
  mutation MergePullRequest($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
    mergePullRequest(input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }) {
      pullRequest {
        id
        state
        mergedAt
        mergeCommit {
          oid
        }
        repository {
          nameWithOwner
        }
      }
    }
  }
`;
