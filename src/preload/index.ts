import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('githubg', {
  appName: 'githubg',
});
