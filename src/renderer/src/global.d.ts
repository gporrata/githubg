import type { MergeMethod } from '../../shared/settings';

declare global {
  interface Window {
    githubg: {
      appName: string;
      getMergeMethod: (pullRequestId: string) => Promise<MergeMethod>;
      setMergeMethod: (pullRequestId: string, mergeMethod: MergeMethod) => Promise<MergeMethod>;
      mergePullRequest: (pullRequestId: string, mergeMethod: MergeMethod) => Promise<void>;
    };
  }
}
