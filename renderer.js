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
const modalUrl = document.getElementById('modal-url');
const modalRes = document.getElementById('modal-res');

// Options Modal
const optionsOverlay = document.getElementById('options-overlay');
const optionsBtn = document.getElementById('options-btn');
const optionsClose = document.getElementById('options-close');
const optionsSave = document.getElementById('options-save');
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
const schedStartTime = document.getElementById('sched-start-time');
const schedStopTime = document.getElementById('sched-stop-time');
const schedPowerAction = document.getElementById('sched-power-action');
const schedPreventSleep = document.getElementById('sched-prevent-sleep');

// Toolbar Buttons
const resumeBtn = document.getElementById('resume-btn');
const stopBtn = document.getElementById('stop-btn');
const stopAllBtn = document.getElementById('stop-all-btn');
const deleteBtn = document.getElementById('delete-btn');
const folderBtn = document.getElementById('change-folder-btn');

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

// State
let appSettings = {
    downloadPath: __dirname,
    speedLimit: "0",
    maxConcurrent: 5,
    scheduler: { startTime: "", stopTime: "", powerAction: "none", preventSleep: true }
};

let tasks = [];
let processes = {};
let selectedTaskId = null;
let currentFilter = 'all';
let currentSearch = '';
let activeTasksCount = 0;
let sortField = 'id';
let sortOrder = 'desc';

const enginePath = path.join(__dirname, 'engine.py');
const dbPath = path.join(__dirname, 'tasks.json');
const settingsPath = path.join(__dirname, 'settings.json');

// --- DATABASE & SETTINGS LOGIC ---
function loadAll() {
    if (fs.existsSync(settingsPath)) {
        try {
            appSettings = { ...appSettings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
            settingsPathInput.value = appSettings.downloadPath;
            settingsSpeedLimit.value = appSettings.speedLimit || "0";
            if (appSettings.scheduler) {
                schedStartTime.value = appSettings.scheduler.startTime;
                schedStopTime.value = appSettings.scheduler.stopTime;
                schedPowerAction.value = appSettings.scheduler.powerAction;
                schedPreventSleep.checked = appSettings.scheduler.preventSleep;
            }
        } catch (e) { console.error("Settings load error", e); }
    } else {
        settingsPathInput.value = appSettings.downloadPath;
    }

    if (fs.existsSync(dbPath)) {
        try {
            tasks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            tasks.forEach(t => { if (['Downloading', 'Analyzing'].includes(t.status)) { t.status = 'Stopped'; t.statusClass = 'status-badge'; } });
            renderTable();
        } catch (e) { console.error("Database load error", e); }
    }
    startSchedulerService();
}

function saveTasks() {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(tasks, null, 2));
        updateBadges();
    } catch (e) { console.error("Save error", e); }
}

function saveSettings() {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2));
    } catch (e) { console.error("Settings save error", e); }
}

// --- SERVICES ---
function startSchedulerService() {
    setInterval(() => {
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        if (appSettings.scheduler.startTime === currentTime) tasks.forEach(t => { if (['Stopped', 'Failed'].includes(t.status) && !processes[t.id]) startDownload(t.url, t.res.replace('p',''), t.id); });
        if (appSettings.scheduler.stopTime === currentTime) Object.keys(processes).forEach(id => stopTask(Number(id)));
    }, 60000);
}

function updateSleepPrevention() {
    ipcRenderer.send('prevent-sleep', appSettings.scheduler.preventSleep && activeTasksCount > 0);
}

function checkQueueCompletion() {
    if (!tasks.some(t => ['Downloading', 'Analyzing'].includes(t.status)) && appSettings.scheduler.powerAction !== 'none') {
        setTimeout(() => ipcRenderer.send('power-action', appSettings.scheduler.powerAction), 5000);
    }
}

function showNotification(title, body) {
    new Notification(title, { body }).onclick = () => ipcRenderer.send('focus-window');
}

