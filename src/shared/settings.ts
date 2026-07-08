export const themeOptions = ['system', 'light', 'dark', 'github-dark', 'solarized-light'] as const;

export type ThemeId = (typeof themeOptions)[number];

export const mergeMethods = ['SQUASH', 'MERGE', 'REBASE'] as const;

export type MergeMethod = (typeof mergeMethods)[number];

export type TeamMember = {
  login: string;
  avatarUrl?: string;
  url?: string;
};

export type MergedPullRequestTracking = {
  mergedAt: string;
  repositoryNameWithOwner: string;
  mergeCommitOid: string;
  workflowCompletedAt?: string;
};

export type JiraAppSettings = {
  clientId: string;
  projectKey: string;
  siteUrl: string;
};

export type GithubgSettings = {
  theme: ThemeId;
  pollIntervalMs: number;
  jira: JiraAppSettings;
};
