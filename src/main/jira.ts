import { shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo, IncomingMessage, ServerResponse } from 'node:http';
import type {
  JiraAuthState,
  JiraSettings,
  JiraTicketStatus,
  JiraTicketSummary,
} from '../shared/jira';
import { jiraTicketStatuses } from '../shared/jira';
import { getAppStore, type JiraTokenState } from './store';

const authBaseUrl = 'https://auth.atlassian.com';
const apiBaseUrl = 'https://api.atlassian.com';
const callbackHost = '127.0.0.1';
const callbackPath = '/jira/callback';
export const jiraRedirectUri = `http://${callbackHost}:<ephemeral-port>${callbackPath}`;

const jiraScopes = ['read:jira-work', 'read:jira-user', 'offline_access'];
const jiraStatusJql = jiraTicketStatuses.map((status) => `"${status}"`).join(', ');

type AtlassianTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type AtlassianAccessibleResource = {
  id: string;
  url: string;
  name: string;
  scopes: string[];
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

const getJiraSettings = (): JiraSettings => getAppStore().get('settings').jira;

const getRequiredJiraSettings = (): JiraSettings => {
  const settings = getJiraSettings();

  if (!settings.clientId.trim()) {
    throw new Error('Add a Jira OAuth client ID in Settings first.');
  }

  if (!settings.clientSecret.trim()) {
    throw new Error('Add a Jira OAuth client secret in Settings first.');
  }

  if (!settings.siteUrl.trim()) {
    throw new Error('Add a Jira site URL in Settings first.');
  }

  if (!settings.projectKey.trim()) {
    throw new Error('Add a Jira project key in Settings first.');
  }

  return {
    ...settings,
    clientId: settings.clientId.trim(),
    clientSecret: settings.clientSecret.trim(),
    projectKey: settings.projectKey.trim().toUpperCase(),
    siteUrl: normalizeSiteUrl(settings.siteUrl),
  };
};

const readRequestUrl = (request: IncomingMessage): URL | null => {
  if (!request.url) {
    return null;
  }

  return new URL(request.url, `http://${callbackHost}`);
};

const sendCallbackResponse = (response: ServerResponse, message: string): void => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`
    <!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>githubg Jira auth</title></head>
      <body>
        <h1>${message}</h1>
        <p>You can close this browser tab and return to githubg.</p>
      </body>
    </html>
  `);
};

type AuthorizationCodeListener = {
  codePromise: Promise<string>;
  close: () => void;
  redirectUri: string;
};

const createAuthorizationCodeListener = async (
  expectedState: string,
): Promise<AuthorizationCodeListener> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    const codePromise = new Promise<string>((codeResolve, codeReject) => {
      server.on('request', (request, response) => {
        const callbackUrl = readRequestUrl(request);

        if (!callbackUrl || callbackUrl.pathname !== callbackPath) {
          return;
        }

        const error = callbackUrl.searchParams.get('error');
        const state = callbackUrl.searchParams.get('state');
        const code = callbackUrl.searchParams.get('code');

        if (error) {
          sendCallbackResponse(response, 'Jira authorization was not completed.');
          codeReject(new Error(`Jira authorization failed: ${error}`));
          server.close();
          return;
        }

        if (state !== expectedState) {
          sendCallbackResponse(response, 'Jira authorization was rejected.');
          codeReject(new Error('Jira authorization returned an invalid state value.'));
          server.close();
          return;
        }

        if (!code) {
          sendCallbackResponse(response, 'Jira authorization did not return a code.');
          codeReject(new Error('Jira authorization did not return a code.'));
          server.close();
          return;
        }

        sendCallbackResponse(response, 'Jira authorization complete.');
        codeResolve(code);
        server.close();
      });
    });

    server.once('error', (error) => {
      reject(error);
    });

    server.listen(0, callbackHost, () => {
      const address = server.address() as AddressInfo;
      const redirectUri = `http://${callbackHost}:${address.port}${callbackPath}`;

      resolve({
        codePromise,
        close: () => server.close(),
        redirectUri,
      });
    });
  });

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

const exchangeAuthorizationCode = async (
  code: string,
  settings: JiraSettings,
  redirectUri: string,
): Promise<AtlassianTokenResponse> =>
  fetchJson<AtlassianTokenResponse>(
    `${authBaseUrl}/oauth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    },
    'Unable to exchange Jira authorization code',
  );

const refreshAccessToken = async (
  tokenState: JiraTokenState,
  settings: JiraSettings,
): Promise<JiraTokenState> => {
  const tokenResponse = await fetchJson<AtlassianTokenResponse>(
    `${authBaseUrl}/oauth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        refresh_token: tokenState.refreshToken,
      }),
    },
    'Unable to refresh Jira authorization',
  );

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? tokenState.refreshToken,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    cloudId: tokenState.cloudId,
    siteUrl: tokenState.siteUrl,
  };
};

