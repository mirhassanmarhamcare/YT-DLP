const { spawn } = require('child_process');
const { ipcRenderer, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// DOM Elements
const downloadList = document.getElementById('download-list');
const emptyState = document.getElementById('empty-state');
const statusBar = document.getElementById('status-bar');
const searchInput = document.getElementById('search-input');

// Add URL Modal
const modalOverlay = document.getElementById('modal-overlay');
const addUrlBtn = document.getElementById('add-url-btn');
const modalCancel = document.getElementById('modal-cancel');
const modalDownload = document.getElementById('modal-download');
const modalDownloadLater = document.getElementById('modal-download-later');
const modalQueueSelect = document.getElementById('modal-queue-select');
const modalUrl = document.getElementById('modal-url');
const modalRes = document.getElementById('modal-res');
const modalAnalyzeBtn = document.getElementById('modal-analyze-btn');
const modalAnalysisStatus = document.getElementById('modal-analysis-status');
const modalInfoSection = document.getElementById('modal-info-section');
const modalQualityGroup = document.getElementById('modal-quality-group');
const modalVideoTitle = document.getElementById('modal-video-title');
const modalVideoAuthor = document.getElementById('modal-video-author');
const modalVideoDuration = document.getElementById('modal-video-duration');
const modalThumbnail = document.getElementById('modal-thumbnail');
const modalAudioOnly = document.getElementById('modal-audio-only');
const playlistGroup = document.getElementById('playlist-group');
const playlistItems = document.getElementById('playlist-items');
const playlistSelectAll = document.getElementById('playlist-select-all');

// Options Modal
const optionsOverlay = document.getElementById('options-overlay');
const optionsBtn = document.getElementById('options-btn');
const optionsClose = document.getElementById('options-close');
const optionsSave = document.getElementById('options-save');
const settingsTabs = document.querySelectorAll('.settings-tab');
const tabPanes = document.querySelectorAll('.tab-pane');
const settingsPathInput = document.getElementById('settings-path');
const settingsSpeedLimit = document.getElementById('settings-speed-limit');
const settingsBrowse = document.getElementById('settings-browse');
const settingsClear = document.getElementById('settings-clear');
const engineUpdateBtn = document.getElementById('engine-update-btn');

// Scheduler Modal
const schedulerOverlay = document.getElementById('scheduler-overlay');
const schedulerBtn = document.getElementById('scheduler-btn');
const schedulerClose = document.getElementById('scheduler-close');
const schedulerSave = document.getElementById('scheduler-save');
const schedulerCloseBtn = document.getElementById('scheduler-close-btn');
const schedulerNewQueue = document.getElementById('scheduler-new-queue');
const schedStartTime = document.getElementById('sched-start-time');
const schedStopTime = document.getElementById('sched-stop-time');
const schedPowerAction = document.getElementById('sched-power-action');

// Advanced Setting Elements
const optionsCancel = document.getElementById('options-cancel');
const settingShowStartDialog = document.getElementById('setting-show-start-dialog');
const settingShowCompleteDialog = document.getElementById('setting-show-complete-dialog');
const settingImmediateDownload = document.getElementById('setting-immediate-download');
const settingDuplicateAction = document.getElementById('setting-duplicate-action');
const btnRename = document.getElementById('btn-rename');
const btnOverwrite = document.getElementById('btn-overwrite');
const settingEnableSounds = document.getElementById('setting-enable-sounds');
const soundComplete = document.getElementById('sound-complete');
const soundFailed = document.getElementById('sound-failed');
const browseSoundComplete = document.getElementById('browse-sound-complete');
const browseSoundFailed = document.getElementById('browse-sound-failed');
const settingStartLogin = document.getElementById('setting-start-login');
const settingKeepAwake = document.getElementById('setting-keep-awake');
const settingRunCommand = document.getElementById('setting-run-command');
const settingAntivirusScan = document.getElementById('setting-antivirus-scan');
const settingCommandStr = document.getElementById('setting-command-str');
const settingAvPath = document.getElementById('setting-av-path');
const browseAv = document.getElementById('browse-av');
const antivirusInputGroup = document.getElementById('antivirus-input-group');

// Queue & Scheduler Elements
const settingMaxConcurrent = document.getElementById('setting-max-concurrent');
const maxConcurrentVal = document.getElementById('max-concurrent-val');

// Toolbar Buttons
const resumeBtn = document.getElementById('resume-btn');
const stopBtn = document.getElementById('stop-btn');
const stopAllBtn = document.getElementById('stop-all-btn');
const deleteBtn = document.getElementById('delete-btn');
const folderBtn = document.getElementById('change-folder-btn');
const pauseBtn = document.getElementById('pause-btn');
const selectAllCheckbox = document.getElementById('select-all-checkbox');

// Selection State
let selectedTaskIds = new Set();

// Context Menu
const contextMenu = document.getElementById('context-menu');
const ctxOpen = document.getElementById('ctx-open');
const ctxCopy = document.getElementById('ctx-copy');
const ctxRedownload = document.getElementById('ctx-redownload');
const ctxDelete = document.getElementById('ctx-delete');
const ctxMoveUp = document.getElementById('ctx-move-up');
const ctxMoveDown = document.getElementById('ctx-move-down');

// Sidebar
const navItems = document.querySelectorAll('.nav-item');

// Custom Alert Elements
const customAlertOverlay = document.getElementById('custom-alert-overlay');
const alertTitle = document.getElementById('alert-title');
const alertMessage = document.getElementById('alert-message');
const alertOkBtn = document.getElementById('alert-ok-btn');
const alertCancelBtn = document.getElementById('alert-cancel-btn');
const alertOpenFileBtn = document.getElementById('alert-open-file-btn');
const alertOpenFolderBtn = document.getElementById('alert-open-folder-btn');
const alertDeleteDiskBtn = document.getElementById('alert-delete-disk-btn');
const alertQueueSelect = document.getElementById('alert-queue-select');
const alertSvg = document.getElementById('alert-svg');
const notificationArea = document.getElementById('notification-area');

let alertCallback = null;
let alertFileCallback = null;
let alertFolderCallback = null;
let alertDeleteDiskCallback = null;

// --- WINDOW CONTROLS ---
document.getElementById('btn-win-minimize')?.addEventListener('click', () => {
    ipcRenderer.send('window-minimize');
});
document.getElementById('btn-win-maximize')?.addEventListener('click', () => {
    ipcRenderer.send('window-maximize');
});
document.getElementById('btn-win-close')?.addEventListener('click', () => {
    ipcRenderer.send('window-close');
});

// State
let appSettings = {
    downloadPath: __dirname,
    speedLimit: "0",
    maxConcurrent: 5,
    scheduler: { 
        active: false,
        startActive: false, startTime: '02:00',
        stopActive: false, stopTime: '07:30',
        powerActive: false, powerAction: 'shutdown',
        qLimit: 1
    },
    // Advanced Settings
    showStartDialog: true,
    showCompleteDialog: true,
    duplicateAction: "ask",
    conflictAction: "rename",
    enableSounds: false,
    soundFiles: { complete: "", failed: "" },
    startOnLogin: false,
    keepAwake: true,
    runCommand: false,
    commandStr: 'explorer.exe /select,"{file}"',
    antivirusScan: false,
    avPath: ''
};

let tasks = [];
let processes = {};
let selectedTaskId = null;
let currentFilter = 'all';
let currentSearch = '';
let activeTasksCount = 0;
let sortField = 'id';
let sortOrder = 'desc';
let lastMetadata = null;

const enginePath = path.join(__dirname, 'engine.py');

// --- DATABASE & SETTINGS LOGIC ---
function loadAll() {
    ipcRenderer.send('db-load-all');
}

ipcRenderer.on('db-loaded-all', (event, { tasks: loadedTasks, settings: loadedSettings }) => {
    try {
        // Deep-merge scheduler and other settings
        appSettings = { 
            ...appSettings, 
            ...loadedSettings,
            scheduler: { ...appSettings.scheduler, ...(loadedSettings.scheduler || {}) }
        };

        // Sync UI with settings
        if (settingsPathInput) settingsPathInput.value = appSettings.downloadPath || '';
        if (settingsSpeedLimit) settingsSpeedLimit.value = appSettings.speedLimit || "0";
        
        // Sync Advanced Settings UI
        if (settingShowStartDialog) settingShowStartDialog.checked = appSettings.showStartDialog;
        if (settingShowCompleteDialog) settingShowCompleteDialog.checked = appSettings.showCompleteDialog;
        if (settingDuplicateAction) settingDuplicateAction.value = appSettings.duplicateAction;
        
        if (appSettings.conflictAction === 'rename') {
            btnRename?.classList.add('active');
            btnOverwrite?.classList.remove('active');
        } else {
            btnOverwrite?.classList.add('active');
            btnRename?.classList.remove('active');
        }

        if (settingEnableSounds) settingEnableSounds.checked = appSettings.enableSounds;
        if (soundComplete) soundComplete.value = appSettings.soundFiles.complete || "";
        if (soundFailed) soundFailed.value = appSettings.soundFiles.failed || "";
        
        if (settingStartLogin) settingStartLogin.checked = appSettings.startOnLogin;
        if (settingKeepAwake) settingKeepAwake.checked = appSettings.keepAwake;
        
        if (settingRunCommand) {
            settingRunCommand.checked = appSettings.runCommand || false;
            const commandGroup = document.getElementById('command-input-group');
            if (commandGroup) commandGroup.style.display = settingRunCommand.checked ? 'block' : 'none';
        }
        if (settingAntivirusScan) {
            settingAntivirusScan.checked = appSettings.antivirusScan || false;
            const avGroup = document.getElementById('antivirus-input-group');
            if (avGroup) avGroup.style.display = settingAntivirusScan.checked ? 'block' : 'none';
        }

        // Sync Queue & Scheduler UI
        if (settingMaxConcurrent) {
            settingMaxConcurrent.value = appSettings.maxConcurrent || 3;
            if (maxConcurrentVal) maxConcurrentVal.innerText = settingMaxConcurrent.value;
        }

        // Load Tasks
        tasks = loadedTasks || [];
        tasks.forEach(t => { 
            if (['Downloading', 'Analyzing'].includes(t.status)) { 
                t.status = 'Pending'; 
                t.statusClass = 'status-badge'; 
            } 
        });
        
        renderTable();
        processQueue();
        startSchedulerService();
        console.log("System: Data loaded from SQLite backend.");
    } catch (e) {
        console.error("Critical Load Error", e);
    }
});

function saveTasks() {
    // For SQL/NeDB, we'll save the indices so the order is preserved
    tasks.forEach((task, idx) => {
        task.order_index = idx;
        ipcRenderer.send('db-save-task', task);
    });
    updateBadges();
}

function saveSettings() {
    ipcRenderer.send('db-save-settings', appSettings);
}

// --- SERVICES ---
function processQueue() {
    activeTasksCount = Object.keys(processes).length;
    if (activeTasksCount >= appSettings.maxConcurrent) return;

    if (appSettings.scheduler.active) {
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        if (appSettings.scheduler.startActive && !isTimeInRange(currentTime, appSettings.scheduler.startTime, appSettings.scheduler.stopActive ? appSettings.scheduler.stopTime : '23:59')) {
             return;
        }
    }

    const nextTask = tasks.find(t => t.status === 'Pending' && !processes[t.id]);
    if (nextTask) {
        launchEngine(nextTask.id, nextTask.url, nextTask.res.replace('p',''), nextTask.dest, null, nextTask.type === 'music');
    }
}

function isTimeInRange(current, start, end) {
    if (!start || !end) return true;
    if (start <= end) return current >= start && current <= end;
    return current >= start || current <= end;
}

function startSchedulerService() {
    setInterval(() => {
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        
        processQueue();

        if (appSettings.scheduler.stopActive && currentTime === appSettings.scheduler.stopTime) {
            Object.keys(processes).forEach(id => {
                const t = tasks.find(t => t.id === Number(id));
                if (t) { t.status = 'Pending'; t.statusClass = 'status-badge'; } 
                stopTask(Number(id));
            });
            renderTable();
        }
    }, 60000);
}

function updateSleepPrevention() {
    ipcRenderer.send('prevent-sleep', appSettings.scheduler.preventSleep && activeTasksCount > 0);
}

function checkQueueCompletion() {
    // Only trigger power action if there are no active tasks left AND
    // the user explicitly enabled the 'Hang up / Shutdown when done' checkbox
    const noneActive = !tasks.some(t => ['Downloading', 'Analyzing'].includes(t.status));
    const shouldPower = appSettings.scheduler.powerActive === true &&
                        appSettings.scheduler.powerAction &&
                        appSettings.scheduler.powerAction !== 'none';
    if (noneActive && shouldPower) {
        showToast("Shutdown Scheduled", `System will ${appSettings.scheduler.powerAction} in 30 seconds. Start a new download to cancel.`, "info");
        setTimeout(() => ipcRenderer.send('power-action', appSettings.scheduler.powerAction), 30000);
    }
}

function showNotification(title, msg, type = 'info') {
    showToast(title, msg, type);
}

function showToast(title, msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `custom-notification ${type}`;
    
    let icon = '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>';
    if (type === 'success') icon = '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>';
    
    toast.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;">${icon}</svg>
        <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 13px;">${title}</div>
            <div style="font-size: 11px; color: #aaa;">${msg}</div>
        </div>
    `;
    
    notificationArea.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

function showCustomAlert(title, message, type = 'info', onConfirm = null, onFile = null, onFolder = null, onDeleteDisk = null) {
    alertTitle.innerText = title;
    alertMessage.innerText = message;
    alertCallback = onConfirm;
    alertFileCallback = onFile;
    alertFolderCallback = onFolder;
    alertDeleteDiskCallback = onDeleteDisk;
    
    // Hide specialized fields by default
    alertQueueSelect.parentElement.style.display = 'none';
    let color = '#007aff';
    let icon = '<circle cx="12" cy="12" r="10"/><path d="M12 16V12M12 8h.01"/>';
    
    if (type === 'success') { color = '#28a745'; icon = '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>'; }
    if (type === 'error') { color = '#ff4d4d'; icon = '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>'; }
    if (type === 'confirm') { color = '#ffc107'; icon = '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'; }

    alertSvg.innerHTML = icon;
    alertSvg.style.color = color;
    document.getElementById('alert-icon-box').style.background = `${color}22`;
    
    alertCancelBtn.style.display = 'none';
    alertOpenFileBtn.style.display = 'none';
    alertOpenFolderBtn.style.display = 'none';
    alertDeleteDiskBtn.style.display = 'none';

    if (onConfirm) {
        alertCancelBtn.style.display = 'block';
        alertOkBtn.innerText = title.includes("Delete") ? "Remove from List" : "Confirmed";
    } else {
        alertOkBtn.innerText = "Acknowledge";
    }

    if (onFile) alertOpenFileBtn.style.display = 'block';
    if (onFolder) alertOpenFolderBtn.style.display = 'block';
    if (onDeleteDisk) alertDeleteDiskBtn.style.display = 'block';

    customAlertOverlay.style.display = 'flex';
}

alertOkBtn.addEventListener('click', () => {
    customAlertOverlay.style.display = 'none';
    if (alertCallback) alertCallback();
    alertCallback = null; alertFileCallback = null; alertFolderCallback = null; alertDeleteDiskCallback = null;
});

alertCancelBtn.addEventListener('click', () => {
    customAlertOverlay.style.display = 'none';
    alertCallback = null; alertFileCallback = null; alertFolderCallback = null; alertDeleteDiskCallback = null;
});

alertOpenFileBtn.addEventListener('click', () => {
    customAlertOverlay.style.display = 'none';
    if (alertFileCallback) alertFileCallback();
    alertFileCallback = null; alertCallback = null; alertFolderCallback = null; alertDeleteDiskCallback = null;
});

alertOpenFolderBtn.addEventListener('click', () => {
    customAlertOverlay.style.display = 'none';
    if (alertFolderCallback) alertFolderCallback();
    alertFolderCallback = null; alertCallback = null; alertFileCallback = null; alertDeleteDiskCallback = null;
});

alertDeleteDiskBtn.addEventListener('click', () => {
    customAlertOverlay.style.display = 'none';
    if (alertDeleteDiskCallback) alertDeleteDiskCallback();
    alertDeleteDiskCallback = null; alertCallback = null; alertFileCallback = null; alertFolderCallback = null;
});

// --- UI HELPERS ---
function updateStatus(msg) { statusBar.innerText = `${msg} | ${activeTasksCount} active tasks`; updateSleepPrevention(); }

function updateBadges() {
    document.getElementById('badge-all').innerText = tasks.length;
    ['unfinished', 'finished', 'failed'].forEach(f => {
        document.getElementById(`badge-${f}`).innerText = tasks.filter(t => f === 'unfinished' ? ['Downloading', 'Analyzing', 'Pending'].includes(t.status) : f === 'finished' ? t.status === 'Finished' : ['Error', 'Failed'].includes(t.status)).length;
    });
    ['video', 'music', 'documents', 'compressed', 'programs'].forEach(f => { 
        document.getElementById(`badge-${f}`).innerText = tasks.filter(t => t.type === f || t.category === f).length; 
    });
}

function getFileType(title) {
    const ext = title.split('.').pop().toLowerCase();
    const map = { 
        video: ['mp4', 'mkv', 'webm', 'avi', 'mov', '3gp', 'asf', 'm4v', 'mpe', 'mpeg', 'mpg', 'ogv', 'qt', 'rm', 'rmvb', 'wmv'], 
        music: ['mp3', 'm4a', 'wav', 'flac', 'aac', 'aif', 'mpa', 'ogg', 'ra', 'wma'], 
        documents: ['pdf', 'doc', 'docx', 'txt', 'plj', 'pps', 'ppt', 'tif', 'tiff'], 
        compressed: ['zip', 'rar', '7z', 'gz', 'tar', 'ace', 'arj', 'bin', 'bz2', 'gzip', 'img', 'iso', 'lzh', 'sea', 'sit', 'sitx', 'z'], 
        programs: ['exe', 'msi', 'dmg', 'sh', 'apk', 'msu'] 
    };
    for (let type in map) if (map[type].includes(ext)) return type;
    // Special handle for R01, R02, etc.
    if (/^r\d+$/.test(ext)) return 'compressed';
    return 'video';
}

function renderTable() {
    downloadList.innerHTML = '';
    let filtered = tasks.filter(t => {
        const matchesSection = (currentFilter === 'all') || 
                               (currentFilter === 'unfinished' && ['Downloading', 'Analyzing', 'Pending'].includes(t.status)) || 
                               (currentFilter === 'finished' && t.status === 'Finished') || 
                               (currentFilter === 'failed' && ['Error', 'Failed'].includes(t.status));
        
        const matchesCategory = (t.type === currentFilter || t.category === currentFilter || (currentFilter === 'video' && t.category === 'movies'));
        const matchesFilter = matchesSection || matchesCategory;
        const matchesSearch = t.title.toLowerCase().includes(currentSearch.toLowerCase());
        return matchesFilter && matchesSearch;
    });
    filtered.sort((a, b) => {
        let valA = a[sortField] || '', valB = b[sortField] || '';
        if (sortField === 'size') { valA = parseFloat(valA) * (valA.includes('GB') ? 1024 : 1); valB = parseFloat(valB) * (valB.includes('GB') ? 1024 : 1); }
        return (valA < valB ? -1 : 1) * (sortOrder === 'asc' ? 1 : -1);
    });
    if (filtered.length === 0) { emptyState.style.display = 'flex'; downloadList.appendChild(emptyState); }
    else { emptyState.style.display = 'none'; filtered.forEach(task => downloadList.appendChild(createTaskRow(task))); }
    updateBadges();
}

function createTaskRow(task) {
    const row = document.createElement('div');
    const isSelected = selectedTaskIds.has(task.id);
    row.className = `table-row ${isSelected ? 'selected' : ''}`;
    row.id = `task-${task.id}`;
    row.draggable = true;
    
    row.innerHTML = `
        <div class="col-check"><input type="checkbox" class="task-checkbox" ${isSelected ? 'checked' : ''}></div>
        <div class="file-name" title="${task.title}">${task.title}</div>
        <div class="file-size">${task.size || '---'}</div>
        <div class="file-status"><span class="status-badge ${task.statusClass}">${task.status}</span></div>
        <div class="file-eta">${task.eta || '---'}</div>
        <div class="file-rate">${task.rate || '---'}</div>
        <div class="file-res">${task.res || '---'}</div>
        <div class="file-progress"><div style="width: 100%; background: #222; height: 4px; border-radius: 2px;"><div class="progress-bar" style="width: ${task.progress || '0%'}; background: var(--accent); height: 100%; border-radius: 2px; transition: 0.3s;"></div></div></div>
    `;

    const checkbox = row.querySelector('.task-checkbox');
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            selectedTaskIds.add(task.id);
            row.classList.add('selected');
        } else {
            selectedTaskIds.delete(task.id);
            row.classList.remove('selected');
        }
        updateSelectAllState();
    });

    row.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') return;
        // Selection logic for single click
        if (!e.ctrlKey && !e.shiftKey) {
            selectedTaskIds.clear();
            document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
            document.querySelectorAll('.table-row').forEach(r => r.classList.remove('selected'));
        }
        selectedTaskIds.add(task.id);
        checkbox.checked = true;
        row.classList.add('selected');
        selectedTaskId = task.id;
        updateSelectAllState();
    });

    row.addEventListener('contextmenu', (e) => { 
        e.preventDefault(); 
        if (!selectedTaskIds.has(task.id)) {
            selectedTaskIds.clear();
            selectedTaskIds.add(task.id);
            renderTable();
        }
        selectedTaskId = task.id;
        contextMenu.style.top = `${e.pageY}px`; 
        contextMenu.style.left = `${e.pageX}px`; 
        contextMenu.style.display = 'block'; 
    });

    row.addEventListener('dblclick', () => { if (task.status === 'Finished') shell.openPath(task.dest); });

    // Drag & Drop
    row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', task.id);
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    row.addEventListener('dragend', () => row.classList.remove('dragging'));

    row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetRow = e.target.closest('.table-row');
        if (targetRow && targetRow !== row) {
            targetRow.classList.add('drag-over');
        }
    });

    row.addEventListener('dragleave', (e) => {
        const targetRow = e.target.closest('.table-row');
        if (targetRow) targetRow.classList.remove('drag-over');
    });

    row.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedId = Number(e.dataTransfer.getData('text/plain'));
        const targetRow = e.target.closest('.table-row');
        if (!targetRow) return;
        targetRow.classList.remove('drag-over');

        const targetId = Number(targetRow.id.replace('task-', ''));
        if (draggedId === targetId) return;

        const draggedIdx = tasks.findIndex(t => t.id === draggedId);
        const targetIdx = tasks.findIndex(t => t.id === targetId);

        if (draggedIdx !== -1 && targetIdx !== -1) {
            const [draggedTask] = tasks.splice(draggedIdx, 1);
            tasks.splice(targetIdx, 0, draggedTask);
            renderTable();
            saveTasks();
            processQueue(); // Check if newly prioritized task can start
        }
    });

    return row;
}

function updateSelectAllState() {
    const totalVisible = document.querySelectorAll('.task-checkbox').length;
    const totalChecked = document.querySelectorAll('.task-checkbox:checked').length;
    selectAllCheckbox.checked = totalVisible > 0 && totalChecked === totalVisible;
}

function updateRowUI(taskId) {
    const t = tasks.find(t => t.id === taskId);
    if (!t) return; saveTasks();
    const row = document.getElementById(`task-${taskId}`);
    if (!row) return;
    row.querySelector('.file-status').innerHTML = `<span class="status-badge ${t.statusClass}">${t.status}</span>`;
    ['size', 'eta', 'rate', 'res'].forEach(f => row.querySelector(`.file-${f}`).innerText = t[f] || '---');
    row.querySelector('.progress-bar').style.width = t.progress || '0%';
}

// --- ACTIONS ---
function stopTask(taskId) {
    if (processes[taskId]) { 
        processes[taskId].kill(); 
        delete processes[taskId]; 
        const t = tasks.find(t => t.id === taskId); 
        if (t) { t.status = 'Stopped'; t.statusClass = 'status-badge'; updateRowUI(taskId); } 
        updateStatus('System: Task Suspended'); 
        processQueue(); // Start next in line
    }
}

function deleteTask(taskId, fromDisk = false) { 
    const t = tasks.find(t => t.id === taskId);
    if (fromDisk && t && t.status === 'Finished') {
        try {
            const fullPath = path.join(t.dest, t.title);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch (e) {
            console.error("File delete error", e);
            showToast("Disk Error", "Failed to delete file from disk. It may be in use.", "error");
        }
    }
    stopTask(taskId); 
    tasks = tasks.filter(t => t.id !== taskId); 
    ipcRenderer.send('db-delete-task', taskId);
    if (selectedTaskId === taskId) selectedTaskId = null; 
    selectedTaskIds.delete(taskId);
    renderTable(); 
    saveTasks(); 
}

function deleteSelectedTasks(fromDisk = false) {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    ids.forEach(id => deleteTask(id, fromDisk));
    selectedTaskIds.clear();
    selectAllCheckbox.checked = false;
    renderTable();
}

function fetchMetadata(url) {
    if (!url) return;
    modalAnalyzeBtn.disabled = true;
    modalAnalyzeBtn.innerText = "Analyzing...";
    modalAnalysisStatus.style.display = 'block';
    modalInfoSection.style.display = 'none';
    modalQualityGroup.style.display = 'none';
    modalDownload.disabled = true;
    playlistGroup.style.display = 'none'; // Hide playlist section by default

    const info = spawn('python', ['-u', enginePath, 'info', url]);
    let infoData = "";
    info.stdout.on('data', d => infoData += d);
    info.on('close', code => {
        modalAnalyzeBtn.disabled = false;
        modalAnalyzeBtn.innerText = "Fetch Info";
        modalAnalysisStatus.style.display = 'none';

        if (code === 0) {
            try {
                const data = JSON.parse(infoData);
                lastMetadata = data;
                
                // Update Modal UI
                modalVideoTitle.innerText = data.title;
                modalVideoAuthor.innerText = data.uploader || data.extractor || "Unknown Source";
                
                // Format duration
                const sec = data.duration;
                if (sec) {
                    const h = Math.floor(sec / 3600);
                    const m = Math.floor((sec % 3600) / 60);
                    const s = sec % 60;
                    modalVideoDuration.innerText = `Duration: ${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                } else {
                    modalVideoDuration.innerText = "Duration: Live Stream / Unknown";
                }

                // Thumbnails - Use Proxy to bypass Instagram/Site hotlink blocks
                let thumbnailUrl = data.thumbnail;
                if (data.thumbnails && Array.isArray(data.thumbnails) && data.thumbnails.length > 0) {
                    try {
                        const bestThumb = data.thumbnails.reduce((prev, current) => {
                            if (!current || typeof current !== 'object') return prev;
                            const prevArea = (prev.width || 0) * (prev.height || 0);
                            const currArea = (current.width || 0) * (current.height || 0);
                            return (currArea > prevArea) ? current : prev;
                        }, data.thumbnails[0]);
                        if (bestThumb && bestThumb.url) thumbnailUrl = bestThumb.url;
                    } catch (e) { console.error("Thumb reduction error", e); }
                }

                if (thumbnailUrl) {
                    ipcRenderer.send('fetch-thumbnail', thumbnailUrl);
                } else {
                    modalThumbnail.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#222; color:#555;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width: 40px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`;
                }

                // Populate Resolutions
                const formats = data.formats || [];
                const resOptions = new Set();
                formats.forEach(f => {
                    if (f.height) resOptions.add(f.height);
                });
                
                // Sort resolutions descending
                const sortedRes = Array.from(resOptions).sort((a, b) => b - a);
                if (sortedRes.length > 0) {
                    modalRes.innerHTML = sortedRes.map(r => `<option value="${r}" ${r === 1080 ? 'selected' : ''}>${r}p</option>`).join('');
                }

                if (data._type === 'playlist') {
                    playlistGroup.style.display = 'block';
                    playlistItems.style.display = 'block';
                    playlistItems.innerHTML = '';
                    modalVideoDuration.innerText = `Playlist: ${data.entries.length} items`;
                    modalDownload.innerText = "Download Playlist";
                    
                    data.entries.forEach((entry, idx) => {
                        if (!entry) return;
                        const item = document.createElement('div');
                        item.className = 'playlist-item';
                        item.innerHTML = `
                            <input type="checkbox" class="playlist-checkbox" data-index="${idx + 1}" checked>
                            <div class="item-title">${entry.title || "Unknown Title"}</div>
                            <div class="item-duration">${entry.duration ? formatDuration(entry.duration) : ""}</div>
                        `;
                        playlistItems.appendChild(item);
                    });
                } else {
                    playlistGroup.style.display = 'none';
                    modalDownload.innerText = "Download";
                }

                modalInfoSection.style.display = 'block';
                modalQualityGroup.style.display = 'block';
                modalDownload.disabled = false;
                modalDownloadLater.disabled = false;

                // Immediate Download Logic REMOVED (User preference)

            } catch (e) {
                console.error("Info Parse Error", e);
                showCustomAlert("Parsing Error", "System Alert: Failed to parse media metadata. Manual extraction may be required.", "error");
            }
        } else {
            showCustomAlert("Connection Error", "System Alert: Could not reach media source. Please verify the URL and your internet connection.", "error");
        }
    });
}

