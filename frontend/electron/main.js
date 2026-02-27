const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, screen } = require('electron');
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
        show: false, // Don't show until ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Remove the application menu completely
    Menu.setApplicationMenu(null);

    // Maximize and show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
    });

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
            { name: 'Reson Project', extensions: ['reson'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    return result.filePaths;
});

// Open a project folder: user picks a folder, we find the .reson file inside
ipcMain.handle('open-folder-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Project Folder',
        properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
    }

    const folderPath = result.filePaths[0];
    try {
        // Find .reson file(s) in the selected folder
        const files = fs.readdirSync(folderPath);
        const resonFiles = files.filter(f => f.endsWith('.reson'));

        if (resonFiles.length === 0) {
            return { success: false, error: 'No .reson project file found in this folder.' };
        }

        // Use the first .reson file found
        const resonFilePath = path.join(folderPath, resonFiles[0]);
        const content = fs.readFileSync(resonFilePath, 'utf-8');

        return { success: true, filePath: resonFilePath, content };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Save project as a folder: shows folder-name dialog, creates folder, writes .reson inside
ipcMain.handle('save-file', async (event, content) => {
    // Ask user for a folder location + project name
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Project',
        defaultPath: 'project',
        filters: [
            { name: 'Reson Project Folder', extensions: ['*'] }
        ]
    });

    if (!filePath) return { canceled: true };

    try {
        // filePath is the folder the user chose (e.g. C:\Projects\MyProject)
        const projectDir = path.normalize(filePath);
        const projectName = path.basename(projectDir);
        const resonFilePath = path.join(projectDir, `${projectName}.reson`);

        // Create project directory
        fs.mkdirSync(projectDir, { recursive: true });

        // Write .reson JSON file inside
        fs.writeFileSync(resonFilePath, content);

        return { success: true, filePath: resonFilePath, projectDir };
    } catch (e) {
        return { success: false, error: e.message };
    }
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

// Audio export file dialog
ipcMain.handle('save-audio-file', async (event, format) => {
    const filters = format === 'mp3'
        ? [{ name: 'MP3 Audio', extensions: ['mp3'] }]
        : [{ name: 'WAV Audio', extensions: ['wav'] }];

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: `Export as ${format.toUpperCase()}`,
        defaultPath: `export.${format}`,
        filters: filters
    });

    if (canceled || !filePath) {
        return { canceled: true };
    }
    return { success: true, filePath };
});

// Save binary audio buffer to file (receives base64 string)
ipcMain.handle('save-audio-buffer', async (event, filePath, base64Data) => {
    try {
        const normalizedPath = path.normalize(filePath);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(normalizedPath, buffer);
        return { success: true, filePath: normalizedPath };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Ensure a directory exists (recursive mkdir)
ipcMain.handle('ensure-dir', async (event, dirPath) => {
    try {
        const normalizedPath = path.normalize(dirPath);
        fs.mkdirSync(normalizedPath, { recursive: true });
        return { success: true, path: normalizedPath };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Read a binary file and return as base64 string
ipcMain.handle('read-file-binary', async (event, filePath) => {
    try {
        const normalizedPath = path.normalize(filePath);
        const buffer = fs.readFileSync(normalizedPath);
        // Return as base64 string — efficient and safe for IPC transfer
        return { success: true, data: buffer.toString('base64') };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Check if a file exists
ipcMain.handle('file-exists', async (event, filePath) => {
    try {
        const normalizedPath = path.normalize(filePath);
        return fs.existsSync(normalizedPath);
    } catch (e) {
        return false;
    }
});

// Resolve a path using path.join (so renderer doesn't need to know OS separator)
ipcMain.handle('path-join', async (event, ...parts) => {
    return path.join(...parts);
});

// Get the directory name of a file path
ipcMain.handle('path-dirname', async (event, filePath) => {
    return path.dirname(filePath);
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