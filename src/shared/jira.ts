export const jiraTicketStatuses = [
  'Ready',
  'In Progress',
  'Waiting for Review',
  'Waiting for Peer Review',
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
  email: string | null;
};

export type JiraCredentials = {
  siteUrl: string;
  email: string;
  apiToken: string;
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