function startDownload(url, res, existingTaskId = null, forceCategory = null) {
    const taskId = existingTaskId || Date.now();
    const dest = appSettings.downloadPath;
    const speed = appSettings.speedLimit && appSettings.speedLimit !== "0" ? appSettings.speedLimit : null;
    const isAudioOnly = modalAudioOnly.checked;
    const category = forceCategory || modalQueueSelect.value || 'main';
    
    // Check for Playlist selection if it's a playlist
    let playlistItemsArg = null;
    if (lastMetadata && lastMetadata._type === 'playlist' && !existingTaskId) {
        const selected = Array.from(document.querySelectorAll('.playlist-checkbox:checked')).map(cb => cb.getAttribute('data-index'));
        if (selected.length === 0) {
            showCustomAlert("Selection Required", "Please select at least one item from the playlist.", "info");
            return;
        }
        playlistItemsArg = selected.join(',');
    }
    
    // Duplicate Check
    if (!existingTaskId && tasks.find(t => t.url === url)) {
        if (appSettings.duplicateAction === 'skip') {
            showToast("Duplicate Skip", "This link is already in your tasks. Skipping...", "info");
            return;
        } else if (appSettings.duplicateAction === 'ask') {
            // We could show a custom alert here, but for now we'll stick to basic ask
            showCustomAlert("Duplicate Link", "This link is already in your list. Overwrite existing task?", "confirm", () => {
                const oldTask = tasks.find(t => t.url === url);
                deleteTask(oldTask.id);
                startDownload(url, res);
            });
            return;
        } else if (appSettings.duplicateAction === 'overwrite') {
            const oldTask = tasks.find(t => t.url === url);
            deleteTask(oldTask.id);
            // Continue to startDownload logic below
        }
    }

    let taskTitle = "Media Extraction Task";
    let taskSize = "---";
    let taskType = "video";

    if (lastMetadata && !existingTaskId) {
        taskTitle = lastMetadata.title;
        taskType = getFileType(lastMetadata.title);
        
        const bytes = lastMetadata.filesize || lastMetadata.filesize_approx || lastMetadata.total_bytes || 0;
        if (bytes > 0) {
            taskSize = (bytes / (1024 * 1024)).toFixed(1) + " MB";
        } else {
            taskSize = "---";
        }
    }

    // Conflict Check (File exists on disk)
    let finalTitle = taskTitle;
    if (appSettings.conflictAction === 'rename' && !existingTaskId) {
        let count = 1;
        const baseName = taskTitle.substring(0, taskTitle.lastIndexOf('.')) || taskTitle;
        const ext = taskTitle.substring(taskTitle.lastIndexOf('.')) || '';
        while (fs.existsSync(path.join(dest, finalTitle))) {
            finalTitle = `${baseName} (${count})${ext}`;
            count++;
        }
    }

    if (!existingTaskId) {
        tasks.unshift({ 
            id: taskId, url, title: finalTitle, 
            status: "Pending", statusClass: "status-badge", 
            res: res + "p", progress: "0%", dest, type: taskType, size: taskSize,
            category: category
        });
        renderTable();
    } else {
        const t = tasks.find(t => t.id === taskId);
        t.status = "Pending";
        t.statusClass = "status-badge";
        updateRowUI(taskId);
    }

    updateStatus('System: Task Added to Queue');
    processQueue();
    lastMetadata = null; // Clear after use
}

