import { app, BrowserWindow, dialog, shell } from 'electron';
import { join } from 'node:path';
import { getIconPath, setOpenPullRequestBadge } from './badge';
import { GithubAuthError, initializeGithubAuth } from './githubAuth';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;

app.setName('githubg');

const hasSingleInstanceLock = app.requestSingleInstanceLock();

const openInDefaultBrowser = (url: string): boolean => {
  let protocol: string;

  try {
    protocol = new URL(url).protocol;
  } catch {
    return false;
  }

  if (protocol !== 'http:' && protocol !== 'https:') {
    return false;
  }

  void shell.openExternal(url);
  return true;
};

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return openInDefaultBrowser(url) ? { action: 'deny' } : { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url === mainWindow?.webContents.getURL()) {
      return;
    }

    if (openInDefaultBrowser(url)) {
      event.preventDefault();
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const showMainWindow = (): void => {
  if (!mainWindow) {
    if (app.isReady()) {
      createWindow();
    }

    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  mainWindow.focus();
};

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  void initializeGithubAuth()
    .then(() => app.whenReady())
    .then(() => {
      registerIpcHandlers();
      setOpenPullRequestBadge([]);
      createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        } else {
          showMainWindow();
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
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
