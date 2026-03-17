const Datastore = require('nedb-promises');
const path = require('path');

const tasksDb = Datastore.create({ filename: path.join(__dirname, 'tasks.db'), autoload: true });
const settingsDb = Datastore.create({ filename: path.join(__dirname, 'settings.db'), autoload: true });

async function initDb() {
    console.log("NeDB (Portable) initialized successfully.");
}

// --- Task Operations ---
async function getAllTasks() {
    // Sort by order_index primarily, then by creation date/ID
    return await tasksDb.find({}).sort({ order_index: 1, created_at: -1 });
}

async function upsertTask(task) {
    if (!task.created_at) task.created_at = new Date().toISOString();
    if (task.order_index === undefined) task.order_index = 0;
    return await tasksDb.update({ id: task.id }, task, { upsert: true });
}

async function deleteTask(id) {
    return await tasksDb.remove({ id: id });
}

async function clearAllTasks() {
    return await tasksDb.remove({}, { multi: true });
}

// --- Settings Operations ---
async function getSettings() {
    const rows = await settingsDb.find({});
    const settings = {};
    rows.forEach(row => {
        settings[row.key] = row.value;
    });
    return settings;
}

async function saveSetting(key, value) {
    return await settingsDb.update({ key: key }, { key: key, value: value }, { upsert: true });
}

async function saveAllSettings(settingsObj) {
    for (const [key, value] of Object.entries(settingsObj)) {
        await saveSetting(key, value);
    }
}

module.exports = {
    initDb,
    getAllTasks,
    upsertTask,
    deleteTask,
    clearAllTasks,
    getSettings,
    saveSetting,
    saveAllSettings
};