function launchEngine(taskId, url, res, dest, speed, isAudioOnly = false, playlistItems = null) {
    const args = ['-u', enginePath, 'download', url, res, dest];
    if (speed) args.push(speed + "K");
    if (isAudioOnly) args.push("audio");
    if (playlistItems) args.push(playlistItems);

    const dl = spawn('python', args);
    processes[taskId] = dl;
    const t = tasks.find(t => t.id === taskId);
    t.status = 'Downloading'; t.statusClass = 'status-downloading'; updateRowUI(taskId);
    dl.stdout.on('data', data => {
        const out = data.toString();
        if (out.includes("PROGRESS:")) { const p = out.split('|'); t.progress = p[0].split("PROGRESS:")[1].trim(); t.rate = p[1]?.split("SPEED:")[1].trim() || "---"; t.eta = p[2]?.split("ETA:")[1].trim() || "---"; updateRowUI(taskId); }
        
        // Capture actual filename from yt-dlp output
        if (out.includes("[download] Destination:")) {
            const match = out.match(/\[download\] Destination:\s+(.*)/);
            if (match && match[1]) { t.title = path.basename(match[1].trim()); updateRowUI(taskId); saveTasks(); }
        }
        if (out.includes("has already been downloaded")) {
            const match = out.match(/\[download\]\s+(.*)\s+has already been downloaded/);
            if (match && match[1]) { t.title = path.basename(match[1].trim()); updateRowUI(taskId); saveTasks(); }
        }
        if (out.includes("[ffmpeg] Merging formats into")) {
            const match = out.match(/\[ffmpeg\] Merging formats into\s+"(.*)"/);
            if (match && match[1]) { t.title = path.basename(match[1].trim()); updateRowUI(taskId); saveTasks(); }
        }
    });
    dl.on('close', code => {
        delete processes[taskId]; 
        if (code === 0) { 
            t.status = 'Finished'; t.statusClass = 'status-finished'; t.progress = '100%'; t.eta = 'Done'; t.rate = '0 KB/s'; 
            
            if (appSettings.showCompleteDialog) {
                showCustomAlert(
                    "Download Complete", 
                    `Success: "${t.title}" has been successfully extracted to your storage.`, 
                    "success",
                    null,
                    () => {
                        shell.openPath(path.join(t.dest, t.title)).then(err => {
                            if (err) showToast("Open Failed", "Could not open file. It may have been moved or renamed.", "error");
                        });
                    },
                    () => shell.showItemInFolder(path.join(t.dest, t.title))
                );
            } else {
                showNotification("Complete", t.title);
            }
            playNotificationSound('complete');

            // Sync actual final size from disk
            try {
                const fullPath = path.join(t.dest, t.title);
                // We might need to wait a tiny bit for the OS to release the handle/update stats
                setTimeout(() => {
                    if (fs.existsSync(fullPath)) {
                        const stats = fs.statSync(fullPath);
                        t.size = (stats.size / (1024 * 1024)).toFixed(1) + " MB";
                        updateRowUI(taskId);
                        saveTasks();
                    }
                    // If file doesn't exist with literal title, it might have been renamed or have slightly different ext
                    // but for now we focus on the most common case.
                }, 500);
            } catch (e) {
                console.error("Size sync error", e);
            }

            // Post-Processing Logic
            if (appSettings.runCommand && appSettings.commandStr) {
                const finalCmd = appSettings.commandStr.replace('{file}', path.join(t.dest, t.title));
                const { exec } = require('child_process');
                exec(finalCmd, (err) => { if (err) console.error("Post-command error", err); });
            }

            if (appSettings.antivirusScan && appSettings.avPath && fs.existsSync(appSettings.avPath)) {
                const { exec } = require('child_process');
                const filePath = path.join(t.dest, t.title);
                exec(`"${appSettings.avPath}" "${filePath}"`, (err) => { 
                    if (err) showToast("AV Scan Error", "Failed to initiate antivirus scan.", "error");
                    else showToast("AV Scan", "Antivirus scan initiated successfully.", "info");
                });
            }

        } else if (t.status !== 'Stopped') { 
            t.status = 'Error'; t.statusClass = 'status-error'; 
            playNotificationSound('failed');
        }
        updateRowUI(taskId); 
        updateStatus('System: Idle'); 
        processQueue(); // Check for next task
        checkQueueCompletion();
    });
}

