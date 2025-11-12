// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import {
  contextBridge,
  ipcRenderer,
  IpcRendererEvent,
  webUtils,
} from 'electron';

export type Channels =
  | 'isWorkerAvailable'
  | 'fetchUrl'
  | 'isDirectory'
  | 'resolveRelativePaths'
  | 'set-language'
  | 'setZoomFactor'
  | 'global-shortcuts-enabled'
  | 'show-main-window'
  | 'create-new-window'
  | 'file-changed'
  | 'description-changed'
  | 'quitApp'
  | 'focus-window'
  | 'getDevicePaths'
  | 'readMacOSTags'
  | 'reloadWindow'
  | 'watchFolder'
  | 'newChatSession'
  | 'newChatMessage'
  | 'ChatMessage'
  | 'PullModel'
  | 'postRequest'
  | 'listDirectoryPromise'
  | 'listMetaDirectoryPromise'
  | 'getPropertiesPromise'
  | 'checkDirExist'
  | 'checkFileExist'
  | 'createDirectoryPromise'
  | 'copyFilePromiseOverwrite'
  | 'renameFilePromise'
  | 'renameDirectoryPromise'
  | 'copyDirectoryPromise'
  | 'moveDirectoryPromise'
  | 'loadTextFilePromise'
  | 'getFileContentPromise'
  | 'saveFilePromise'
  | 'saveTextFilePromise'
  | 'saveBinaryFilePromise'
  | 'deleteFilePromise'
  | 'deleteDirectoryPromise'
  | 'openDirectory'
  | 'openFile'
  | 'openUrl'
  | 'selectDirectoryDialog'
  | 'load-extensions'
  | 'removeExtension'
  | 'getUserDataDir'
  | 'unZip'
  | 'getDirProperties'
  | 'folderChanged'
  | 'set_extensions'
  | 'play-pause'
  | 'cmd'
  | 'toggle-about-dialog'
  | 'show-create-directory-dialog'
  | 'toggle-keys-dialog'
  | 'toggle-license-dialog'
  | 'toggle-open-link-dialog'
  | 'new-text-file'
  | 'new-md-file'
  | 'toggle-onboarding-dialog'
  | 'toggle-settings-dialog'
  | 'toggle-third-party-libs-dialog'
  | 'perspective'
  | 'panels'
  | 'history'
  | 'progress'
  | 'uploadAbort'
  | 'getOllamaModels'
  | 'newOllamaMessage'
  | 'pullOllamaModel'
  | 'deleteOllamaModel'
  | 'startup-finished'
  | 'getAuthor'
  | 'cancelRequest'
  | 'ai-keys-init'
  | 'ai-key-save'
  | 'ai-call-deepseek'
  | 'ai-keys-get-all'
  | 'ai-key-get-active'
  | 'ai-key-set-active'
  | 'ai-key-delete'
  | 'database:create-connection'
  | 'database:disconnect'
  | 'database:reconnect'
  | 'database:reconnect-debug'
  | 'database:execute-query'
  | 'database:get-connections'
  | 'database:get-connection'
  | 'database:set-active-connection'
  | 'database:get-active-connection'
  | 'database:list-databases'
  | 'database:list-tables';

// Signal that main has registered database handlers and renderer may safely invoke them
type DatabaseSignals = 'database:handlers-ready';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    invoke(command: Channels, ...args: unknown[]) {
      return ipcRenderer.invoke(command, ...args);
    },
    getSync(command: Channels, ...args: unknown[]) {
      return ipcRenderer.sendSync(command, ...args);
    },
    removeAllListeners(channel: string) {
      ipcRenderer.removeAllListeners(channel);
    },
    startDrag: (fileName) => ipcRenderer.send('ondragstart', fileName),
    getPathForFile(file: File) {
      return webUtils.getPathForFile(file);
    },
  },
  database: {
    createConnection: (name: string, type: string, config: any, database?: any) =>
      ipcRenderer.invoke('database:create-connection', { name, type, config, database }),
    disconnect: (connectionId: string) =>
      ipcRenderer.invoke('database:disconnect', connectionId),
    reconnect: (connectionId: string) =>
      ipcRenderer.invoke('database:reconnect', connectionId),
    reconnectDebug: (connectionId: string) =>
      ipcRenderer.invoke('database:reconnect-debug', connectionId),
    // Send-style fallback: send a message and wait for a reply event
    reconnectSend: (connectionId: string) => {
      return new Promise((resolve) => {
        const replyChannel = 'database:reconnect-send-reply';
        const handler = (_event: IpcRendererEvent, resp: any) => {
          resolve(resp);
        };
        ipcRenderer.once(replyChannel, handler);
        ipcRenderer.send('database:reconnect-send', connectionId);
        // Add a timeout in case reply never arrives
        setTimeout(() => {
          ipcRenderer.removeListener(replyChannel, handler);
          resolve({ success: false, error: 'reconnectSend timeout' });
        }, 5000);
      });
    },
    // Let renderers wait for main to report that DB handlers are ready.
    // Uses a polling invoke to avoid missed one-shot events.
    waitForHandlers: async (timeoutMs = 5000) => {
      const start = Date.now();
      // Poll main for the handlers-status until true or timeout
      // @ts-ignore
      while (Date.now() - start < timeoutMs) {
        try {
          // ask main whether handlers are registered
          // @ts-ignore
          const ready = await ipcRenderer.invoke('database:handlers-status');
          if (ready) return true;
        } catch (e) {
          // ignore transient invoke errors and retry
        }
        // small backoff
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 150));
      }
      return false;
    },
    executeQuery: (connectionId: string, query: string) =>
      ipcRenderer.invoke('database:execute-query', { connectionId, query }),
    getConnections: () =>
      ipcRenderer.invoke('database:get-connections'),
    getConnection: (connectionId: string) =>
      ipcRenderer.invoke('database:get-connection', connectionId),
    setActiveConnection: (connectionId: string) =>
      ipcRenderer.invoke('database:set-active-connection', connectionId),
    getActiveConnection: () =>
      ipcRenderer.invoke('database:get-active-connection'),
    listDatabases: (connectionId: string) =>
      ipcRenderer.invoke('database:list-databases', connectionId),
    listTables: (connectionId: string, database?: string, schema?: string) =>
      ipcRenderer.invoke('database:list-tables', { connectionId, database, schema }),
  },
};

contextBridge.exposeInMainWorld('electronIO', electronHandler);
/*contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
})*/
export type ElectronHandler = typeof electronHandler;
