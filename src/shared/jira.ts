export const jiraTicketStatuses = [
  'Ready',
  'In Progress',
  'Waiting for Review',
  'Needs Validation',
  'In Validation',
  'Failed Validation',
  'Blocked',
  'Done',
] as const;

export type JiraTicketStatus = (typeof jiraTicketStatuses)[number];

export type JiraAuthState = {
  isAuthenticated: boolean;
  siteUrl: string | null;
  cloudId: string | null;
  expiresAt: number | null;
};

export type JiraSettings = {
  clientId: string;
  clientSecret: string;
  projectKey: string;
  siteUrl: string;
};

export type JiraPullRequestLink = {
  id: string;
  title: string;
  number: number;
  repositoryNameWithOwner: string;
  url: string;
};

export type JiraTicketSummary = {
  id: string;
  key: string;
  summary: string;
  description: string;
  url: string;
  status: JiraTicketStatus | string;
  sprint: string | null;
  points: number | null;
  openPullRequests: JiraPullRequestLink[];
};
