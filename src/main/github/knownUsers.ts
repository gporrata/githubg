import type { TeamMember } from '../../shared/settings';
import { githubGraphql } from './graphqlClient';

type KnownUsersResponse = {
  viewer: {
    repositories: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: Array<{
        mentionableUsers: {
          nodes: Array<{
            login: string;
            avatarUrl: string;
            url: string;
          } | null>;
        };
      } | null>;
    };
  };
};

const KNOWN_USERS_QUERY = `
  query KnownUsers($cursor: String) {
    viewer {
      repositories(first: 50, after: $cursor, affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          mentionableUsers(first: 50) {
            nodes {
              login
              avatarUrl
              url
            }
          }
        }
      }
    }
  }
`;

export const fetchKnownUsers = async (): Promise<TeamMember[]> => {
  const usersByLogin = new Map<string, TeamMember>();
  let cursor: string | null = null;

  do {
    const response = await githubGraphql<KnownUsersResponse>(KNOWN_USERS_QUERY, { cursor });

    for (const repository of response.viewer.repositories.nodes) {
      for (const user of repository?.mentionableUsers.nodes ?? []) {
        if (user) {
          usersByLogin.set(user.login, {
            login: user.login,
            avatarUrl: user.avatarUrl,
            url: user.url,
          });
        }
      }
    }

    cursor = response.viewer.repositories.pageInfo.hasNextPage
      ? response.viewer.repositories.pageInfo.endCursor
      : null;
  } while (cursor);

  return [...usersByLogin.values()].sort((left, right) =>
    left.login.localeCompare(right.login, undefined, { sensitivity: 'base' }),
  );
};