// --- LISTENERS ---
window.addEventListener('click', () => contextMenu.style.display = 'none');
searchInput.addEventListener('input', e => { 
    currentSearch = e.target.value; 
    selectedTaskIds.clear();
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    renderTable(); 
});
document.querySelectorAll('.sortable').forEach(h => h.addEventListener('click', () => { 
    const f = h.getAttribute('data-sort'); 
    if (sortField === f) sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'; 
    else { sortField = f; sortOrder = 'asc'; } 
    renderTable(); 
}));
navItems.forEach(i => i.addEventListener('click', () => { 
    navItems.forEach(n => n.classList.remove('active')); 
    i.classList.add('active'); 
    currentFilter = i.getAttribute('data-filter'); 
    selectedTaskIds.clear();
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    renderTable(); 
}));

// Settings Tabs Logic
settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        settingsTabs.forEach(t => t.classList.remove('active'));
        tabPanes.forEach(p => p.style.display = 'none');
        
        tab.classList.add('active');
        const target = tab.getAttribute('data-tab');
        document.getElementById(target).style.display = 'block';
    });
});
addUrlBtn.addEventListener('click', () => { 
    if (appSettings.showStartDialog) {
        modalOverlay.style.display = 'flex'; 
        modalUrl.focus(); 
        resetModal();
    } else {
        // If no dialog, we need a way to get the URL. 
        // Typically this works via Clipboard or a simple prompt.
        // For now, we'll keep the modal but skip the "Info" phase if possible.
        // Actually, without a URL, we can't do anything. 
        // If the user hits "+" and dialog is off, perhaps they want to paste.
        // Let's stick to showing the modal for URL input, but maybe auto-start.
        modalOverlay.style.display = 'flex'; 
        modalUrl.focus(); 
        resetModal();
        resetModal();
    }
});

