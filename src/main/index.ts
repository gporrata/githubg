import { app, BrowserWindow, dialog } from 'electron';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { GithubAuthError, initializeGithubAuth } from './githubAuth';
import { registerIpcHandlers } from './ipc';

const execFileAsync = promisify(execFile);
const appProcessName = 'githubg';
const placeholderOpenPullRequestCount = 0;

const getIconPath = (): string => join(app.getAppPath(), 'resources/icon.png');

const parsePids = (raw: string): number[] =>
  raw
    .split(/\s+/)
    .map((value) => Number.parseInt(value, 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);

const findExistingGithubgPids = async (): Promise<number[]> => {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        `Get-Process -Name ${appProcessName} -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${process.pid} } | ForEach-Object { $_.Id }`,
      ]);

      return parsePids(stdout);
    }

    const { stdout } = await execFileAsync('pgrep', ['-x', appProcessName]);
    return parsePids(stdout);
  } catch {
    return [];
  }
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const killExistingGithubgProcesses = async (): Promise<void> => {
  const pids = await findExistingGithubgPids();

  if (pids.length === 0) {
    return;
  }

  for (const pid of pids) {
    process.kill(pid, 'SIGTERM');
  }

  await wait(350);

  for (const pid of pids) {
    if (isProcessAlive(pid)) {
      process.kill(pid, 'SIGKILL');
    }
  }
};

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: 'githubg',
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
};

const setOpenPullRequestBadge = (count: number): void => {
  const badge = count > 0 ? String(count) : '';

  if (process.platform === 'darwin') {
    app.dock.setIcon(getIconPath());
    app.dock.setBadge(badge);
    return;
  }

  app.setBadgeCount(count);
};

void killExistingGithubgProcesses()
  .then(() => initializeGithubAuth())
  .then(() => app.whenReady())
  .then(() => {
    registerIpcHandlers();
    setOpenPullRequestBadge(placeholderOpenPullRequestCount);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error: unknown) => {
    const message =
      error instanceof GithubAuthError
        ? error.message
        : 'githubg could not start because an unexpected startup error occurred.';

    dialog.showErrorBox('githubg startup failed', message);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
