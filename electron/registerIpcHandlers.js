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
        cancelId: Number.isInteger(options.cancelId)
            && options.cancelId >= -1
            && options.cancelId < options.buttons.length
            ? options.cancelId
            : -1
    };

    if (Number.isInteger(options.defaultId)
        && options.defaultId >= 0
        && options.defaultId < normalizedOptions.buttons.length) {
        normalizedOptions.defaultId = options.defaultId;
    }

    const normalizedRequest = {
        reply: request.reply,
        options: normalizedOptions
    };

    if (request.reply === 'getSelectedChangingClass') {
        if (!Number.isInteger(request.index) || request.index < 0 || request.index >= 32) return null;
        if (!Array.isArray(request.classes)
            || request.classes.length < 1
            || request.classes.length > 32
            || !request.classes.every(item => typeof item === 'string' && item.length <= 100)) return null;
        if (request.classes.length !== normalizedOptions.buttons.length) return null;
        normalizedRequest.index = request.index;
        normalizedRequest.classes = request.classes.slice();
    }

    return normalizedRequest;
}

function registerIpcHandlers({
    ipcMain,
    dialog,
    prompt,
    getWindow,
    getTrayMenu,
    getBasePath,
    setAutoLaunch,
    store,
    logger
}) {
    const writeLog = (level, event, details) => {
        if (logger && typeof logger[level] === 'function') logger[level](event, details);
    };

    ipcMain.on('appLogEvent', (_event, event, details) => {
        if (typeof event !== 'string' || !/^user\\.[a-z0-9_.-]{1,100}$/i.test(event)) {
            writeLog('warn', 'renderer.log_event_rejected', { reason: 'Invalid event name' });
            return;
        }
        writeLog('info', event, details);
    });

    ipcMain.on('log', (_event, arg) => {
        if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
            writeLog('info', 'renderer.log', { value: arg });
            console.log(arg);
        }
    });

    ipcMain.on('setIgnore', (_event, shouldIgnore) => {
        if (typeof shouldIgnore !== 'boolean') return;
        const win = getWindow();
        if (!win || win.isDestroyed()) return;

        if (shouldIgnore) {
            win.setIgnoreMouseEvents(true, { forward: true });
        } else {
            win.setIgnoreMouseEvents(false);
        }
    });

    ipcMain.on('dialog', (event, request) => {
        writeLog('info', 'user.dialog.requested', {
            reply: request && request.reply,
            title: request && request.options && request.options.title,
            message: request && request.options && request.options.message,
            buttons: request && request.options && request.options.buttons
        });
        const win = getWindow();
        if (!win || win.isDestroyed()) return;

        const normalizedRequest = normalizeDialogRequest(request);
        if (!normalizedRequest) {
            writeLog('warn', 'dialog.request_rejected', { reason: 'Invalid dialog request' });
            console.warn('[dialog] Rejected invalid dialog request');
            return;
        }

        dialog.showMessageBox(win, normalizedRequest.options).then((data) => {
            if (!event.sender || event.sender.isDestroyed()) return;
            const responseIndex = Number.isInteger(data.response)
                && data.response >= 0
                && data.response < normalizedRequest.options.buttons.length
                ? data.response
                : -1;
            writeLog('info', 'user.dialog.responded', { reply: normalizedRequest.reply, responseIndex });
            event.reply(normalizedRequest.reply, {
                arg: normalizedRequest,
                index: responseIndex
            });
        }).catch((error) => {
            writeLog('error', 'dialog.show_failed', error);
            console.error('[dialog] Failed to show message box:', error);
        });
    });

    ipcMain.on('pop', () => {
        writeLog('info', 'user.tray_menu.open_requested');
        const trayMenu = getTrayMenu();
        if (trayMenu && trayMenu.tray && trayMenu.form) {
            trayMenu.tray.popUpContextMenu(trayMenu.form);
        }
    });

    ipcMain.on('getTimeOffset', (_event, arg) => {
        writeLog('info', 'user.time_offset_dialog.opened', { currentOffset: arg });
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
                writeLog('info', 'user.time_offset_change_cancelled');
                console.log('[getTimeOffset] User cancelled');
                return;
            }

            const value = Number(result);
            if (!Number.isSafeInteger(value)) {
                console.warn('[getTimeOffset] Rejected invalid prompt result');
                return;
            }

            const normalizedOffset = value % 10000000000000;
            writeLog('info', 'user.time_offset_changed', { offsetSeconds: normalizedOffset });
            const win = getWindow();
            if (win && !win.isDestroyed()) {
                win.webContents.send('setTimeOffset', normalizedOffset);
            }
        }).catch((error) => {
            writeLog('error', 'time_offset.prompt_failed', error);
            console.error('[getTimeOffset] Prompt failed:', error);
        });
    });
}

module.exports = { registerIpcHandlers, normalizeDialogRequest };
