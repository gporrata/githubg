import type {
  JiraAuthState,
  JiraCredentials,
  JiraTicketStatus,
  JiraTicketSummary,
} from '../shared/jira';
import { jiraTicketStatuses } from '../shared/jira';
import { getAppStore, type JiraCredentialState } from './store';

const jiraStatusJql = jiraTicketStatuses.map((status) => `"${status}"`).join(', ');
const atlassianApiBaseUrl = 'https://api.atlassian.com';

type JiraCurrentUserResponse = {
  emailAddress?: string;
  displayName?: string;
};

type JiraTenantInfoResponse = {
  cloudId?: string;
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

type JiraMappedIssue = JiraTicketSummary & {
  hasActiveSprint: boolean;
};

const normalizeSiteUrl = (siteUrl: string): string => siteUrl.trim().replace(/\/+$/, '');

const normalizeCredentialInput = (credentials: JiraCredentials): JiraCredentials => ({
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

const getJiraApiBaseUrl = (credentials: JiraCredentialState): string =>
  `${atlassianApiBaseUrl}/ex/jira/${credentials.cloudId}`;

const fetchJson = async <ResponseBody>(
  url: string,
  init: RequestInit,
  errorPrefix: string,
): Promise<ResponseBody> => {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${errorPrefix}: ${message}`);
  }

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
    `${getJiraApiBaseUrl(credentials)}${path}`,
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

const fetchCloudId = async (siteUrl: string): Promise<string> => {
  let parsedSiteUrl: URL;

  try {
    parsedSiteUrl = new URL(siteUrl);
  } catch {
    throw new Error('Enter a valid Jira URL.');
  }

  if (parsedSiteUrl.protocol !== 'https:') {
    throw new Error('Enter a secure Jira URL that starts with https://.');
  }

  const tenantInfo = await fetchJson<JiraTenantInfoResponse>(
    `${siteUrl}/_edge/tenant_info`,
    { headers: { Accept: 'application/json' } },
    'Unable to identify Jira site',
  );

  if (!tenantInfo.cloudId) {
    throw new Error(`Unable to identify Jira site: no cloudId returned for ${siteUrl}.`);
  }

  return tenantInfo.cloudId;
};

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
  const credentials = getAppStore().get('jiraCredentials', null);

  return credentials
    ? {
        siteUrl: credentials.siteUrl,
        email: credentials.email,
        apiToken: credentials.apiToken,
      }
    : {
        siteUrl: '',
        email: '',
        apiToken: '',
      };
};

export const saveJiraCredentials = async (
  credentials: JiraCredentials,
): Promise<JiraAuthState> => {
  const normalizedCredentials = normalizeCredentialInput(credentials);
  const credentialState = {
    ...normalizedCredentials,
    cloudId: await fetchCloudId(normalizedCredentials.siteUrl),
  };

  await validateCredentials(credentialState);
  getAppStore().set('jiraCredentials', credentialState);
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

const hasActiveSprint = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.some(
    (item): item is JiraSprintFieldValue =>
      Boolean(item) &&
      typeof item === 'object' &&
      'state' in item &&
      typeof item.state === 'string' &&
      item.state.toLowerCase() === 'active',
  );

const mapIssue = (
  issue: JiraIssue,
  siteUrl: string,
  sprintFieldId: string | null,
  pointsFieldId: string | null,
): JiraMappedIssue => ({
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
  hasActiveSprint: sprintFieldId ? hasActiveSprint(issue.fields[sprintFieldId]) : false,
  points: pointsFieldId ? extractPoints(issue.fields[pointsFieldId]) : null,
  openPullRequests: [],
});

const shouldShowIssue = (issue: JiraMappedIssue): boolean => {
  if (issue.status !== 'Done') {
    return true;
  }

  return issue.hasActiveSprint;
};

const toTicketSummary = (issue: JiraMappedIssue): JiraTicketSummary => ({
  id: issue.id,
  key: issue.key,
  summary: issue.summary,
  description: issue.description,
  url: issue.url,
  status: issue.status,
  sprint: issue.sprint,
  points: issue.points,
  openPullRequests: issue.openPullRequests,
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

  return response.issues
    .map((issue) => mapIssue(issue, credentials.siteUrl, sprintFieldId, pointsFieldId))
    .filter(shouldShowIssue)
    .map(toTicketSummary);
};
