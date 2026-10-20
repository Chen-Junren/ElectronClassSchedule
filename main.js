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
const { loadDateOverrides, saveDateOverrides } = require('./electron/dateOverrideStore');
const { loadAppearanceSettings, saveAppearanceSettings } = require('./electron/appearanceSettingsStore');
const { createLogger } = require('./electron/logger');
const { createExamManager } = require('./electron/examManager');
const { createExamStateBroadcaster } = require('./electron/examStateBroadcaster');
const { resolvePendingExamOnStartup: resolvePendingExamOnStartupFlow } = require('./electron/examStartupRecovery');

const store = new Store();
const examManager = createExamManager({ store });
const logger = createLogger({ filePath: path.join(app.getPath('userData'), 'logs', 'app.log') });
let win;

logger.info('app.start', {
    version: app.getVersion(),
    platform: process.platform,
    architecture: process.arch,
    packaged: app.isPackaged,
    logFilePath: logger.filePath
});
process.on('uncaughtException', (error) => {
    logger.error('process.uncaughtException', error);
    app.quit();
});
process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandledRejection', reason instanceof Error ? reason : { reason });
});
let settingsWindow = null;
let examTicker = null;
const examStateBroadcaster = createExamStateBroadcaster({
    getSnapshot: () => examManager.getSnapshot(),
    getWindows: () => [win, settingsWindow]
});
const broadcastExamState = (...args) => examStateBroadcaster.broadcast(...args);

async function resolvePendingExamOnStartup() {
    return resolvePendingExamOnStartupFlow({ examManager, dialog, logger });
}

const getBasePath = () => __dirname + path.sep;
const getWindow = () => win;

