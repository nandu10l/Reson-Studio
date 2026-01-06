const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow = null;
let tray = null;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Reson Studio',
        frame: false, // Completely remove default titlebar
        titleBarStyle: 'hidden', // Additional setting for macOS
        autoHideMenuBar: true, // Hide the menu bar
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Remove the application menu completely
    Menu.setApplicationMenu(null);

    // Load the index.html from a url in development
    // or the local file in production.
    mainWindow.loadURL(
        isDev
            ? 'http://localhost:3000'
            : `file://${path.join(__dirname, '../build/index.html')}`
    );

    // Open the DevTools in development mode.
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Prevent Electron from adding symbols to the title
    // Use setInterval to continuously clean the title (aggressive approach)
    const cleanTitleInterval = setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            const currentTitle = mainWindow.getTitle();
            // Remove any electron symbols (⚡) and other unwanted characters
            const cleanTitle = currentTitle.replace(/⚡/g, '').replace(/\s+/g, ' ').trim() || 'Reson Studio';
            if (currentTitle !== cleanTitle) {
                mainWindow.setTitle(cleanTitle);
            }
        } else {
            clearInterval(cleanTitleInterval);
        }
    }, 50); // Check every 50ms for faster response

    // Listen for title updates and clean them
    mainWindow.webContents.on('page-title-updated', (event, title) => {
        event.preventDefault();
        // Remove any electron symbols (⚡) and other unwanted characters
        const cleanTitle = title.replace(/⚡/g, '').replace(/\s+/g, ' ').trim() || 'Reson Studio';
        mainWindow.setTitle(cleanTitle);
    });

    // Also set title immediately after load
    mainWindow.webContents.on('did-finish-load', () => {
        const currentTitle = mainWindow.getTitle();
        const cleanTitle = currentTitle.replace(/⚡/g, '').replace(/\s+/g, ' ').trim() || 'Reson Studio';
        if (currentTitle !== cleanTitle) {
            mainWindow.setTitle(cleanTitle);
        }
    });

    // Clean up interval when window is closed
    mainWindow.on('closed', () => {
        clearInterval(cleanTitleInterval);
        mainWindow = null;
    });
}

function createTray() {
    if (tray) return;
    // Use a default icon or skip if not available
    const iconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show', click: () => { if (mainWindow) mainWindow.show(); } },
        { label: 'Quit', click: () => { app.quit(); } }
    ]);
    tray.setToolTip('Reson Studio');
    tray.setContextMenu(contextMenu);
}

// IPC handlers for window controls
ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});

ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-to-tray', () => {
    if (!mainWindow) return;
    mainWindow.hide();
    createTray();
});

ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    return result.filePaths;
});

ipcMain.handle('save-file', async (event, content) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Project',
        defaultPath: 'project.reson',
        filters: [
            { name: 'Reson Project', extensions: ['reson'] },
            { name: 'JSON Project', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (filePath) {
        fs.writeFileSync(filePath, content);
        return { success: true, filePath };
    }
    return { canceled: true };
});

ipcMain.handle('save-file-silent', async (event, filePath, content) => {
    try {
        fs.writeFileSync(filePath, content);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
    createWindow();
    // createTray(); // create tray on demand
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Clean up tray on quit
app.on('before-quit', () => {
    if (tray) {
        tray.destroy();
        tray = null;
    }
});