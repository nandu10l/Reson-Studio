const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, screen, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');

let mainWindow = null;
let splashWindow = null;
let tray = null;
let backendProcess = null;

// --- Icon helpers ---
function getIconPath() {
    if (isDev) {
        // In development, use the icon from public/
        return path.join(__dirname, '..', 'public', 'icon.png');
    }
    // In production, use the icon from build resources
    return path.join(process.resourcesPath, 'icon.png');
}

// --- Backend management ---
function getBackendPath() {
    if (isDev) {
        return null; // In dev mode, we assume backend is started separately or via concurrently
    }
    // In production, the backend exe is in resources
    return path.join(process.resourcesPath, 'backend', 'backend.exe');
}

function startBackend() {
    return new Promise((resolve, reject) => {
        if (isDev) {
            // In dev mode, start the Python backend directly
            const backendDir = path.join(__dirname, '..', '..', 'backend');
            const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

            console.log(`[Backend] Starting dev backend from: ${backendDir}`);
            backendProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'], {
                cwd: backendDir,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });

            backendProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[Backend] ${output}`);
                if (output.includes('Application startup complete') || output.includes('Uvicorn running')) {
                    resolve();
                }
            });

            backendProcess.stderr.on('data', (data) => {
                const output = data.toString();
                console.log(`[Backend ERR] ${output}`);
                // Uvicorn logs startup info to stderr
                if (output.includes('Application startup complete') || output.includes('Uvicorn running')) {
                    resolve();
                }
            });

            backendProcess.on('error', (err) => {
                console.error(`[Backend] Failed to start: ${err.message}`);
                reject(err);
            });

            backendProcess.on('exit', (code) => {
                console.log(`[Backend] Exited with code ${code}`);
                backendProcess = null;
            });

            // Resolve after a timeout in case we miss the startup message
            setTimeout(() => resolve(), 8000);
        } else {
            // In production, start the bundled backend exe
            const backendExe = getBackendPath();
            if (!backendExe || !fs.existsSync(backendExe)) {
                console.warn('[Backend] No bundled backend found, skipping...');
                resolve();
                return;
            }

            console.log(`[Backend] Starting production backend: ${backendExe}`);
            backendProcess = spawn(backendExe, [], {
                cwd: path.dirname(backendExe),
                stdio: ['pipe', 'pipe', 'pipe']
            });

            backendProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[Backend] ${output}`);
                if (output.includes('Application startup complete') || output.includes('Uvicorn running')) {
                    resolve();
                }
            });

            backendProcess.stderr.on('data', (data) => {
                const output = data.toString();
                console.log(`[Backend ERR] ${output}`);
                if (output.includes('Application startup complete') || output.includes('Uvicorn running')) {
                    resolve();
                }
            });

            backendProcess.on('error', (err) => {
                console.error(`[Backend] Failed to start: ${err.message}`);
                resolve(); // Don't block the app even if backend fails
            });

            backendProcess.on('exit', (code) => {
                console.log(`[Backend] Exited with code ${code}`);
                backendProcess = null;
            });

            // Resolve after a timeout
            setTimeout(() => resolve(), 10000);
        }
    });
}

function stopBackend() {
    if (backendProcess) {
        console.log('[Backend] Stopping backend process...');
        if (process.platform === 'win32') {
            // On Windows, use taskkill to kill the process tree
            spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t'], { shell: true });
        } else {
            backendProcess.kill('SIGTERM');
        }
        backendProcess = null;
    }
}

// --- Splash screen ---
function createSplashWindow() {
    const iconPath = getIconPath();

    splashWindow = new BrowserWindow({
        width: 420,
        height: 320,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Load inline splash HTML
    const splashHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                background: transparent;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                font-family: 'Segoe UI', 'DM Sans', sans-serif;
                overflow: hidden;
                -webkit-app-region: drag;
            }
            .splash-container {
                background: linear-gradient(145deg, #0a0a1a 0%, #111128 50%, #0d0d24 100%);
                border-radius: 20px;
                padding: 48px 40px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(99, 102, 241, 0.15);
                border: 1px solid rgba(99, 102, 241, 0.2);
                width: 400px;
                position: relative;
                overflow: hidden;
            }
            .splash-container::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: conic-gradient(from 0deg, transparent, rgba(99, 102, 241, 0.05), transparent, rgba(168, 85, 247, 0.05), transparent);
                animation: rotate 4s linear infinite;
            }
            @keyframes rotate {
                to { transform: rotate(360deg); }
            }
            .content {
                position: relative;
                z-index: 1;
            }
            .icon-container {
                width: 80px;
                height: 80px;
                margin: 0 auto 20px;
                border-radius: 18px;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
            }
            .icon-container img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .app-name {
                font-size: 28px;
                font-weight: 700;
                color: #ffffff;
                margin-bottom: 8px;
                letter-spacing: 0.5px;
            }
            .app-name span {
                background: linear-gradient(135deg, #818cf8, #a78bfa, #c084fc);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .status {
                font-size: 13px;
                color: rgba(255,255,255,0.5);
                margin-top: 24px;
            }
            .loader {
                width: 160px;
                height: 3px;
                background: rgba(255,255,255,0.08);
                border-radius: 3px;
                margin: 16px auto 0;
                overflow: hidden;
            }
            .loader-bar {
                width: 40%;
                height: 100%;
                background: linear-gradient(90deg, #6366f1, #a855f7, #6366f1);
                border-radius: 3px;
                animation: loading 1.5s ease-in-out infinite;
            }
            @keyframes loading {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(350%); }
            }
        </style>
    </head>
    <body>
        <div class="splash-container">
            <div class="content">
                <div class="icon-container">
                    <img src="icon.png" alt="Reson Studio" onerror="this.style.display='none'" />
                </div>
                <div class="app-name">Reson <span>Studio</span></div>
                <div class="status">Starting up...</div>
                <div class="loader"><div class="loader-bar"></div></div>
            </div>
        </div>
    </body>
    </html>`;

    // Write splash to a temp file in public dir (for icon.png access)
    const splashPath = path.join(__dirname, '..', 'public', '_splash.html');
    fs.writeFileSync(splashPath, splashHTML);
    splashWindow.loadFile(splashPath);

    splashWindow.on('closed', () => {
        splashWindow = null;
    });

    return splashWindow;
}

function closeSplash() {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
    }
    // Clean up temp splash file
    try {
        const splashPath = path.join(__dirname, '..', 'public', '_splash.html');
        if (fs.existsSync(splashPath)) fs.unlinkSync(splashPath);
    } catch (e) { /* ignore */ }
}

// --- Main window ---
function createWindow() {
    const iconPath = getIconPath();

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Reson Studio',
        frame: false, // Completely remove default titlebar
        titleBarStyle: 'hidden', // Additional setting for macOS
        autoHideMenuBar: true, // Hide the menu bar
        show: false, // Don't show until ready
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
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
        closeSplash();
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
    const iconPath = getIconPath();
    if (!fs.existsSync(iconPath)) return;

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
app.whenReady().then(async () => {
    // Show splash screen while backend starts
    createSplashWindow();

    // Start the backend
    try {
        await startBackend();
        console.log('[App] Backend started successfully');
    } catch (err) {
        console.error('[App] Backend failed to start:', err);
    }

    // Create the main window
    createWindow();
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

// Clean up tray and backend on quit
app.on('before-quit', () => {
    stopBackend();
    if (tray) {
        tray.destroy();
        tray = null;
    }
});

// Also stop backend if the app crashes
process.on('exit', () => {
    stopBackend();
});