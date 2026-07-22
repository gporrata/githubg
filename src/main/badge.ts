import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import {
  getApprovedPullRequestBlockedReason,
  hasPullRequestConflicts,
  type PullRequestSummary,
} from '../shared/pullRequest';

type AppIconColor = 'red' | 'green' | 'light-blue' | 'grey' | 'white';

const iconFilenames = {
  red: 'icon-red.png',
  green: 'icon-green.png',
  'light-blue': 'icon-light-blue.png',
  grey: 'icon-grey.png',
  white: 'icon-white.png',
} satisfies Record<AppIconColor, string>;

const hasUnaddressedRequestedChanges = (pullRequest: PullRequestSummary): boolean => {
  if (pullRequest.reviewDecision !== 'CHANGES_REQUESTED') {
    return false;
  }

  const activeThreads = pullRequest.commentThreads.filter(
    (thread) => !thread.isResolved && !thread.isOutdated,
  );

  return activeThreads.length > 0 || pullRequest.commentThreads.length === 0;
};

const getIconColor = (pullRequests: PullRequestSummary[]): AppIconColor => {
  if (
    pullRequests.some((pullRequest) => {
      const approvedBlockedReason = getApprovedPullRequestBlockedReason(pullRequest);

      return (
        hasPullRequestConflicts(pullRequest) ||
        approvedBlockedReason === 'failed-checks' ||
        approvedBlockedReason === 'out-of-date'
      );
    })
  ) {
    return 'red';
  }

  if (pullRequests.some(hasUnaddressedRequestedChanges)) {
    return 'red';
  }

  if (pullRequests.some((pullRequest) => pullRequest.canBeMerged)) {
    return 'green';
  }

  if (
    pullRequests.some(
      (pullRequest) =>
        pullRequest.state === 'MERGED' || pullRequest.hasActiveActions || pullRequest.mergeInProgress,
    )
  ) {
    return 'light-blue';
  }

  if (pullRequests.length > 0) {
    return 'grey';
  }

  return 'white';
};

export const getIconPath = (color: AppIconColor = 'white'): string => {
  const iconFilename = iconFilenames[color];
  return app.isPackaged
    ? join(process.resourcesPath, iconFilename)
    : join(app.getAppPath(), 'resources', iconFilename);
};

export const setOpenPullRequestBadge = (pullRequests: PullRequestSummary[]): void => {
  const count = pullRequests.filter((pullRequest) => pullRequest.state === 'OPEN').length;
  const badge = count > 0 ? String(count) : '';
  const iconPath = getIconPath(getIconColor(pullRequests));

  for (const browserWindow of BrowserWindow.getAllWindows()) {
    browserWindow.setIcon(iconPath);
  }

  if (process.platform === 'darwin') {
    app.dock.setIcon(iconPath);
    app.dock.setBadge(badge);
    return;
  }

  app.setBadgeCount(count);
};
