const { app, BrowserWindow, ipcMain, dialog, shell, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const db = require('./database');

let mainWindow;
let awakeId = null;
let sleepBlockerId = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        backgroundColor: '#0f0f0f',
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile('index.html');
}

async function migrateData() {
    console.log("Checking for legacy data migration...");
    const tasksPath = path.join(__dirname, 'tasks.json');
    const settingsPath = path.join(__dirname, 'settings.json');

    if (fs.existsSync(settingsPath)) {
        try {
            console.log("Migrating settings...");
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            for (const [k, v] of Object.entries(settings)) {
                await db.saveSetting(k, v);
            }
            fs.renameSync(settingsPath, settingsPath + '.bak');
        } catch (e) { console.error("Settings migration error", e); }
    }

    if (fs.existsSync(tasksPath)) {
        try {
            console.log("Migrating tasks...");
            const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
            for (const task of tasks) {
                await db.upsertTask(task);
            }
            fs.renameSync(tasksPath, tasksPath + '.bak');
        } catch (e) { console.error("Tasks migration error", e); }
    }
}

app.whenReady().then(async () => {
    await db.initDb();
    await migrateData();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// --- DATABASE IPC HANDLERS ---
ipcMain.on('db-load-all', async (event) => {
    const tasks = await db.getAllTasks();
    const settings = await db.getSettings();
    event.reply('db-loaded-all', { tasks, settings });
});

ipcMain.on('db-save-task', async (event, task) => {
    await db.upsertTask(task);
});

ipcMain.on('db-delete-task', async (event, id) => {
    await db.deleteTask(id);
});

ipcMain.on('db-clear-tasks', async () => {
    await db.clearAllTasks();
});

ipcMain.on('db-save-settings', async (event, settings) => {
    for (const [k, v] of Object.entries(settings)) {
        await db.saveSetting(k, v);
    }
});

// --- NATIVE IPC HANDLERS ---
ipcMain.on('select-folder', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (!result.canceled && result.filePaths.length > 0) {
        event.reply('selected-folder', result.filePaths[0]);
    }
});

ipcMain.on('prevent-sleep', (event, shouldPrevent) => {
    if (shouldPrevent && !sleepBlockerId) {
        sleepBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    } else if (!shouldPrevent && sleepBlockerId) {
        powerSaveBlocker.stop(sleepBlockerId);
        sleepBlockerId = null;
    }
});

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

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

ipcMain.on('set-autolaunch', (event, enable) => {
    app.setLoginItemSettings({ openAtLogin: enable, path: app.getPath('exe') });
});

ipcMain.on('set-keep-awake', (event, enable) => {
    if (enable && !awakeId) awakeId = powerSaveBlocker.start('prevent-app-suspension');
    else if (!enable && awakeId) {
        powerSaveBlocker.stop(awakeId);
        awakeId = null;
    }
});

ipcMain.on('select-sound-file', async (event, type) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        event.reply('selected-sound-file', { type, path: result.filePaths[0] });
    }
});

ipcMain.on('update-engine', (event) => {
    exec('pip install -U yt-dlp', (error) => {
        event.reply('engine-update-result', { 
            success: !error, 
            message: error ? `Error: ${error.message}` : "Success: Core engine upgraded." 
        });
    });
});

ipcMain.on('fetch-thumbnail', async (event, url) => {
    const https = require('https');
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }}, (res) => {
        const data = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => {
            const buffer = Buffer.concat(data);
            event.reply('thumbnail-fetched', { success: true, base64: `data:${res.headers['content-type']};base64,${buffer.toString('base64')}` });
        });
    }).on('error', err => event.reply('thumbnail-fetched', { success: false, error: err.message }));
});

ipcMain.on('select-av-file', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Executables', extensions: ['exe', 'com', 'bat', 'cmd'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        event.reply('selected-av-file', result.filePaths[0]);
    }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });