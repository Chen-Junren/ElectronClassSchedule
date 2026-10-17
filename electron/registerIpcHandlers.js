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
        console.log(arg);
    });

    ipcMain.on('setIgnore', (_event, shouldIgnore) => {
        const win = getWindow();
        if (!win || win.isDestroyed()) return;

        if (shouldIgnore) {
            win.setIgnoreMouseEvents(true, { forward: true });
        } else {
            win.setIgnoreMouseEvents(false);
        }
    });

    ipcMain.on('dialog', (event, arg) => {
        const win = getWindow();
        if (!win || win.isDestroyed()) return;

        dialog.showMessageBox(win, arg.options).then((data) => {
            event.reply(arg.reply, { arg, index: data.response });
        });
    });

    ipcMain.on('pop', () => {
        const trayMenu = getTrayMenu();
        if (trayMenu.tray && trayMenu.form) {
            trayMenu.tray.popUpContextMenu(trayMenu.form);
        }
    });

    ipcMain.on('getTimeOffset', (_event, arg) => {
        prompt({
            title: '计时矫正',
            label: '请设置课表计时与系统时间的偏移秒数:',
            value: String(arg),
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

            const win = getWindow();
            if (win && !win.isDestroyed()) {
                win.webContents.send('setTimeOffset', Number(result) % 10000000000000);
            }
        });
    });
}

module.exports = { registerIpcHandlers };
