import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

let githubToken: string | null = null;

export class GithubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GithubAuthError';
  }
}

export const initializeGithubAuth = async (): Promise<void> => {
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });

    const token = stdout.trim();

    if (!token) {
      throw new GithubAuthError('GitHub CLI did not return an auth token.');
    }

    githubToken = token;
  } catch (error) {
    if (error instanceof GithubAuthError) {
      throw error;
    }

    throw new GithubAuthError(
      'githubg requires the GitHub CLI to be installed and authenticated. Run `gh auth login`, then start githubg again.',
    );
  }
};

export const getGithubToken = (): string => {
  if (!githubToken) {
    throw new GithubAuthError('GitHub auth has not been initialized yet.');
  }

  return githubToken;
};
