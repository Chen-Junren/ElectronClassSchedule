const { Menu, Tray, shell } = require('electron');

function createTrayManager({ app, dialog, getWindow, store, getBasePath, setAutoLaunch }) {
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
                tray = new Tray(getBasePath() + 'image/icon.png');
                tray.setToolTip('电子课表 - by lsl');
                const showMenu = () => {
                    if (form) tray.popUpContextMenu(form);
                };
                tray.on('click', showMenu);
                tray.on('right-click', showMenu);
            }

            const template = [
                { label: '第一周', type: 'radio', click: () => win.webContents.send('setWeekIndex', 0) },
                { label: '第二周', type: 'radio', click: () => win.webContents.send('setWeekIndex', 1) },
                { label: '第三周', type: 'radio', click: () => win.webContents.send('setWeekIndex', 2) },
                { label: '第四周', type: 'radio', click: () => win.webContents.send('setWeekIndex', 3) },
                { type: 'separator' },
                {
                    icon: getBasePath() + 'image/setting.png',
                    label: '配置课表',
                    click: () => win.webContents.send('openSettingDialog')
                },
                {
                    icon: getBasePath() + 'image/clock.png',
                    label: '矫正计时',
                    click: () => win.webContents.send('getTimeOffset')
                },
                {
                    icon: getBasePath() + 'image/toggle.png',
                    label: '切换日程',
                    click: () => win.webContents.send('setDayOffset')
                },
                {
                    icon: getBasePath() + 'image/github.png',
                    label: '源码仓库',
                    click: () => shell.openExternal('https://github.com/EnderWolf006/ElectronClassSchedule')
                },
                { type: 'separator' },
                {
                    id: 'countdown',
                    label: '课上计时',
                    type: 'checkbox',
                    checked: store.get('isDuringClassCountdown', true),
                    click: (event) => {
                        store.set('isDuringClassCountdown', event.checked);
                        win.webContents.send('ClassCountdown', event.checked);
                    }
                },
                {
                    label: '窗口置顶',
                    type: 'checkbox',
                    checked: store.get('isWindowAlwaysOnTop', true),
                    click: (event) => {
                        store.set('isWindowAlwaysOnTop', event.checked);
                        if (store.get('isWindowAlwaysOnTop', true)) {
                            win.setAlwaysOnTop(true, 'screen-saver', 9999999999999);
                        } else {
                            win.setAlwaysOnTop(false);
                        }
                    }
                },
                {
                    label: '上课隐藏',
                    type: 'checkbox',
                    checked: store.get('isDuringClassHidden', true),
                    click: (event) => {
                        store.set('isDuringClassHidden', event.checked);
                        win.webContents.send('ClassHidden', event.checked);
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
                        dialog.showMessageBox(win, {
                            title: '请确认',
                            message: '你确定要退出程序吗?',
                            buttons: ['取消', '确定']
                        }).then((result) => {
                            if (result.response) app.quit();
                        });
                    }
                }
            ];

            const selectedWeek = Number(arg);
            if (Number.isInteger(selectedWeek) && template[selectedWeek] && template[selectedWeek].type === 'radio') {
                template[selectedWeek].checked = true;
            }

            form = Menu.buildFromTemplate(template);
            tray.setContextMenu(form);

            win.webContents.send('ClassCountdown', store.get('isDuringClassCountdown', true));
            win.webContents.send('ClassHidden', store.get('isDuringClassHidden', true));
        });
    }

    return { getTrayMenu, registerWeekMenuHandler };
}

module.exports = { createTrayManager };
