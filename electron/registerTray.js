function createTrayManager({ app, dialog, getWindow, store, getBasePath, setAutoLaunch, Menu: menuApi, Tray: trayApi, shell: shellApi }) {
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
            const win = getWindow();
            if (!win || win.isDestroyed()) return;

            if (!tray) {
                tray = new trayApi(getBasePath() + 'image/icon.png');
                tray.setToolTip('电子课表 - by lsl');
                const showMenu = () => {
                    if (form) tray.popUpContextMenu(form);
                };
                tray.on('click', showMenu);
                tray.on('right-click', showMenu);
            }

            const sendToWindow = (channel, ...args) => {
                const currentWindow = getWindow();
                if (currentWindow && !currentWindow.isDestroyed()) {
                    currentWindow.webContents.send(channel, ...args);
                }
            };

            const template = [
                { label: '第一周', type: 'radio', click: () => sendToWindow('setWeekIndex', 0) },
                { label: '第二周', type: 'radio', click: () => sendToWindow('setWeekIndex', 1) },
                { label: '第三周', type: 'radio', click: () => sendToWindow('setWeekIndex', 2) },
                { label: '第四周', type: 'radio', click: () => sendToWindow('setWeekIndex', 3) },
                { type: 'separator' },
                {
                    icon: getBasePath() + 'image/setting.png',
                    label: '配置课表',
                    click: () => sendToWindow('openSettingDialog')
                },
                {
                    icon: getBasePath() + 'image/clock.png',
                    label: '矫正计时',
                    click: () => sendToWindow('getTimeOffset')
                },
                {
                    icon: getBasePath() + 'image/toggle.png',
                    label: '切换日程',
                    click: () => sendToWindow('setDayOffset')
                },
                {
                    icon: getBasePath() + 'image/github.png',
                    label: '源码仓库',
                    click: () => shellApi.openExternal('https://github.com/EnderWolf006/ElectronClassSchedule')
                },
                { type: 'separator' },
                {
                    id: 'countdown',
                    label: '课上计时',
                    type: 'checkbox',
                    checked: store.get('isDuringClassCountdown', true),
                    click: (event) => {
                        store.set('isDuringClassCountdown', event.checked);
                        sendToWindow('ClassCountdown', event.checked);
                    }
                },
                {
                    label: '窗口置顶',
                    type: 'checkbox',
                    checked: store.get('isWindowAlwaysOnTop', true),
                    click: (event) => {
                        store.set('isWindowAlwaysOnTop', event.checked);
                        const currentWindow = getWindow();
                        if (!currentWindow || currentWindow.isDestroyed()) return;
                        if (store.get('isWindowAlwaysOnTop', true)) {
                            currentWindow.setAlwaysOnTop(true, 'screen-saver', 9999999999999);
                        } else {
                            currentWindow.setAlwaysOnTop(false);
                        }
                    }
                },
                {
                    label: '上课隐藏',
                    type: 'checkbox',
                    checked: store.get('isDuringClassHidden', true),
                    click: (event) => {
                        store.set('isDuringClassHidden', event.checked);
                        sendToWindow('ClassHidden', event.checked);
                    }
                },
                {
                    label: '开机启动',
                    type: 'checkbox',
                    checked: store.get('isAutoLaunch', true),
                    click: (event) => {
                        store.set('isAutoLaunch', event.checked);
                        setAutoLaunch();
                    }
                },
                { type: 'separator' },
                {
                    icon: getBasePath() + 'image/quit.png',
                    label: '退出程序',
                    click: () => {
                        const currentWindow = getWindow();
                        if (!currentWindow || currentWindow.isDestroyed()) return;
                        dialog.showMessageBox(currentWindow, {
                            title: '请确认',
                            message: '你确定要退出程序吗?',
                            buttons: ['取消', '确定']
                        }).then((result) => {
                            if (result.response === 1) app.quit();
                        }).catch((error) => {
                            console.error('[tray] Failed to show quit confirmation:', error);
                        });
                    }
                }
            ];

            const selectedWeek = Number(arg);
            if (Number.isInteger(selectedWeek) && selectedWeek >= 0 && selectedWeek <= 3) {
                template[selectedWeek].checked = true;
            }

            form = menuApi.buildFromTemplate(template);
            tray.setContextMenu(form);

            sendToWindow('ClassCountdown', store.get('isDuringClassCountdown', true));
            sendToWindow('ClassHidden', store.get('isDuringClassHidden', true));
        });
    }

    return { getTrayMenu, registerWeekMenuHandler };
}

module.exports = { createTrayManager };
