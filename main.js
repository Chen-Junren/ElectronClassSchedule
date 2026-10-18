const { app, BrowserWindow, Menu, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const prompt = require('electron-prompt');
const Store = require('electron-store');
const { DisableMinimize } = require('electron-disable-minimize');

const { createAutoLaunchManager } = require('./electron/autoLaunch');
const { registerIpcHandlers } = require('./electron/registerIpcHandlers');
const { createTrayManager } = require('./electron/registerTray');
const { loadWeatherSettings, saveWeatherSettings } = require('./electron/weatherSettingsStore');
const { getWeatherSnapshot } = require('./electron/qweatherClient');

const store = new Store();
let win;
let settingsWindow = null;

const getBasePath = () => __dirname + path.sep;
const getWindow = () => win;

function openSettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.show();
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 960,
        height: 760,
        minWidth: 800,
        minHeight: 650,
        show: false,
        title: '电子课表设置',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
    settingsWindow.once('ready-to-show', () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.show();
    });
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}
const { setAutoLaunch } = createAutoLaunchManager({ app, store });
const trayManager = createTrayManager({
    app,
    dialog,
    getWindow,
    store,
    getBasePath,
    setAutoLaunch,
    openSettingsWindow
});

function createWindow() {
    win = new BrowserWindow({
        x: 0,
        y: 0,
        width: screen.getPrimaryDisplay().workAreaSize.width,
        height: 200,
        frame: false,
        transparent: true,
        alwaysOnTop: store.get('isWindowAlwaysOnTop', true),
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
        resizable: false,
        type: 'toolbar',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    win.loadFile(path.join(__dirname, 'index.html'));

    if (store.get('isWindowAlwaysOnTop', true)) {
        win.setAlwaysOnTop(true, 'screen-saver', 9999999999999);
    }

    win.webContents.on('did-finish-load', () => {
        const currentWindow = getWindow();
        if (!currentWindow || currentWindow.isDestroyed()) return;
        currentWindow.webContents.send('getWeekIndex');
    });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock({ key: 'classSchedule' });

if (!hasSingleInstanceLock) {
    app.quit();
} else {
    ipcMain.handle('setScheduleDay', (_event, day) => {
        if (!Number.isInteger(day) || day < 0 || day > 7) {
            throw new TypeError('Invalid schedule day');
        }
        if (!win || win.isDestroyed()) {
            throw new Error('课表窗口尚未准备好');
        }
        win.webContents.send('applyScheduleDay', day);
        return { ok: true };
    });
    ipcMain.handle('getChinaDistrictCodes', () => require('./data/china-district-codes.json'));
    ipcMain.handle('getWeatherSettings', () => loadWeatherSettings(store));
    ipcMain.handle('saveWeatherSettings', (_event, value) => {
        const saved = saveWeatherSettings(store, value);
        if (win && !win.isDestroyed()) win.webContents.send('weatherSettingsChanged');
        return saved;
    });
    ipcMain.handle('getWeatherSnapshot', async () => {
        const settings = loadWeatherSettings(store);
        return getWeatherSnapshot(settings, {
            saveSettings: (value) => saveWeatherSettings(store, value)
        });
    });
    trayManager.registerWeekMenuHandler(ipcMain);
    registerIpcHandlers({
        ipcMain,
        dialog,
        prompt,
        getWindow,
        getTrayMenu: trayManager.getTrayMenu,
        getBasePath,
        setAutoLaunch,
        store
    });

    app.whenReady().then(() => {
        createWindow();
        Menu.setApplicationMenu(null);

        const handle = win.getNativeWindowHandle();
        DisableMinimize(handle);
        setAutoLaunch();
    });
}
