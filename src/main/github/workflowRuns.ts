import { getGithubToken } from '../githubAuth';

type WorkflowRunsResponse = {
  workflow_runs?: Array<{
    id: number;
    status: string | null;
    conclusion: string | null;
  }>;
};

export const areWorkflowRunsCompleteForCommit = async (
  repositoryNameWithOwner: string,
  commitSha: string,
): Promise<boolean> => {
  const [owner, repo] = repositoryNameWithOwner.split('/');

  if (!owner || !repo) {
    return false;
  }

  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/actions/runs`);
  url.searchParams.set('head_sha', commitSha);
  url.searchParams.set('per_page', '20');

  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${getGithubToken()}`,
      'x-github-api-version': '2022-11-28',
    },
  });

  if (!response.ok) {
    return false;
  }

  const body = (await response.json()) as WorkflowRunsResponse;
  const runs = body.workflow_runs ?? [];

  return runs.length > 0 && runs.every((run) => run.status === 'completed');
};
