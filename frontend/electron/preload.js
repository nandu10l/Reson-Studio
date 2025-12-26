const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-toggle-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  toTray: () => ipcRenderer.invoke('window-to-tray'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
  saveFileSilent: (path, content) => ipcRenderer.invoke('save-file-silent', path, content)
});
