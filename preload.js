const { contextBridge, ipcRenderer } = require('electron');

const sendChannels = new Set([
    'setIgnore',
    'dialog',
    'pop',
    'getWeekIndex',
    'getTimeOffset'
]);

const receiveChannels = new Set([
    'getSelectedClassIndex',
    'getSelectedChangingClass',
    'openSettingDialog',
    'setWeekIndex',
    'getWeekIndex',
    'getTimeOffset',
    'setTimeOffset',
    'ClassCountdown',
    'ClassHidden',
    'setDayOffset',
    'getDayOffset',
    'applyScheduleDay',
    'weatherSettingsChanged',
    'dateOverridesChanged',
    'appearanceSettingsChanged'
]);

contextBridge.exposeInMainWorld('electronAPI', {
    getDateOverrides() {
        return ipcRenderer.invoke('getDateOverrides');
    },
    saveDateOverrides(overrides) {
        return ipcRenderer.invoke('saveDateOverrides', overrides);
    },
    getChinaDistrictCodes() {
        return ipcRenderer.invoke('getChinaDistrictCodes');
    },
    getAppearanceSettings() {
        return ipcRenderer.invoke('getAppearanceSettings');
    },
    saveAppearanceSettings(settings) {
        return ipcRenderer.invoke('saveAppearanceSettings', settings);
    },
    getWeatherSettings() {
        return ipcRenderer.invoke('getWeatherSettings');
    },
    saveWeatherSettings(settings) {
        return ipcRenderer.invoke('saveWeatherSettings', settings);
    },
    setScheduleDay(day) {
        return ipcRenderer.invoke('setScheduleDay', day);
    },
    getWeatherSnapshot() {
        return ipcRenderer.invoke('getWeatherSnapshot');
    },
    logEvent(event, details) {
        if (typeof event !== 'string' || !/^user\.[a-z0-9_.-]{1,100}$/i.test(event)) {
            throw new TypeError('Invalid application log event');
        }
        ipcRenderer.send('appLogEvent', event, details);
    },
    send(channel, ...args) {
        if (!sendChannels.has(channel)) {
            throw new Error('Blocked IPC send channel: ' + channel);
        }
        ipcRenderer.send(channel, ...args);
    },
    on(channel, listener) {
        if (!receiveChannels.has(channel)) {
            throw new Error('Blocked IPC receive channel: ' + channel);
        }
        const wrappedListener = (_event, ...args) => listener(null, ...args);
        ipcRenderer.on(channel, wrappedListener);
        return () => ipcRenderer.removeListener(channel, wrappedListener);
    }
});
