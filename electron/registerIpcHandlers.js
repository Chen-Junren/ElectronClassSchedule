const ALLOWED_DIALOG_REPLIES = new Set([
    'getSelectedClassIndex',
    'getSelectedChangingClass',
    'getDayOffset'
]);

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function normalizeDialogRequest(request) {
    if (!isPlainObject(request) || !ALLOWED_DIALOG_REPLIES.has(request.reply)) return null;
    if (!isPlainObject(request.options)) return null;

    const options = request.options;
    if (typeof options.title !== 'string' || options.title.length > 120) return null;
    if (typeof options.message !== 'string' || options.message.length > 2000) return null;
    if (!Array.isArray(options.buttons) || options.buttons.length < 1 || options.buttons.length > 32) return null;
    if (!options.buttons.every(button => typeof button === 'string' && button.length <= 200)) return null;

    const normalizedOptions = {
        title: options.title,
        message: options.message,
        buttons: options.buttons.slice(),
        cancelId: Number.isInteger(options.cancelId) ? options.cancelId : -1
    };

    if (Number.isInteger(options.defaultId)
        && options.defaultId >= 0
        && options.defaultId < normalizedOptions.buttons.length) {
        normalizedOptions.defaultId = options.defaultId;
    }

    return {
        reply: request.reply,
        options: normalizedOptions,
        index: Number.isInteger(request.index) ? request.index : undefined,
        classes: Array.isArray(request.classes)
            && request.classes.length <= 32
            && request.classes.every(item => typeof item === 'string' && item.length <= 100)
            ? request.classes.slice()
            : undefined
    };
}

function registerIpcHandlers({
    ipcMain,
    dialog,
    prompt,
    getWindow,
    getTrayMenu,
    getBasePath,
    setAutoLaunch,
    store
}) {
    ipcMain.on('log', (_event, arg) => {
        if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
            console.log(arg);
        }
    });

    ipcMain.on('setIgnore', (_event, shouldIgnore) => {
        if (typeof shouldIgnore !== 'boolean') return;
        const win = getWindow();
        if (!win || win.isDestroyed()) return;

        win.setIgnoreMouseEvents(shouldIgnore, shouldIgnore ? { forward: true } : undefined);
    });

    ipcMain.on('dialog', (event, request) => {
        const win = getWindow();
        if (!win || win.isDestroyed()) return;

        const normalizedRequest = normalizeDialogRequest(request);
        if (!normalizedRequest) {
            console.warn('[dialog] Rejected invalid dialog request');
            return;
        }

        dialog.showMessageBox(win, normalizedRequest.options).then((data) => {
            if (!event.sender || event.sender.isDestroyed()) return;
            event.reply(normalizedRequest.reply, {
                arg: request,
                index: data.response
            });
        }).catch((error) => {
            console.error('[dialog] Failed to show message box:', error);
        });
    });

    ipcMain.on('pop', () => {
        const trayMenu = getTrayMenu();
        if (trayMenu && trayMenu.tray && trayMenu.form) {
            trayMenu.tray.popUpContextMenu(trayMenu.form);
        }
    });

    ipcMain.on('getTimeOffset', (_event, arg) => {
        const initialOffset = Number(arg);
        if (!Number.isSafeInteger(initialOffset)) {
            console.warn('[getTimeOffset] Rejected invalid offset');
            return;
        }

        prompt({
            title: '计时矫正',
            label: '请设置课表计时与系统时间的偏移秒数:',
            value: String(initialOffset),
            inputAttrs: { type: 'number' },
            type: 'input',
            height: 180,
            width: 400,
            icon: getBasePath() + 'image/clock.png'
        }).then((result) => {
            if (result === null) {
                console.log('[getTimeOffset] User cancelled');
                return;
            }

            const value = Number(result);
            if (!Number.isSafeInteger(value)) {
                console.warn('[getTimeOffset] Rejected invalid prompt result');
                return;
            }

            const win = getWindow();
            if (win && !win.isDestroyed()) {
                win.webContents.send('setTimeOffset', value % 10000000000000);
            }
        }).catch((error) => {
            console.error('[getTimeOffset] Prompt failed:', error);
        });
    });
}

module.exports = { registerIpcHandlers, normalizeDialogRequest };
