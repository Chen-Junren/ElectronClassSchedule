const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrayManager } = require('../electron/registerTray');

function createHarness() {
    const handlers = new Map();
    const sent = [];
    const windows = [];
    let currentWindow = null;
    let trayInstance;
    let menuTemplate;
    let settingsOpenCount = 0;

    class FakeTray {
        constructor(iconPath) { this.iconPath = iconPath; this.events = new Map(); trayInstance = this; }
        setToolTip(value) { this.tooltip = value; }
        on(name, callback) { this.events.set(name, callback); }
        setContextMenu(menu) { this.menu = menu; }
        popUpContextMenu(menu) { this.popupMenu = menu; }
    }
    const menuApi = { buildFromTemplate(template) { menuTemplate = template; return { template }; } };
    const storeValues = new Map([
        ['isDuringClassCountdown', true], ['isDuringClassHidden', true],
        ['isWindowAlwaysOnTop', true], ['isAutoLaunch', false]
    ]);
    const store = {
        get(key, fallback) { return storeValues.has(key) ? storeValues.get(key) : fallback; },
        set(key, value) { storeValues.set(key, value); }
    };
    const ipcMain = { on(channel, callback) { handlers.set(channel, callback); } };
    const app = { quit() { this.quitCalled = true; } };
    const dialog = { showMessageBox: async () => ({ response: 0 }) };
    const manager = createTrayManager({
        app, dialog, getWindow: () => currentWindow, store, getBasePath: () => '/app/',
        setAutoLaunch() {}, openSettingsWindow() { settingsOpenCount += 1; },
        Menu: menuApi, Tray: FakeTray, shell: { openExternal() {} }
    });

    function makeWindow() {
        const win = {
            destroyed: false,
            isDestroyed() { return this.destroyed; },
            webContents: { send(...args) { sent.push(args); } },
            setAlwaysOnTop() {}
        };
        windows.push(win);
        currentWindow = win;
        return win;
    }
    return {
        handlers, sent, windows, makeWindow, manager,
        get tray() { return trayInstance; },
        get template() { return menuTemplate; },
        get settingsOpenCount() { return settingsOpenCount; },
        get currentWindow() { return currentWindow; }
    };
}

function findItem(template, label) {
    for (const item of template || []) {
        if (item.label === label) return item;
        const nested = findItem(item.submenu, label);
        if (nested) return nested;
    }
    return null;
}

function allLabels(template, result = []) {
    for (const item of template || []) {
        if (item.label) result.push(item.label);
        allLabels(item.submenu, result);
    }
    return result;
}

test('tray menu initializes once, groups items, and marks the selected week', () => {
    const harness = createHarness();
    harness.makeWindow();
    harness.manager.registerWeekMenuHandler({ on: (channel, callback) => harness.handlers.set(channel, callback) });
    harness.handlers.get('getWeekIndex')({}, 2);
    assert.equal(harness.tray.iconPath, '/app/image/icon.png');
    assert.equal(harness.tray.tooltip, '电子课表');
    assert.equal(harness.template[0].label, '四周循环');
    assert.equal(findItem(harness.template, '第三周').checked, true);
    assert.deepEqual(harness.sent.slice(-2), [['ClassCountdown', true], ['ClassHidden', true]]);
});

test('tray callbacks target the current window and safely ignore destroyed windows', () => {
    const harness = createHarness();
    const firstWindow = harness.makeWindow();
    harness.manager.registerWeekMenuHandler({ on: (channel, callback) => harness.handlers.set(channel, callback) });
    harness.handlers.get('getWeekIndex')({}, 0);
    const secondWindow = harness.makeWindow();
    findItem(harness.template, '第二周').click();
    assert.deepEqual(harness.sent.at(-1), ['setWeekIndex', 1]);
    secondWindow.destroyed = true;
    const sentCount = harness.sent.length;
    findItem(harness.template, '第三周').click();
    assert.equal(harness.sent.length, sentCount);
    assert.equal(firstWindow.destroyed, false);
});

test('tray handler ignores invalid week selection and missing windows', () => {
    const harness = createHarness();
    harness.manager.registerWeekMenuHandler({ on: (channel, callback) => harness.handlers.set(channel, callback) });
    harness.handlers.get('getWeekIndex')({}, 1);
    assert.equal(harness.tray, undefined);
    harness.makeWindow();
    harness.handlers.get('getWeekIndex')({}, 99);
    assert.equal(harness.template[0].submenu.some(item => item.checked === true), false);
});

test('tray configuration menu opens the unified settings window', () => {
    const harness = createHarness();
    harness.makeWindow();
    harness.manager.registerWeekMenuHandler({ on: (channel, callback) => harness.handlers.set(channel, callback) });
    harness.handlers.get('getWeekIndex')({}, 0);
    findItem(harness.template, '配置课表与外观').click();
    assert.equal(harness.settingsOpenCount, 1);
});

test('tray menu groups settings and behavior and omits source repository links', () => {
    const harness = createHarness();
    harness.makeWindow();
    harness.manager.registerWeekMenuHandler({ on: (channel, callback) => harness.handlers.set(channel, callback) });
    harness.handlers.get('getWeekIndex')({}, 0);
    const labels = allLabels(harness.template);
    assert.equal(labels.includes('切换日程'), false);
    assert.equal(labels.includes('源码仓库'), false);
    assert.equal(labels.includes('配置课表与外观'), true);
    assert.equal(labels.includes('窗口行为'), true);
    assert.equal(labels.includes('启动与退出'), true);
});