modalCancel.addEventListener('click', () => { modalOverlay.style.display = 'none'; modalUrl.value = ''; });
modalDownload.addEventListener('click', () => { 
    const u = modalUrl.value.trim(); 
    if (u) { 
        modalOverlay.style.display = 'none'; 
        modalUrl.value = ''; 
        startDownload(u, modalRes.value); 
    } 
});

modalDownloadLater.addEventListener('click', () => {
    const u = modalUrl.value.trim(); 
    if (!u) return;
    
    // Close the modal immediately
    modalOverlay.style.display = 'none'; 
    modalUrl.value = '';
    
    // Add task to the queue as PENDING — do NOT start downloading
    const category = modalQueueSelect.value || 'main';
    const res = modalRes.value || '1080';
    const taskId = Date.now();
    const dest = appSettings.downloadPath;
    const isAudioOnly = modalAudioOnly.checked;
    let taskTitle = lastMetadata ? lastMetadata.title : 'Media Extraction Task';
    let taskType = lastMetadata ? getFileType(lastMetadata.title) : 'video';
    let taskSize = '---';
    if (lastMetadata) {
        const bytes = lastMetadata.filesize || lastMetadata.filesize_approx || 0;
        if (bytes > 0) taskSize = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    tasks.unshift({
        id: taskId, url: u, title: taskTitle,
        status: 'Pending', statusClass: 'status-badge',
        res: res + 'p', progress: '0%', dest, type: taskType, size: taskSize,
        category, isAudioOnly
    });
    lastMetadata = null;
    saveTasks();
    renderTable();
    
    const queueName = modalQueueSelect.options[modalQueueSelect.selectedIndex]?.text || 'Main Queue';
    showToast('Added to Queue', `"${taskTitle}" added to ${queueName} — not yet downloading.`, 'info');
    // NOTE: processQueue() is intentionally NOT called here so it stays in Pending
});

modalAnalyzeBtn.addEventListener('click', () => fetchMetadata(modalUrl.value.trim()));

modalUrl.addEventListener('paste', () => {
    setTimeout(() => {
        const url = modalUrl.value.trim();
        if (url) {
            // Always fetch info first - user specifically requested this
            fetchMetadata(url);
        }
    }, 100);
});

modalCancel.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    modalUrl.value = '';
    resetModal();
});

