import type { GithubgSettings, MergeMethod, TeamMember, ThemeId } from '../../shared/settings';
import type { PullRequestSummary } from '../../shared/pullRequest';

declare global {
  interface Window {
    githubg: {
      appName: string;
      getSettings: () => Promise<GithubgSettings>;
      setTheme: (theme: ThemeId) => Promise<GithubgSettings>;
      listOpenPullRequests: () => Promise<PullRequestSummary[]>;
      listReviewPullRequests: () => Promise<PullRequestSummary[]>;
      listKnownUsers: () => Promise<TeamMember[]>;
      listTeamMembers: () => Promise<TeamMember[]>;
      addTeamMember: (member: TeamMember) => Promise<TeamMember[]>;
      removeTeamMember: (login: string) => Promise<TeamMember[]>;
      getMergeMethod: (pullRequestId: string) => Promise<MergeMethod>;
      setMergeMethod: (pullRequestId: string, mergeMethod: MergeMethod) => Promise<MergeMethod>;
      mergePullRequest: (pullRequestId: string, mergeMethod: MergeMethod) => Promise<void>;
      requestPullRequestReview: (pullRequestId: string, userIds: string[]) => Promise<void>;
    };
  }
}
