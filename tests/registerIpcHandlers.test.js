const test = require('node:test');
const assert = require('node:assert/strict');
const { registerIpcHandlers } = require('../electron/registerIpcHandlers');

function createHarness() {
    const handlers = new Map();
    const ipcMain = {
        on(channel, handler) {
            handlers.set(channel, handler);
        }
    };
    const sent = [];
    const win = {
        destroyed: false,
        isDestroyed() { return this.destroyed; },
        setIgnoreMouseEvents(...args) { this.ignoreArgs = args; },
        webContents: {
            send(...args) { sent.push(args); }
        }
    };
    const replies = [];
    const dialog = {
        showMessageBox: async (_window, options) => ({ response: options.defaultId ?? 1 })
    };
    const promptCalls = [];
    const prompt = async (options) => {
        promptCalls.push(options);
        return '12';
    };
    const tray = { popUpContextMenu(menu) { this.menu = menu; } };
    const form = { id: 'test-menu' };

    registerIpcHandlers({
        ipcMain,
        dialog,
        prompt,
        getWindow: () => win,
        getTrayMenu: () => ({ tray, form }),
        getBasePath: () => './',
        setAutoLaunch() {},
        store: { get() { return false; }, set() {} }
    });

    return { handlers, win, sent, replies, dialog, prompt, promptCalls, tray, form };
}

test('registers the expected main-process IPC handlers', () => {
    const { handlers } = createHarness();
    for (const channel of ['log', 'setIgnore', 'dialog', 'pop', 'getTimeOffset']) {
        assert.equal(typeof handlers.get(channel), 'function', channel);
    }
});

test('setIgnore toggles mouse event forwarding on the current window', () => {
    const { handlers, win } = createHarness();
    handlers.get('setIgnore')({}, true);
    assert.deepEqual(win.ignoreArgs, [true, { forward: true }]);

    handlers.get('setIgnore')({}, false);
    assert.deepEqual(win.ignoreArgs, [false]);
});

test('setIgnore safely ignores requests when the window is destroyed', () => {
    const { handlers, win } = createHarness();
    win.destroyed = true;
    assert.doesNotThrow(() => handlers.get('setIgnore')({}, true));
    assert.equal(win.ignoreArgs, undefined);
});

test('dialog replies with the original request and selected index', async () => {
    const { handlers, dialog } = createHarness();
    const replies = [];
    const event = {
        sender: { isDestroyed: () => false },
        reply: (...args) => replies.push(args)
    };
    const request = { reply: 'getSelectedClassIndex', options: { buttons: ['A', 'B'], defaultId: 0 } };

    handlers.get('dialog')(event, request);
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(replies.length, 1);
    assert.equal(replies[0][0], 'getSelectedClassIndex');
    assert.deepEqual(replies[0][1], { arg: request, index: 0 });
    assert.equal(typeof dialog.showMessageBox, 'function');
});

test('pop opens the current tray menu when available', () => {
    const { handlers, tray, form } = createHarness();
    handlers.get('pop')();
    assert.equal(tray.menu, form);
});

test('getTimeOffset prompts and sends a numeric time offset', async () => {
    const { handlers, sent, promptCalls } = createHarness();
    handlers.get('getTimeOffset')({}, 0);
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(promptCalls[0].value, '0');
    assert.deepEqual(sent, [['setTimeOffset', 12]]);
});

test('getTimeOffset does not send after cancellation', async () => {
    const handlers = new Map();
    const sent = [];
    const ipcMain = { on(channel, handler) { handlers.set(channel, handler); } };

    registerIpcHandlers({
        ipcMain,
        dialog: { showMessageBox: async () => ({ response: 0 }) },
        prompt: async () => null,
        getWindow: () => ({ isDestroyed: () => false, webContents: { send: (...args) => sent.push(args) } }),
        getTrayMenu: () => ({}),
        getBasePath: () => './',
        setAutoLaunch() {},
        store: { get() { return false; }, set() {} }
    });

    handlers.get('getTimeOffset')({}, 5);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(sent, []);
});


test('dialog rejects arbitrary reply channels and malformed options', () => {
    const { handlers } = createHarness();
    let called = false;
    const original = console.warn;
    console.warn = () => {};
    try {
        handlers.get('dialog')({ sender: { isDestroyed: () => false }, reply() { called = true; } }, {
            reply: 'untrusted-channel',
            options: { title: 'Oops', message: 'Nope', buttons: ['OK'] }
        });
        handlers.get('dialog')({ sender: { isDestroyed: () => false }, reply() { called = true; } }, {
            reply: 'getDayOffset',
            options: { title: 'Bad', message: 'No buttons', buttons: 'not-an-array' }
        });
    } finally {
        console.warn = original;
    }
    assert.equal(called, false);
});

test('setIgnore rejects non-boolean payloads', () => {
    const { handlers, win } = createHarness();
    handlers.get('setIgnore')({}, 'true');
    assert.equal(win.ignoreArgs, undefined);
});

test('getTimeOffset rejects malformed input before opening the prompt', () => {
    const { handlers, promptCalls } = createHarness();
    const original = console.warn;
    console.warn = () => {};
    try {
        handlers.get('getTimeOffset')({}, 'not-a-number');
    } finally {
        console.warn = original;
    }
    assert.equal(promptCalls.length, 0);
});

test('getTimeOffset rejects malformed prompt output', async () => {
    const handlers = new Map();
    const sent = [];
    const ipcMain = { on(channel, handler) { handlers.set(channel, handler); } };
    const original = console.warn;
    console.warn = () => {};
    try {
        registerIpcHandlers({
            ipcMain,
            dialog: { showMessageBox: async () => ({ response: 0 }) },
            prompt: async () => 'not-a-number',
            getWindow: () => ({ isDestroyed: () => false, webContents: { send: (...args) => sent.push(args) } }),
            getTrayMenu: () => ({}),
            getBasePath: () => './',
            setAutoLaunch() {},
            store: { get() { return false; }, set() {} }
        });
        handlers.get('getTimeOffset')({}, 5);
        await new Promise(resolve => setImmediate(resolve));
    } finally {
        console.warn = original;
    }
    assert.deepEqual(sent, []);
});
