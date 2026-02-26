const { contextBridge, ipcRenderer } = require('electron');

// Intercept and clean document.title to remove Electron symbols
let originalTitleDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'title') ||
    Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'title');

if (originalTitleDescriptor) {
    Object.defineProperty(document, 'title', {
        get: function () {
            return originalTitleDescriptor.get.call(this);
        },
        set: function (value) {
            // Remove electron symbol (⚡) and clean the title
            const cleanTitle = value.replace(/⚡/g, '').replace(/\s+/g, ' ').trim() || 'Reson Studio';
            originalTitleDescriptor.set.call(this, cleanTitle);
        },
        configurable: true
    });
}

// Also watch for title changes via MutationObserver
const titleObserver = new MutationObserver(() => {
    if (document.title && document.title.includes('⚡')) {
        document.title = document.title.replace(/⚡/g, '').replace(/\s+/g, ' ').trim() || 'Reson Studio';
    }
});

// Start observing when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const titleElement = document.querySelector('title');
        if (titleElement) {
            titleObserver.observe(titleElement, { childList: true, characterData: true, subtree: true });
        }
    });
} else {
    const titleElement = document.querySelector('title');
    if (titleElement) {
        titleObserver.observe(titleElement, { childList: true, characterData: true, subtree: true });
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-toggle-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    toTray: () => ipcRenderer.invoke('window-to-tray'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveFile: (content) => ipcRenderer.invoke('save-file', content),
    saveFileSilent: (path, content) => ipcRenderer.invoke('save-file-silent', path, content),
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    // Audio export APIs
    saveAudioFile: (format) => ipcRenderer.invoke('save-audio-file', format),
    saveAudioBuffer: (filePath, base64Data) => ipcRenderer.invoke('save-audio-buffer', filePath, base64Data),
    // Project audio file management
    ensureDir: (dirPath) => ipcRenderer.invoke('ensure-dir', dirPath),
    readFileBinary: (filePath) => ipcRenderer.invoke('read-file-binary', filePath),
    fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
    pathJoin: (...parts) => ipcRenderer.invoke('path-join', ...parts)
});