// --- UI HELPERS ---
function updateStatus(msg) { statusBar.innerText = `${msg} | ${activeTasksCount} active tasks`; updateSleepPrevention(); }

function updateBadges() {
    document.getElementById('badge-all').innerText = tasks.length;
    ['unfinished', 'finished', 'failed'].forEach(f => {
        document.getElementById(`badge-${f}`).innerText = tasks.filter(t => f === 'unfinished' ? ['Downloading', 'Analyzing'].includes(t.status) : f === 'finished' ? t.status === 'Finished' : ['Error', 'Failed'].includes(t.status)).length;
    });
    ['video', 'music', 'documents', 'compressed', 'programs'].forEach(type => { document.getElementById(`badge-${type}`).innerText = tasks.filter(t => t.type === type).length; });
}

function getFileType(title) {
    const ext = title.split('.').pop().toLowerCase();
    const map = { video: ['mp4', 'mkv', 'webm', 'avi', 'mov'], music: ['mp3', 'm4a', 'wav', 'flac'], documents: ['pdf', 'doc', 'docx', 'txt'], compressed: ['zip', 'rar', '7z', 'gz', 'tar'], programs: ['exe', 'msi', 'dmg', 'sh', 'apk'] };
    for (let type in map) if (map[type].includes(ext)) return type;
    return 'video';
}

