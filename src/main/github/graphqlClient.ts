import { graphql } from '@octokit/graphql';
import { getGithubToken } from '../githubAuth';

export const githubGraphql = async <Response>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<Response> => {
  const request = graphql.defaults({
    headers: {
      authorization: `token ${getGithubToken()}`,
    },
  });

  return request<Response>(query, variables);
};
