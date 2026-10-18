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
    'weatherSettingsChanged'
]);

contextBridge.exposeInMainWorld('electronAPI', {
    getChinaDistrictCodes() {
        return ipcRenderer.invoke('getChinaDistrictCodes');
    },
    getWeatherSettings() {
        return ipcRenderer.invoke('getWeatherSettings');
    },
    saveWeatherSettings(settings) {
        return ipcRenderer.invoke('saveWeatherSettings', settings);
    },
    getWeatherSnapshot() {
        return ipcRenderer.invoke('getWeatherSnapshot');
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
