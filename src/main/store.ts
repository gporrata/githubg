import ElectronStore from 'electron-store';
import type {
  GithubgSettings,
  MergeMethod,
  MergedPullRequestTracking,
  TeamMember,
} from '../shared/settings';

export type AppStoreSchema = {
  teamMembers: TeamMember[];
  settings: GithubgSettings;
  mergedPullRequests: Record<string, MergedPullRequestTracking>;
  mergeMethods: Record<string, MergeMethod>;
};

const defaultSettings: GithubgSettings = {
  theme: 'system',
  pollIntervalMs: 120_000,
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
      mergedPullRequests: {},
      mergeMethods: {},
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
        },
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