function renderTable() {
    downloadList.innerHTML = '';
    let filtered = tasks.filter(t => {
        const matchesCat = currentFilter === 'all' || (currentFilter === 'unfinished' && ['Downloading', 'Analyzing'].includes(t.status)) || (currentFilter === 'finished' && t.status === 'Finished') || (currentFilter === 'failed' && ['Error', 'Failed'].includes(t.status)) || (t.type === currentFilter);
        const matchesSearch = t.title.toLowerCase().includes(currentSearch.toLowerCase());
        return matchesCat && matchesSearch;
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
    row.className = `table-row ${selectedTaskId === task.id ? 'selected' : ''}`;
    row.id = `task-${task.id}`;
    row.innerHTML = `<div class="file-name" title="${task.title}">${task.title}</div><div class="file-size">${task.size || '---'}</div><div class="file-status"><span class="status-badge ${task.statusClass}">${task.status}</span></div><div class="file-eta">${task.eta || '---'}</div><div class="file-rate">${task.rate || '---'}</div><div class="file-res">${task.res || '---'}</div><div class="file-progress"><div style="width: 100%; background: #222; height: 4px; border-radius: 2px;"><div class="progress-bar" style="width: ${task.progress || '0%'}; background: var(--accent); height: 100%; border-radius: 2px; transition: 0.3s;"></div></div></div>`;
    row.addEventListener('click', () => { document.querySelectorAll('.table-row').forEach(r => r.classList.remove('selected')); row.classList.add('selected'); selectedTaskId = task.id; });
    row.addEventListener('contextmenu', (e) => { e.preventDefault(); selectedTaskId = task.id; document.querySelectorAll('.table-row').forEach(r => r.classList.remove('selected')); row.classList.add('selected'); contextMenu.style.top = `${e.pageY}px`; contextMenu.style.left = `${e.pageX}px`; contextMenu.style.display = 'block'; });
    row.addEventListener('dblclick', () => { if (task.status === 'Finished') shell.openPath(task.dest); });
    return row;
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
    if (processes[taskId]) { processes[taskId].kill(); delete processes[taskId]; const t = tasks.find(t => t.id === taskId); if (t) { t.status = 'Stopped'; t.statusClass = 'status-badge'; updateRowUI(taskId); } if (activeTasksCount > 0) activeTasksCount--; updateStatus('System: Task Suspended'); }
}

function deleteTask(taskId) { stopTask(taskId); tasks = tasks.filter(t => t.id !== taskId); if (selectedTaskId === taskId) selectedTaskId = null; renderTable(); saveTasks(); }

function startDownload(url, res, existingTaskId = null) {
    const taskId = existingTaskId || Date.now();
    const dest = appSettings.downloadPath;
    if (!existingTaskId) { tasks.unshift({ id: taskId, url, title: "Analyzing...", status: "Analyzing", statusClass: "status-downloading", res: res + "p", progress: "0%", dest, type: "video" }); renderTable(); }
    else { const t = tasks.find(t => t.id === taskId); t.status = "Analyzing"; t.statusClass = "status-downloading"; updateRowUI(taskId); }
    activeTasksCount++; updateStatus('System: Initiating Extraction...');
    const info = spawn('python', ['-u', enginePath, 'info', url]);
    let infoData = ""; info.stdout.on('data', d => infoData += d);
    info.on('close', code => {
        const t = tasks.find(t => t.id === taskId);
        if (!t) return;
        if (code === 0) { try { const data = JSON.parse(infoData); t.title = data.title; t.type = getFileType(data.title); t.size = (data.filesize_approx / (1024 * 1024)).toFixed(1) + " MB"; renderTable(); launchEngine(taskId, url, res, dest); } catch (e) { launchEngine(taskId, url, res, dest); } }
        else { t.status = 'Failed'; t.statusClass = 'status-error'; updateRowUI(taskId); if (activeTasksCount > 0) activeTasksCount--; updateStatus('System: Metadata Extraction Failed'); }
    });
}

function launchEngine(taskId, url, res, dest) {
    const args = ['-u', enginePath, 'download', url, res, dest];
    if (appSettings.speedLimit && appSettings.speedLimit !== "0") args.push(appSettings.speedLimit);
    const dl = spawn('python', args);
    processes[taskId] = dl;
    const t = tasks.find(t => t.id === taskId);
    t.status = 'Downloading'; t.statusClass = 'status-downloading'; updateRowUI(taskId);
    dl.stdout.on('data', data => {
        const out = data.toString();
        if (out.includes("PROGRESS:")) { const p = out.split('|'); t.progress = p[0].split("PROGRESS:")[1].trim(); t.rate = p[1]?.split("SPEED:")[1].trim() || "---"; t.eta = p[2]?.split("ETA:")[1].trim() || "---"; updateRowUI(taskId); }
    });
    dl.on('close', code => {
        delete processes[taskId]; if (activeTasksCount > 0) activeTasksCount--;
        if (code === 0) { t.status = 'Finished'; t.statusClass = 'status-finished'; t.progress = '100%'; t.eta = 'Done'; t.rate = '0 KB/s'; showNotification("Complete", t.title); }
        else if (t.status !== 'Stopped') { t.status = 'Error'; t.statusClass = 'status-error'; }
        updateRowUI(taskId); updateStatus('System: Idle'); checkQueueCompletion();
    });
}

// --- LISTENERS ---
window.addEventListener('click', () => contextMenu.style.display = 'none');
searchInput.addEventListener('input', e => { currentSearch = e.target.value; renderTable(); });
document.querySelectorAll('.sortable').forEach(h => h.addEventListener('click', () => { const f = h.getAttribute('data-sort'); if (sortField === f) sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'; else { sortField = f; sortOrder = 'asc'; } renderTable(); }));
navItems.forEach(i => i.addEventListener('click', () => { navItems.forEach(n => n.classList.remove('active')); i.classList.add('active'); currentFilter = i.getAttribute('data-filter'); renderTable(); }));
addUrlBtn.addEventListener('click', () => { modalOverlay.style.display = 'flex'; modalUrl.focus(); });
modalCancel.addEventListener('click', () => { modalOverlay.style.display = 'none'; modalUrl.value = ''; });
modalDownload.addEventListener('click', () => { const u = modalUrl.value.trim(); if (u) { modalOverlay.style.display = 'none'; modalUrl.value = ''; startDownload(u, modalRes.value); } });
optionsBtn.addEventListener('click', () => { settingsPathInput.value = appSettings.downloadPath; settingsSpeedLimit.value = appSettings.speedLimit; optionsOverlay.style.display = 'flex'; });
optionsClose.addEventListener('click', () => optionsOverlay.style.display = 'none');
optionsSave.addEventListener('click', () => { appSettings.downloadPath = settingsPathInput.value; appSettings.speedLimit = settingsSpeedLimit.value; saveSettings(); optionsOverlay.style.display = 'none'; });
schedulerBtn.addEventListener('click', () => schedulerOverlay.style.display = 'flex');
schedulerClose.addEventListener('click', () => schedulerOverlay.style.display = 'none');
schedulerSave.addEventListener('click', () => { appSettings.scheduler = { startTime: schedStartTime.value, stopTime: schedStopTime.value, powerAction: schedPowerAction.value, preventSleep: schedPreventSleep.checked }; saveSettings(); updateSleepPrevention(); schedulerOverlay.style.display = 'none'; });
settingsBrowse.addEventListener('click', () => ipcRenderer.send('select-folder'));
folderBtn.addEventListener('click', () => ipcRenderer.send('select-folder'));
ipcRenderer.on('selected-folder', (e, p) => { if (optionsOverlay.style.display === 'flex') settingsPathInput.value = p; else { appSettings.downloadPath = p; saveSettings(); updateStatus(`Path set`); } });
settingsClear.addEventListener('click', () => { if (confirm("System Alert: You are about to permanently purge your entire extraction history. Proceed?")) { Object.keys(processes).forEach(id => stopTask(Number(id))); tasks = []; saveTasks(); renderTable(); } });

engineUpdateBtn.addEventListener('click', () => { 
    if (activeTasksCount > 0) {
        alert("Action Required: Please stop all active downloads before upgrading the core engine.");
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
    alert(res.message); 
});

stopBtn.addEventListener('click', () => selectedTaskId ? stopTask(selectedTaskId) : alert("Action Required: Please select a task from the list to suspend."));
stopAllBtn.addEventListener('click', () => Object.keys(processes).forEach(id => stopTask(Number(id))));
deleteBtn.addEventListener('click', () => selectedTaskId && confirm("System: Are you sure you want to permanently delete this extraction record?") ? deleteTask(selectedTaskId) : (selectedTaskId ? null : alert("Action Required: Please select a task to delete.")));
resumeBtn.addEventListener('click', () => { if (selectedTaskId) { const t = tasks.find(t => t.id === selectedTaskId); if (t && ['Stopped', 'Error', 'Failed'].includes(t.status)) startDownload(t.url, t.res.replace('p',''), selectedTaskId); } else alert("Action Required: Please select a task to resume."); });

ctxOpen.addEventListener('click', () => selectedTaskId && shell.openPath(tasks.find(t => t.id === selectedTaskId).dest));
ctxCopy.addEventListener('click', () => selectedTaskId && (clipboard.writeText(tasks.find(t => t.id === selectedTaskId).url), alert("Success: Media source URL has been securely copied to your clipboard.")));
ctxRedownload.addEventListener('click', () => { if (selectedTaskId) { const t = tasks.find(t => t.id === selectedTaskId); stopTask(selectedTaskId); startDownload(t.url, t.res.replace('p',''), selectedTaskId); } });
ctxDelete.addEventListener('click', () => selectedTaskId && deleteTask(selectedTaskId));
ctxMoveUp.addEventListener('click', () => { const idx = tasks.findIndex(t => t.id === selectedTaskId); if (idx > 0) { [tasks[idx], tasks[idx-1]] = [tasks[idx-1], tasks[idx]]; renderTable(); saveTasks(); } });
ctxMoveDown.addEventListener('click', () => { const idx = tasks.findIndex(t => t.id === selectedTaskId); if (idx < tasks.length - 1) { [tasks[idx], tasks[idx+1]] = [tasks[idx+1], tasks[idx]]; renderTable(); saveTasks(); } });

loadAll();
updateStatus('System: Operational');