function resetModal() {
    modalInfoSection.style.display = 'none';
    modalAnalysisStatus.style.display = 'none';
    modalQualityGroup.style.display = 'none';
    modalDownload.disabled = true;
    modalDownloadLater.disabled = true;
    modalDownload.innerText = "Download Now";
    modalAnalyzeBtn.innerText = "Fetch Info";
    modalAnalyzeBtn.disabled = false;
    modalThumbnail.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1" style="width: 40px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
    lastMetadata = null;
    modalAudioOnly.checked = false;
    playlistGroup.style.display = 'none';
}

function formatDuration(sec) {
    if (!sec) return "00:00";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

playlistSelectAll.addEventListener('click', () => {
    const checks = document.querySelectorAll('.playlist-checkbox');
    const allChecked = Array.from(checks).every(c => c.checked);
    checks.forEach(c => c.checked = !allChecked);
    playlistSelectAll.innerText = allChecked ? "Select All" : "Deselect All";
});

// --- TOOLBAR BUTTONS ---
addUrlBtn.addEventListener('click', () => {
    modalOverlay.style.display = 'flex';
    modalUrl.focus();
});

schedulerBtn.addEventListener('click', () => {
    schedulerOverlay.style.display = 'flex';
});

folderBtn.addEventListener('click', () => {
    ipcRenderer.send('select-folder');
});

ipcRenderer.on('selected-folder', (event, folderPath) => {
    appSettings.downloadPath = folderPath;
    settingsPathInput.value = folderPath;
    saveSettings();
    showToast("Folder Changed", `Download path set to:\n${folderPath}`, "success");
});

function syncOptionsUI() {
    if (!appSettings) return;
    if (settingsPathInput) settingsPathInput.value = appSettings.downloadPath || ''; 
    if (settingsSpeedLimit) settingsSpeedLimit.value = appSettings.speedLimit || 0; 
    if (settingShowStartDialog) settingShowStartDialog.checked = appSettings.showStartDialog;
    if (settingShowCompleteDialog) settingShowCompleteDialog.checked = appSettings.showCompleteDialog;
    if (settingDuplicateAction) settingDuplicateAction.value = appSettings.duplicateAction;
    if (settingEnableSounds) settingEnableSounds.checked = appSettings.enableSounds;
    if (soundComplete) soundComplete.value = appSettings.soundFiles.complete || "";
    if (soundFailed) soundFailed.value = appSettings.soundFiles.failed || "";
    if (settingStartLogin) settingStartLogin.checked = appSettings.startOnLogin;
    if (settingKeepAwake) settingKeepAwake.checked = appSettings.keepAwake;
    if (settingRunCommand) settingRunCommand.checked = appSettings.runCommand;
    if (settingCommandStr) settingCommandStr.value = appSettings.commandStr || "";
    if (settingAntivirusScan) settingAntivirusScan.checked = appSettings.antivirusScan;
    if (settingAvPath) settingAvPath.value = appSettings.avPath || "";
    if (settingMaxConcurrent) {
        settingMaxConcurrent.value = appSettings.maxConcurrent || 3;
        if (maxConcurrentVal) maxConcurrentVal.innerText = appSettings.maxConcurrent;
    }

    // Reset Tabs
    if (settingsTabs.length > 0) {
        settingsTabs.forEach(t => t.classList.remove('active'));
        tabPanes.forEach(p => p.style.display = 'none');
        settingsTabs[0].classList.add('active');
        if (tabPanes[0]) tabPanes[0].style.display = 'block';
    }

    // Contextual Visibility
    const commandGroup = document.getElementById('command-input-group');
    if (commandGroup) commandGroup.style.display = appSettings.runCommand ? 'block' : 'none';
    const avGroup = document.getElementById('antivirus-input-group');
    if (avGroup) avGroup.style.display = appSettings.antivirusScan ? 'block' : 'none';

    // Conflict Action Toggles
    if (appSettings.conflictAction === 'rename') {
        btnRename?.classList.add('active');
        btnOverwrite?.classList.remove('active');
    } else {
        btnOverwrite?.classList.add('active');
        btnRename?.classList.remove('active');
    }
}

optionsBtn.addEventListener('click', () => { 
    console.log("System: Opening Advanced Settings...");
    syncOptionsUI();
    optionsOverlay.style.display = 'flex'; 
});
optionsCancel.addEventListener('click', () => optionsOverlay.style.display = 'none');
optionsSave.addEventListener('click', () => { 
    appSettings.downloadPath = settingsPathInput.value; 
    appSettings.speedLimit = settingsSpeedLimit.value; 
    
    // Save Advanced Settings
    appSettings.showStartDialog = settingShowStartDialog.checked;
    appSettings.showCompleteDialog = settingShowCompleteDialog.checked;
    appSettings.duplicateAction = settingDuplicateAction.value;
    appSettings.conflictAction = btnRename.classList.contains('active') ? 'rename' : 'overwrite';
    appSettings.enableSounds = settingEnableSounds.checked;
    appSettings.soundFiles.complete = soundComplete.value;
    appSettings.soundFiles.failed = soundFailed.value;
    appSettings.startOnLogin = settingStartLogin.checked;
    appSettings.keepAwake = settingKeepAwake.checked;
    appSettings.runCommand = settingRunCommand.checked;
    appSettings.commandStr = settingCommandStr.value;
    appSettings.antivirusScan = settingAntivirusScan.checked;
    appSettings.avPath = settingAvPath.value;
    
    // Save Queue
    appSettings.maxConcurrent = parseInt(settingMaxConcurrent.value);

    saveSettings(); 
    processQueue(); 
    ipcRenderer.send('set-autolaunch', appSettings.startOnLogin);
    ipcRenderer.send('set-keep-awake', appSettings.keepAwake);
    updateSleepPrevention();
    optionsOverlay.style.display = 'none'; 
});

// --- SETTINGS TABS ---
settingsTabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => {
        settingsTabs.forEach(t => t.classList.remove('active'));
        tabPanes.forEach(p => p.style.display = 'none');
        tab.classList.add('active');
        if (tabPanes[idx]) tabPanes[idx].style.display = 'block';
    });
});

