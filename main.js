const { app, BrowserWindow, ipcMain, dialog, shell, powerSaveBlocker } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let sleepBlockerId = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        backgroundColor: '#0f0f0f', // Matches your luxury dark theme
        titleBarStyle: 'hiddenInset', // Makes it look like a premium Mac/Win app
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Allows renderer.js to use 'require' for Python
        },
    });

    mainWindow.loadFile('index.html');

    // Optional: Open DevTools while you are building
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// --- IPC HANDLERS ---

// Select Folder
ipcMain.on('select-folder', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        event.reply('selected-folder', result.filePaths[0]);
    }
});

// Sleep Prevention
ipcMain.on('prevent-sleep', (event, shouldPrevent) => {
    if (shouldPrevent) {
        if (sleepBlockerId === null) {
            sleepBlockerId = powerSaveBlocker.start('prevent-app-suspension');
        }
    } else {
        if (sleepBlockerId !== null) {
            powerSaveBlocker.stop(sleepBlockerId);
            sleepBlockerId = null;
        }
    }
});

// Power Actions
ipcMain.on('power-action', (event, action) => {
    switch (action) {
        case 'shutdown': exec('shutdown /s /t 60'); break;
        case 'restart': exec('shutdown /r /t 60'); break;
        case 'hibernate': exec('shutdown /h'); break;
        case 'sleep': exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0'); break;
        case 'lock': exec('rundll32.exe user32.dll,LockWorkStation'); break;
        case 'exit': app.quit(); break;
    }
});

// Engine Update
ipcMain.on('update-engine', (event) => {
    const localExe = path.join(__dirname, 'resources', 'bin', 'yt-dlp.exe');
    
    // Try updating the local binary first as it's what the app uses
    let updateCmd = 'python -m pip install -U yt-dlp';
    if (require('fs').existsSync(localExe)) {
        updateCmd = `"${localExe}" -U`;
    }

    exec(updateCmd, (error, stdout, stderr) => {
        if (error) {
            let userFriendlyMsg = error.message;
            if (error.message.includes('WinError 32')) {
                userFriendlyMsg = "Security Alert: The engine core is currently locked. Please ensure all active processes are stopped and try the upgrade again.";
            }
            event.reply('engine-update-result', { success: false, message: userFriendlyMsg });
            return;
        }
        event.reply('engine-update-result', { success: true, message: "Success: Your media extraction engine has been upgraded to the latest professional version!" });
    });
});

// Focus Window
ipcMain.on('focus-window', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});