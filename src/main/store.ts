import ElectronStore from 'electron-store';
import type {
  GithubgSettings,
  MergeMethod,
  MergedPullRequestTracking,
  TeamMember,
} from '../shared/settings';

export type JiraTokenState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  cloudId: string;
  siteUrl: string;
};

export type AppStoreSchema = {
  teamMembers: TeamMember[];
  settings: GithubgSettings;
  jiraTokens: JiraTokenState | null;
  mergedPullRequests: Record<string, MergedPullRequestTracking>;
  mergeMethods: Record<string, MergeMethod>;
};

const defaultSettings: GithubgSettings = {
  theme: 'system',
  pollIntervalMs: 120_000,
  jira: {
    clientId: '',
    projectKey: '',
    siteUrl: '',
  },
};

const StoreConstructor = (
  typeof ElectronStore === 'function'
    ? ElectronStore
    : (ElectronStore as unknown as { default: typeof ElectronStore }).default
) as typeof ElectronStore;

let appStore: ElectronStore<AppStoreSchema> | null = null;

export const getAppStore = (): ElectronStore<AppStoreSchema> => {
  appStore ??= new StoreConstructor<AppStoreSchema>({
    name: 'githubg',
    defaults: {
      teamMembers: [],
      settings: defaultSettings,
      jiraTokens: null,
      mergedPullRequests: {},
      mergeMethods: {},
    },
    migrations: {
      '>=0.1.0': (store) => {
        const settings = store.get('settings') as Partial<GithubgSettings> | undefined;
        store.set('settings', {
          ...defaultSettings,
          ...settings,
          jira: {
            ...defaultSettings.jira,
            ...(settings?.jira ?? {}),
          },
        });
      },
    },
    schema: {
      teamMembers: {
        type: 'array',
        default: [],
        items: {
          type: 'object',
          required: ['login'],
          additionalProperties: false,
          properties: {
            login: { type: 'string' },
            avatarUrl: { type: 'string' },
            url: { type: 'string' },
          },
        },
      },
      settings: {
        type: 'object',
        default: defaultSettings,
        required: ['theme', 'pollIntervalMs'],
        additionalProperties: false,
        properties: {
          theme: {
            type: 'string',
            enum: ['system', 'light', 'dark', 'github-dark', 'solarized-light'],
            default: 'system',
          },
          pollIntervalMs: {
            type: 'number',
            minimum: 30_000,
            default: defaultSettings.pollIntervalMs,
          },
          jira: {
            type: 'object',
            default: defaultSettings.jira,
            required: ['clientId', 'projectKey', 'siteUrl'],
            additionalProperties: false,
            properties: {
              clientId: { type: 'string', default: '' },
              projectKey: { type: 'string', default: '' },
              siteUrl: { type: 'string', default: '' },
            },
          },
        },
      },
      jiraTokens: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            required: ['accessToken', 'refreshToken', 'expiresAt', 'cloudId', 'siteUrl'],
            additionalProperties: false,
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresAt: { type: 'number' },
              cloudId: { type: 'string' },
              siteUrl: { type: 'string' },
            },
          },
        ],
        default: null,
      },
      mergedPullRequests: {
        type: 'object',
        default: {},
        additionalProperties: {
          type: 'object',
          required: ['mergedAt', 'repositoryNameWithOwner', 'mergeCommitOid'],
          additionalProperties: false,
          properties: {
            mergedAt: { type: 'string' },
            repositoryNameWithOwner: { type: 'string' },
            mergeCommitOid: { type: 'string' },
            workflowCompletedAt: { type: 'string' },
          },
        },
      },
      mergeMethods: {
        type: 'object',
        default: {},
        additionalProperties: {
          type: 'string',
          enum: ['SQUASH', 'MERGE', 'REBASE'],
        },
      },
    },
  });

  return appStore;
};