function openSettingsWindow() {
    logger.info('ui.open_settings_window');
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

    settingsWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        logger.error('window.settings.load_failed', { errorCode, errorDescription, url: validatedURL });
    });
    settingsWindow.webContents.on('render-process-gone', (_event, details) => {
        logger.error('window.settings.renderer_gone', details);
    });
    settingsWindow.loadFile(path.join(__dirname, 'settings.html')).catch(error => {
        logger.error('window.settings.load_error', error);
    });
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
    logger,
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

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        logger.error('window.main.load_failed', { errorCode, errorDescription, url: validatedURL });
    });
    win.webContents.on('render-process-gone', (_event, details) => {
        logger.error('window.main.renderer_gone', details);
    });
    win.loadFile(path.join(__dirname, 'index.html')).catch(error => {
        logger.error('window.main.load_error', error);
    });

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
        logger.info('user.schedule_day_change_requested', { day });
        if (!Number.isInteger(day) || day < 0 || day > 7) {
            throw new TypeError('Invalid schedule day');
        }
        if (!win || win.isDestroyed()) {
            throw new Error('课表窗口尚未准备好');
        }
        win.webContents.send('applyScheduleDay', day);
        return { ok: true };
    });
    ipcMain.handle('exam:getState', () => {
        const snapshot = examManager.getSnapshot();
        broadcastExamState(false, snapshot);
        return snapshot;
    });
    ipcMain.handle('exam:saveSettings', (_event, value) => {
        const snapshot = examManager.saveSettings(value);
        broadcastExamState(true, snapshot);
        return snapshot;
    });
    ipcMain.handle('exam:start', (_event, value) => {
        const snapshot = examManager.start(value);
        broadcastExamState(true, snapshot);
        return snapshot;
    });
    ipcMain.handle('exam:pause', () => {
        const snapshot = examManager.pause();
        broadcastExamState(true, snapshot);
        return snapshot;
    });
    ipcMain.handle('exam:resume', () => {
        const snapshot = examManager.resume();
        broadcastExamState(true, snapshot);
        return snapshot;
    });
    ipcMain.handle('exam:endEarly', () => {
        const snapshot = examManager.endEarly();
        broadcastExamState(true, snapshot);
        return snapshot;
    });
    ipcMain.handle('exam:exit', () => {
        const snapshot = examManager.exit();
        broadcastExamState(true, snapshot);
        return snapshot;
    });
    ipcMain.handle('getDateOverrides', () => {
        const overrides = loadDateOverrides(store);
        logger.debug('settings.date_overrides.loaded', { count: overrides.length });
        return overrides;
    });
    ipcMain.handle('saveDateOverrides', (_event, value) => {
        logger.info('user.date_overrides.save_requested', { count: Array.isArray(value) ? value.length : null, entries: value });
        const overrides = saveDateOverrides(store, value);
        logger.info('settings.date_overrides.saved', { count: overrides.length, entries: overrides });
        if (win && !win.isDestroyed()) win.webContents.send('dateOverridesChanged', overrides);
        return overrides;
    });
    ipcMain.handle('getChinaDistrictCodes', () => require('./data/china-district-codes.json'));
    ipcMain.handle('getAppearanceSettings', () => {
        const settings = loadAppearanceSettings(store);
        logger.debug('settings.appearance.loaded', settings);
        return settings;
    });
    ipcMain.handle('saveAppearanceSettings', (_event, value) => {
        logger.info('user.appearance.save_requested', value);
        const saved = saveAppearanceSettings(store, value);
        logger.info('settings.appearance.saved', saved);
        if (win && !win.isDestroyed()) win.webContents.send('appearanceSettingsChanged', saved);
        if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send('appearanceSettingsChanged', saved);
        return saved;
    });
    ipcMain.handle('getWeatherSettings', () => {
        const settings = loadWeatherSettings(store);
        logger.debug('settings.weather.loaded', settings);
        return settings;
    });
    ipcMain.handle('saveWeatherSettings', (_event, value) => {
        logger.info('user.weather_settings.save_requested', value);
        const saved = saveWeatherSettings(store, value);
        logger.info('settings.weather.saved', saved);
        if (win && !win.isDestroyed()) win.webContents.send('weatherSettingsChanged');
        return saved;
    });
    ipcMain.handle('getWeatherSnapshot', async () => {
        const settings = loadWeatherSettings(store);
        logger.info('user.weather_refresh_requested', {
            enabled: settings.enabled,
            apiHost: settings.apiHost,
            geoApiHost: settings.geoApiHost,
            region: settings.region ? {
                label: settings.region.label,
                province: settings.region.province,
                city: settings.region.city,
                district: settings.region.district,
                adminCode: settings.region.adminCode,
                qweatherLocationId: settings.region.qweatherLocationId
            } : null
        });
        try {
            const snapshot = await getWeatherSnapshot(settings, {
                logger,
                saveSettings: (value) => saveWeatherSettings(store, value)
            });
            logger.info('user.weather_refresh_completed', {
                enabled: snapshot && snapshot.enabled,
                regionLabel: snapshot && snapshot.regionLabel,
                locationId: snapshot && snapshot.locationId,
                now: snapshot && snapshot.now,
                nextHour: snapshot && snapshot.nextHour,
                fetchedAt: snapshot && snapshot.fetchedAt
            });
            return snapshot;
        } catch (error) {
            logger.error('user.weather_refresh_failed', error);
            throw error;
        }
    });
    trayManager.registerWeekMenuHandler(ipcMain);
    registerIpcHandlers({
        ipcMain,
        logger,
        dialog,
        prompt,
        getWindow,
        getTrayMenu: trayManager.getTrayMenu,
        getBasePath,
        setAutoLaunch,
        store
    });

    app.whenReady().then(async () => {
        logger.info('app.ready');
        await resolvePendingExamOnStartup();
        createWindow();
        if (examTicker) clearInterval(examTicker);
        examTicker = setInterval(() => broadcastExamState(false), 250);
        Menu.setApplicationMenu(null);

        const handle = win.getNativeWindowHandle();
        DisableMinimize(handle);
        setAutoLaunch();
        logger.info('app.initialization_completed');
    }).catch(error => {
        logger.error('app.initialization_failed', error);
    });
    app.on('before-quit', () => {
        if (examTicker) clearInterval(examTicker);
        logger.info('app.before_quit');
    });
    app.on('will-quit', () => logger.info('app.will_quit'));
}