// --- SETTINGS ACTIONS ---
btnRename.addEventListener('click', () => {
    btnRename.classList.add('active');
    btnOverwrite.classList.remove('active');
    appSettings.conflictAction = 'rename';
});

btnOverwrite.addEventListener('click', () => {
    btnOverwrite.classList.add('active');
    btnRename.classList.remove('active');
    appSettings.conflictAction = 'overwrite';
});

settingsBrowse.addEventListener('click', () => ipcRenderer.send('select-folder'));
browseSoundComplete.addEventListener('click', () => ipcRenderer.send('select-sound-file', 'complete'));
browseSoundFailed.addEventListener('click', () => ipcRenderer.send('select-sound-file', 'failed'));
browseAv.addEventListener('click', () => ipcRenderer.send('select-av-file'));

engineUpdateBtn.addEventListener('click', () => {
    engineUpdateBtn.disabled = true;
    engineUpdateBtn.innerText = "Processing System Upgrade...";
    ipcRenderer.send('update-engine');
});

ipcRenderer.on('engine-update-result', (event, res) => {
    engineUpdateBtn.disabled = false;
    engineUpdateBtn.innerText = "Update yt-dlp Engine";
    showCustomAlert(res.success ? "Success" : "Error", res.message, res.success ? "success" : "error");
});

settingsClear.addEventListener('click', () => {
    showCustomAlert("Clear History", "Are you sure you want to permanently delete all download records?", "confirm", () => {
        tasks = [];
        saveTasks();
        renderTable();
        showToast("Success", "All history cleared.", "success");
    });
});

ipcRenderer.on('selected-sound-file', (event, { type, path }) => {
    if (type === 'complete') soundComplete.value = path;
    else soundFailed.value = path;
});

ipcRenderer.on('selected-av-file', (event, path) => {
    settingAvPath.value = path;
});

optionsClose.addEventListener('click', () => optionsOverlay.style.display = 'none');
schedulerClose.addEventListener('click', () => schedulerOverlay.style.display = 'none');

settingRunCommand.addEventListener('change', () => {
    const commandGroup = document.getElementById('command-input-group');
    if (commandGroup) commandGroup.style.display = settingRunCommand.checked ? 'block' : 'none';
});

settingAntivirusScan.addEventListener('change', () => {
    antivirusInputGroup.style.display = settingAntivirusScan.checked ? 'block' : 'none';
});

settingMaxConcurrent.addEventListener('input', () => {
    maxConcurrentVal.innerText = settingMaxConcurrent.value;
});

// settingSchedulerActive removed as logic moved to dedicated Scheduler modal

// --- SCHEDULER MODAL LOGIC ---
let currentSchedQ = 'main';
const schedTabs = document.querySelectorAll('[data-sched-tab]');
const schedPanes = document.querySelectorAll('.sched-pane');
const schedQItems = document.querySelectorAll('.sched-q-item');
const schedQList = document.getElementById('sched-q-list');

schedTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        schedTabs.forEach(t => t.classList.remove('active'));
        schedPanes.forEach(p => p.style.display = 'none');
        tab.classList.add('active');
        document.getElementById(tab.getAttribute('data-sched-tab')).style.display = 'block';
        if (tab.getAttribute('data-sched-tab') === 'tab-sched-files') renderSchedQueue();
    });
});

schedQItems.forEach(item => {
    item.addEventListener('click', () => {
        schedQItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        currentSchedQ = item.getAttribute('data-q');
        if (document.getElementById('tab-sched-files').style.display !== 'none') renderSchedQueue();
    });
});

function renderSchedQueue() {
    schedQList.innerHTML = '';
    const filtered = tasks.filter(t => t.category === currentSchedQ || (currentSchedQ === 'main' && !t.category));
    if (filtered.length === 0) {
        schedQList.innerHTML = '<div style="padding: 20px; color: #555; text-align: center; font-size: 13px;">No files in this queue</div>';
        return;
    }
    filtered.forEach(t => {
        const item = document.createElement('div');
        item.style = 'padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 13px; color: #eee; display: flex; justify-content: space-between;';
        item.innerHTML = `<span>${t.title}</span><span style="color: #888;">${t.status}</span>`;
        schedQList.appendChild(item);
    });
}

schedulerSave.addEventListener('click', () => {
    appSettings.scheduler.startActive = document.getElementById('sched-start-active').checked;
    appSettings.scheduler.startTime = document.getElementById('sched-start-time').value;
    appSettings.scheduler.stopActive = document.getElementById('sched-stop-active').checked;
    appSettings.scheduler.stopTime = document.getElementById('sched-stop-time').value;
    appSettings.scheduler.powerActive = document.getElementById('sched-power-action-active').checked;
    appSettings.scheduler.powerAction = document.getElementById('sched-power-action').value;
    appSettings.scheduler.qLimit = parseInt(document.getElementById('sched-q-limit').value);
    
    saveSettings();
    showToast("Scheduler Updated", "Scheduler profile applied to the " + currentSchedQ + " queue.", "success");
    schedulerOverlay.style.display = 'none';
    processQueue();
});

schedulerBtn.addEventListener('click', () => {
    schedulerOverlay.style.display = 'flex';
    // Sync UI with Settings
    document.getElementById('sched-start-active').checked = appSettings.scheduler.startActive;
    document.getElementById('sched-start-time').value = appSettings.scheduler.startTime;
    document.getElementById('sched-stop-active').checked = appSettings.scheduler.stopActive;
    document.getElementById('sched-stop-time').value = appSettings.scheduler.stopTime;
    document.getElementById('sched-power-action-active').checked = appSettings.scheduler.powerActive;
    document.getElementById('sched-power-action').value = appSettings.scheduler.powerAction;
    document.getElementById('sched-q-limit').value = appSettings.scheduler.qLimit;
    
    schedTabs[0].click();
});
schedulerClose.addEventListener('click', () => schedulerOverlay.style.display = 'none');
schedulerCloseBtn.addEventListener('click', () => schedulerOverlay.style.display = 'none');
schedulerNewQueue.addEventListener('click', () => {
    const name = prompt("System: Enter the name for your new download queue profile:");
    if (name) {
        showToast("Queue Created", `Scheduler profile "${name.trim()}" initialized.`, "success");
    }
});

