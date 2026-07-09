import type {
  JiraAuthState,
  JiraCredentials,
  JiraTicketStatus,
  JiraTicketSummary,
} from '../shared/jira';
import { jiraTicketStatuses } from '../shared/jira';
import { getAppStore, type JiraCredentialState } from './store';

const jiraStatusJql = jiraTicketStatuses.map((status) => `"${status}"`).join(', ');

type JiraCurrentUserResponse = {
  emailAddress?: string;
  displayName?: string;
};

type JiraField = {
  id: string;
  name: string;
};

type JiraIssueSearchResponse = {
  issues: JiraIssue[];
};

type JiraIssue = {
  id: string;
  key: string;
  fields: {
    summary?: unknown;
    description?: unknown;
    status?: {
      name?: unknown;
    };
    [fieldId: string]: unknown;
  };
};

type JiraSprintFieldValue = {
  name?: unknown;
  state?: unknown;
};

const normalizeSiteUrl = (siteUrl: string): string => siteUrl.trim().replace(/\/+$/, '');

const normalizeCredentials = (credentials: JiraCredentials): JiraCredentialState => ({
  siteUrl: normalizeSiteUrl(credentials.siteUrl),
  email: credentials.email.trim(),
  apiToken: credentials.apiToken.trim(),
});

const getRequiredJiraCredentials = (): JiraCredentialState => {
  const credentials = getAppStore().get('jiraCredentials', null);

  if (!credentials) {
    throw new Error('Enter a Jira URL, email, and API token first.');
  }

  return credentials;
};

const getBasicAuthHeader = (credentials: JiraCredentialState): string =>
  `Basic ${Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64')}`;

const fetchJson = async <ResponseBody>(
  url: string,
  init: RequestInit,
  errorPrefix: string,
): Promise<ResponseBody> => {
  const response = await fetch(url, init);
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`${errorPrefix}: ${response.status} ${response.statusText} ${bodyText}`.trim());
  }

  return bodyText ? (JSON.parse(bodyText) as ResponseBody) : ({} as ResponseBody);
};

const jiraRequest = async <ResponseBody>(
  credentials: JiraCredentialState,
  path: string,
  init: RequestInit = {},
  errorPrefix = 'Unable to load Jira data',
): Promise<ResponseBody> =>
  fetchJson<ResponseBody>(
    `${credentials.siteUrl}${path}`,
    {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: getBasicAuthHeader(credentials),
        ...init.headers,
      },
    },
    errorPrefix,
  );

const validateCredentials = async (
  credentials: JiraCredentialState,
): Promise<JiraCurrentUserResponse> => {
  if (!credentials.siteUrl) {
    throw new Error('Enter a Jira URL.');
  }

  if (!credentials.email) {
    throw new Error('Enter your Atlassian email.');
  }

  if (!credentials.apiToken) {
    throw new Error('Enter a Jira API token.');
  }

  return jiraRequest<JiraCurrentUserResponse>(
    credentials,
    '/rest/api/3/myself',
    {},
    'Unable to verify Jira access',
  );
};

export const getJiraAuthState = (): JiraAuthState => {
  const credentials = getAppStore().get('jiraCredentials', null);

  return {
    isAuthenticated: credentials !== null,
    siteUrl: credentials?.siteUrl ?? null,
    email: credentials?.email ?? null,
  };
};

export const getJiraCredentials = (): JiraCredentials => {
  return (
    getAppStore().get('jiraCredentials', null) ?? {
      siteUrl: '',
      email: '',
      apiToken: '',
    }
  );
};

export const saveJiraCredentials = async (
  credentials: JiraCredentials,
): Promise<JiraAuthState> => {
  const normalizedCredentials = normalizeCredentials(credentials);
  await validateCredentials(normalizedCredentials);
  getAppStore().set('jiraCredentials', normalizedCredentials);
  return getJiraAuthState();
};

export const disconnectJira = (): JiraAuthState => {
  getAppStore().set('jiraCredentials', null);
  return getJiraAuthState();
};

const findFieldId = (fields: JiraField[], names: string[]): string | null => {
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
  return fields.find((field) => normalizedNames.has(field.name.toLowerCase()))?.id ?? null;
};

const extractDocumentText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  if ('text' in value && typeof value.text === 'string') {
    return value.text;
  }

  if ('content' in value && Array.isArray(value.content)) {
    return value.content.map(extractDocumentText).filter(Boolean).join(' ');
  }

  return '';
};

const extractPoints = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const extractSprint = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const activeSprint =
      value.find(
        (item): item is JiraSprintFieldValue =>
          Boolean(item) &&
          typeof item === 'object' &&
          'state' in item &&
          typeof item.state === 'string' &&
          item.state.toLowerCase() === 'active',
      ) ?? value.at(-1);

    return activeSprint &&
      typeof activeSprint === 'object' &&
      'name' in activeSprint &&
      typeof activeSprint.name === 'string'
      ? activeSprint.name
      : null;
  }

  if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string') {
    return value.name;
  }

  return null;
};

const mapIssue = (
  issue: JiraIssue,
  siteUrl: string,
  sprintFieldId: string | null,
  pointsFieldId: string | null,
): JiraTicketSummary => ({
  id: issue.id,
  key: issue.key,
  summary: typeof issue.fields.summary === 'string' ? issue.fields.summary : issue.key,
  description: extractDocumentText(issue.fields.description),
  url: `${siteUrl}/browse/${issue.key}`,
  status:
    typeof issue.fields.status?.name === 'string'
      ? (issue.fields.status.name as JiraTicketStatus | string)
      : 'Unknown',
  sprint: sprintFieldId ? extractSprint(issue.fields[sprintFieldId]) : null,
  points: pointsFieldId ? extractPoints(issue.fields[pointsFieldId]) : null,
  openPullRequests: [],
});

export const fetchJiraTickets = async (): Promise<JiraTicketSummary[]> => {
  const credentials = getRequiredJiraCredentials();
  const fields = await jiraRequest<JiraField[]>(credentials, '/rest/api/3/field');
  const sprintFieldId = findFieldId(fields, ['Sprint']);
  const pointsFieldId = findFieldId(fields, ['Story Points', 'Story point estimate']);
  const requestedFields = ['summary', 'description', 'status'];

  if (sprintFieldId) {
    requestedFields.push(sprintFieldId);
  }

  if (pointsFieldId) {
    requestedFields.push(pointsFieldId);
  }

  const response = await jiraRequest<JiraIssueSearchResponse>(
    credentials,
    '/rest/api/3/search/jql',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jql: `assignee = currentUser() AND sprint in openSprints() AND status in (${jiraStatusJql}) ORDER BY Rank ASC`,
        fields: requestedFields,
        fieldsByKeys: true,
        maxResults: 100,
      }),
    },
  );

  return response.issues.map((issue) =>
    mapIssue(issue, credentials.siteUrl, sprintFieldId, pointsFieldId),
  );
};
