const path = require('path');
const fs = require('fs');
const os = require('os');
const createShortcut = require('windows-shortcuts');

const startupFolderPath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup'
);

function createAutoLaunchManager({ app, store }) {
    function setAutoLaunch() {
        const shortcutPath = path.join(startupFolderPath, '电子课表(请勿重命名).lnk');

        app.setLoginItemSettings({
            openAtLogin: false,
            openAsHidden: false
        });

        if (store.get('isAutoLaunch', true)) {
            createShortcut.create(shortcutPath, {
                target: app.getPath('exe'),
                workingDir: path.dirname(app.getPath('exe'))
            }, (error) => {
                if (error) console.log(error);
            });
        } else {
            fs.unlink(shortcutPath, () => {});
        }
    }

    return { setAutoLaunch };
}

module.exports = { createAutoLaunchManager };