browseAv.addEventListener('click', () => ipcRenderer.send('select-av-file'));
ipcRenderer.on('selected-av-file', (e, p) => settingAvPath.value = p);

btnRename.addEventListener('click', () => {
    btnRename.classList.add('active');
    btnOverwrite.classList.remove('active');
});

btnOverwrite.addEventListener('click', () => {
    btnOverwrite.classList.add('active');
    btnRename.classList.remove('active');
});

function playNotificationSound(type) {
    if (!appSettings.enableSounds) return;
    const file = type === 'complete' ? appSettings.soundFiles.complete : appSettings.soundFiles.failed;
    if (file && file !== "Windows System Audio (Premium)" && fs.existsSync(file)) {
        const audio = new Audio(file);
        audio.play().catch(e => console.error("Sound play error", e));
    } else {
        // Fallback to system beep if no custom file
        ipcRenderer.send('play-system-sound');
    }
}
// Redundant Scheduler listeners REMOVED (already handled in "SCHEDULER MODAL LOGIC" section)
settingsBrowse.addEventListener('click', () => ipcRenderer.send('select-folder'));
folderBtn.addEventListener('click', () => ipcRenderer.send('select-folder'));
ipcRenderer.on('selected-folder', (e, p) => { if (optionsOverlay.style.display === 'flex') settingsPathInput.value = p; else { appSettings.downloadPath = p; saveSettings(); updateStatus(`Path set`); } });

browseSoundComplete.addEventListener('click', () => ipcRenderer.send('select-sound-file', 'complete'));
browseSoundFailed.addEventListener('click', () => ipcRenderer.send('select-sound-file', 'failed'));

ipcRenderer.on('selected-sound-file', (e, res) => {
    if (res.type === 'complete') soundComplete.value = res.path;
    else soundFailed.value = res.path;
});
settingsClear.addEventListener('click', () => { 
    showCustomAlert("Purge History", "System Alert: You are about to permanently purge your entire extraction history. Proceed?", "confirm", () => {
        Object.keys(processes).forEach(id => stopTask(Number(id))); 
        tasks = []; 
        saveTasks(); 
        renderTable(); 
    });
});

ipcRenderer.on('thumbnail-fetched', (e, res) => {
    if (res.success) {
        modalThumbnail.innerHTML = `<img src="${res.base64}" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        modalThumbnail.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; background:#222; color:#555;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width: 40px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`;
    }
});

engineUpdateBtn.addEventListener('click', () => { 
    if (activeTasksCount > 0) {
        showCustomAlert("Active Tasks", "Action Required: Please stop all active downloads before upgrading the core engine.", "error");
        return;
    }
    engineUpdateBtn.disabled = true;
    engineUpdateBtn.originalText = engineUpdateBtn.innerText;
    engineUpdateBtn.innerText = "Upgrading Engine...";
    statusBar.innerText = "System: Upgrading yt-dlp core engine contents..."; 
    ipcRenderer.send('update-engine'); 
});
ipcRenderer.on('engine-update-result', (e, res) => { 
    statusBar.innerText = res.success ? "System: Engine Upgrade Successful" : "System: Upgrade Failed"; 
    engineUpdateBtn.disabled = false;
    engineUpdateBtn.innerText = engineUpdateBtn.originalText || "Update yt-dlp Engine";
    showCustomAlert(res.success ? "Upgrade Success" : "Upgrade Failed", res.message, res.success ? "success" : "error"); 
});

selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.task-checkbox').forEach(cb => {
        cb.checked = isChecked;
        const taskId = Number(cb.closest('.table-row').id.replace('task-', ''));
        if (isChecked) selectedTaskIds.add(taskId);
        else selectedTaskIds.delete(taskId);
    });
    renderTable();
});

pauseBtn.addEventListener('click', () => {
    if (selectedTaskIds.size === 0) {
        showCustomAlert("Selection Required", "Action Required: Please select one or more tasks to pause.", "info");
        return;
    }
    selectedTaskIds.forEach(id => {
        const t = tasks.find(task => task.id === id);
        if (t && (t.status === 'Downloading' || t.status === 'Pending')) {
            stopTask(id);
            t.status = 'Paused';
            t.statusClass = 'status-badge'; 
            updateRowUI(id);
        }
    });
    updateStatus('System: Selected tasks paused');
    processQueue();
});

stopBtn.addEventListener('click', () => {
    if (selectedTaskIds.size === 0) {
        showCustomAlert("Selection Required", "Action Required: Please select tasks to stop.", "info");
        return;
    }
    selectedTaskIds.forEach(id => stopTask(id));
});

stopAllBtn.addEventListener('click', () => {
    tasks.forEach(t => stopTask(t.id));
    selectedTaskIds.clear();
    renderTable();
});

deleteBtn.addEventListener('click', () => {
    if (selectedTaskIds.size === 0) {
        showCustomAlert("Selection Required", "Action Required: Please select tasks to delete.", "info");
        return;
    }
    showCustomAlert(
        "Delete Tasks", 
        `System: Are you sure you want to delete ${selectedTaskIds.size} extraction record(s)?`, 
        "confirm", 
        () => {
            // Remove from List only
            deleteSelectedTasks(false);
        },
        null,
        null,
        () => {
            // Delete from Disk and List
            deleteSelectedTasks(true);
            showToast("Success", "Selected files removed from list and disk.", "success");
        }
    );
});

resumeBtn.addEventListener('click', () => {
    if (selectedTaskIds.size === 0) {
        showCustomAlert("Selection Required", "Action Required: Please select tasks to resume.", "info");
        return;
    }
    selectedTaskIds.forEach(id => {
        const t = tasks.find(task => task.id === id);
        if (t && ['Stopped', 'Error', 'Failed', 'Paused'].includes(t.status)) {
            startDownload(t.url, t.res.replace('p',''), id);
        }
    });
});

ctxOpen.addEventListener('click', () => selectedTaskId && shell.openPath(tasks.find(t => t.id === selectedTaskId).dest));
ctxCopy.addEventListener('click', () => selectedTaskId && (clipboard.writeText(tasks.find(t => t.id === selectedTaskId).url), showToast("Copied", "Media source URL has been securely copied to your clipboard.", "success")));
ctxRedownload.addEventListener('click', () => { if (selectedTaskId) { const t = tasks.find(t => t.id === selectedTaskId); stopTask(selectedTaskId); startDownload(t.url, t.res.replace('p',''), selectedTaskId); } });
ctxDelete.addEventListener('click', () => {
    if (!selectedTaskId) return;
    const t = tasks.find(tk => tk.id === selectedTaskId);
    if (!t) return;
    
    showCustomAlert(
        "Delete Task",
        `System: Are you sure you want to delete "${t.title}"?`,
        "confirm",
        () => deleteTask(selectedTaskId, false),
        null,
        null,
        () => {
            deleteTask(selectedTaskId, true);
            showToast("Success", "File removed from list and disk.", "success");
        }
    );
});
ctxMoveUp.addEventListener('click', () => { const idx = tasks.findIndex(t => t.id === selectedTaskId); if (idx > 0) { [tasks[idx], tasks[idx-1]] = [tasks[idx-1], tasks[idx]]; renderTable(); saveTasks(); } });
ctxMoveDown.addEventListener('click', () => { const idx = tasks.findIndex(t => t.id === selectedTaskId); if (idx < tasks.length - 1) { [tasks[idx], tasks[idx+1]] = [tasks[idx+1], tasks[idx]]; renderTable(); saveTasks(); } });

loadAll();
updateStatus('System: Operational');