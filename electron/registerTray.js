function createTrayManager({ app, dialog, getWindow, store, getBasePath, setAutoLaunch, openSettingsWindow, logger, Menu: menuApi, Tray: trayApi, shell: shellApi }) {
    const writeLog = (level, event, details) => {
        if (logger && typeof logger[level] === 'function') logger[level](event, details);
    };
    if (!menuApi || !trayApi || !shellApi) {
        const electron = require('electron');
        menuApi = menuApi || electron.Menu;
        trayApi = trayApi || electron.Tray;
        shellApi = shellApi || electron.shell;
    }

    let tray;
    let form;

    function getTrayMenu() {
        return { tray, form };
    }

    function registerWeekMenuHandler(ipcMain) {
        ipcMain.on('getWeekIndex', (_event, arg) => {
            const initialWindow = getWindow();
            if (!initialWindow || initialWindow.isDestroyed()) return;

            if (!tray) {
                tray = new trayApi(getBasePath() + 'image/icon.png');
                tray.setToolTip('电子课表');
                const showMenu = (source) => {
                    writeLog('info', 'user.tray_menu.opened', { source });
                    if (form) tray.popUpContextMenu(form);
                };
                tray.on('click', () => showMenu('left-click'));
                tray.on('right-click', () => showMenu('right-click'));
            }

            const sendToWindow = (channel, ...args) => {
                const currentWindow = getWindow();
                if (currentWindow && !currentWindow.isDestroyed()) {
                    currentWindow.webContents.send(channel, ...args);
                }
            };

            const selectWeek = (weekIndex) => {
                writeLog('info', 'user.schedule_week_selected', { weekIndex });
                sendToWindow('setWeekIndex', weekIndex);
            };
            const menuItems = [
                { label: '第一周', type: 'radio', click: () => selectWeek(0) },
                { label: '第二周', type: 'radio', click: () => selectWeek(1) },
                { label: '第三周', type: 'radio', click: () => selectWeek(2) },
                { label: '第四周', type: 'radio', click: () => selectWeek(3) },
                { type: 'separator' },
                {
                    icon: getBasePath() + 'image/setting.png',
                    label: '课表与外观设置',
                    click: () => {
                        writeLog('info', 'user.settings_menu_selected', { source: 'tray' });
                        if (typeof openSettingsWindow === 'function') openSettingsWindow();
                        else sendToWindow('openSettingDialog');
                    }
                },
                {
                    icon: getBasePath() + 'image/clock.png',
                    label: '矫正计时',
                    click: () => {
                        writeLog('info', 'user.time_offset_menu_selected');
                        sendToWindow('getTimeOffset');
                    }
                },
                { type: 'separator' },
                {
                    label: '课上计时',
                    type: 'checkbox',
                    checked: store.get('isDuringClassCountdown', true),
                    click: (event) => {
                        writeLog('info', 'user.countdown_display_toggled', { enabled: event.checked });
                        store.set('isDuringClassCountdown', event.checked);
                        sendToWindow('ClassCountdown', event.checked);
                    }
                },
                {
                    label: '上课隐藏',
                    type: 'checkbox',
                    checked: store.get('isDuringClassHidden', true),
                    click: (event) => {
                        writeLog('info', 'user.class_window_hidden_toggled', { enabled: event.checked });
                        store.set('isDuringClassHidden', event.checked);
                        sendToWindow('ClassHidden', event.checked);
                    }
                },
                {
                    label: '窗口置顶',
                    type: 'checkbox',
                    checked: store.get('isWindowAlwaysOnTop', true),
                    click: (event) => {
                        writeLog('info', 'user.window_always_on_top_toggled', { enabled: event.checked });
                        store.set('isWindowAlwaysOnTop', event.checked);
                        const currentWindow = getWindow();
                        if (!currentWindow || currentWindow.isDestroyed()) return;
                        if (event.checked) {
                            currentWindow.setAlwaysOnTop(true, 'screen-saver', 9999999999999);
                        } else {
                            currentWindow.setAlwaysOnTop(false);
                        }
                    }
                },
                {
                    label: '开机启动',
                    type: 'checkbox',
                    checked: store.get('isAutoLaunch', false),
                    click: (event) => {
                        writeLog('info', 'user.auto_launch_toggled', { enabled: event.checked });
                        store.set('isAutoLaunch', event.checked);
                        setAutoLaunch();
                    }
                },
                { type: 'separator' },
                {
                    icon: getBasePath() + 'image/quit.png',
                    label: '退出电子课表',
                    click: () => {
                        writeLog('info', 'user.quit_menu_selected');
                        const currentWindow = getWindow();
                        if (!currentWindow || currentWindow.isDestroyed()) return;
                        dialog.showMessageBox(currentWindow, {
                            title: '退出电子课表',
                            message: '确定要退出电子课表吗？',
                            buttons: ['取消', '退出'],
                            defaultId: 0,
                            cancelId: 0
                        }).then((result) => {
                            writeLog('info', result.response === 1 ? 'user.quit_confirmed' : 'user.quit_cancelled', {
                                response: result.response
                            });
                            if (result.response === 1) app.quit();
                        }).catch((error) => {
                            writeLog('error', 'tray.quit_confirmation_failed', error);
                            console.error('[tray] Failed to show quit confirmation:', error);
                        });
                    }
                }
            ];

            const selectedWeek = Number(arg);
            if (Number.isInteger(selectedWeek) && selectedWeek >= 0 && selectedWeek <= 3) {
                menuItems[selectedWeek].checked = true;
            }

            // Keep every actionable item on one level to avoid redundant nested menus.
            form = menuApi.buildFromTemplate(menuItems);
            tray.setContextMenu(form);

            sendToWindow('ClassCountdown', store.get('isDuringClassCountdown', true));
            sendToWindow('ClassHidden', store.get('isDuringClassHidden', true));
        });
    }

    return { getTrayMenu, registerWeekMenuHandler };
}

module.exports = { createTrayManager };