const fetchAccessibleResources = async (
  accessToken: string,
): Promise<AtlassianAccessibleResource[]> =>
  fetchJson<AtlassianAccessibleResource[]>(
    `${apiBaseUrl}/oauth/token/accessible-resources`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Unable to load Jira sites',
  );

const selectAccessibleResource = (
  resources: AtlassianAccessibleResource[],
  siteUrl: string,
): AtlassianAccessibleResource => {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const resource =
    resources.find((candidate) => normalizeSiteUrl(candidate.url) === normalizedSiteUrl) ??
    resources.at(0);

  if (!resource) {
    throw new Error('No Jira sites were returned for this Atlassian account.');
  }

  return resource;
};

const saveTokenState = (tokenState: JiraTokenState): JiraTokenState => {
  getAppStore().set('jiraTokens', tokenState);
  return tokenState;
};

export const getJiraAuthState = (): JiraAuthState => {
  const tokenState = getAppStore().get('jiraTokens', null);
  const settings = getJiraSettings();

  return {
    isAuthenticated: tokenState !== null,
    siteUrl: tokenState?.siteUrl ?? normalizeSiteUrl(settings.siteUrl),
    cloudId: tokenState?.cloudId ?? null,
    expiresAt: tokenState?.expiresAt ?? null,
  };
};

export const authenticateJira = async (): Promise<JiraAuthState> => {
  const settings = getRequiredJiraSettings();
  const state = randomBytes(24).toString('base64url');
  const authorizationCodeListener = await createAuthorizationCodeListener(state);
  const authorizeUrl = new URL(`${authBaseUrl}/authorize`);
  authorizeUrl.searchParams.set('audience', 'api.atlassian.com');
  authorizeUrl.searchParams.set('client_id', settings.clientId);
  authorizeUrl.searchParams.set('scope', jiraScopes.join(' '));
  authorizeUrl.searchParams.set('redirect_uri', authorizationCodeListener.redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('prompt', 'consent');

  try {
    await shell.openExternal(authorizeUrl.toString());

    const code = await authorizationCodeListener.codePromise;
    const tokenResponse = await exchangeAuthorizationCode(
      code,
      settings,
      authorizationCodeListener.redirectUri,
    );
    const resource = selectAccessibleResource(
      await fetchAccessibleResources(tokenResponse.access_token),
      settings.siteUrl,
    );

    saveTokenState({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? '',
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      cloudId: resource.id,
      siteUrl: normalizeSiteUrl(resource.url),
    });

    return getJiraAuthState();
  } finally {
    authorizationCodeListener.close();
  }
};

export const disconnectJira = (): JiraAuthState => {
  getAppStore().set('jiraTokens', null);
  return getJiraAuthState();
};

const getValidJiraTokenState = async (): Promise<JiraTokenState> => {
  const settings = getRequiredJiraSettings();
  const tokenState = getAppStore().get('jiraTokens', null);

  if (!tokenState) {
    throw new Error('Connect Jira before loading tickets.');
  }

  if (tokenState.expiresAt > Date.now() + 60_000) {
    return tokenState;
  }

  if (!tokenState.refreshToken) {
    throw new Error('Jira authorization has expired. Reconnect Jira in Settings.');
  }

  return saveTokenState(await refreshAccessToken(tokenState, settings));
};

const jiraRequest = async <ResponseBody>(
  tokenState: JiraTokenState,
  path: string,
  init: RequestInit = {},
): Promise<ResponseBody> =>
  fetchJson<ResponseBody>(
    `${apiBaseUrl}/ex/jira/${tokenState.cloudId}${path}`,
    {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenState.accessToken}`,
        ...init.headers,
      },
    },
    'Unable to load Jira data',
  );

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
  const settings = getRequiredJiraSettings();
  const tokenState = await getValidJiraTokenState();
  const fields = await jiraRequest<JiraField[]>(tokenState, '/rest/api/3/field');
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
    tokenState,
    '/rest/api/3/search/jql',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jql: `project = ${settings.projectKey} AND sprint in openSprints() AND status in (${jiraStatusJql}) ORDER BY Rank ASC`,
        fields: requestedFields,
        fieldsByKeys: true,
        maxResults: 100,
      }),
    },
  );

  return response.issues.map((issue) =>
    mapIssue(issue, tokenState.siteUrl, sprintFieldId, pointsFieldId),
  );
};
