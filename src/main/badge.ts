import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import type { PullRequestSummary } from '../shared/pullRequest';

type AppIconColor = 'red' | 'green' | 'light-blue' | 'white';

const iconFilenames = {
  red: 'icon-red.png',
  green: 'icon-green.png',
  'light-blue': 'icon-light-blue.png',
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
