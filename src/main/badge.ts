import { app } from 'electron';
import { join } from 'node:path';

export const getIconPath = (): string => join(app.getAppPath(), 'resources/icon.png');

export const setOpenPullRequestBadge = (count: number): void => {
  const badge = count > 0 ? String(count) : '';

  if (process.platform === 'darwin') {
    app.dock.setIcon(getIconPath());
    app.dock.setBadge(badge);
    return;
  }

  app.setBadgeCount(count);
};
