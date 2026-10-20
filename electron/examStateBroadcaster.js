'use strict';

function examStateSignature(snapshot) {
    const active = snapshot.activeSession;
    return JSON.stringify({
        settings: snapshot.settings,
        active: active ? {
            id: active.id,
            title: active.title,
            status: active.status,
            result: active.result,
            remainingSeconds: active.remainingSeconds,
            elapsedSeconds: active.elapsedSeconds,
            showPageCount: active.showPageCount,
            totalPages: active.totalPages
        } : null,
        history: snapshot.history.map(item => ({ id: item.id, result: item.result, endedAt: item.endedAt }))
    });
}

function createExamStateBroadcaster(options) {
    if (!options || typeof options.getSnapshot !== 'function' || typeof options.getWindows !== 'function') {
        throw new TypeError('Exam state broadcaster requires getSnapshot and getWindows functions');
    }

    let lastSignature = '';

    function broadcast(force = false, suppliedSnapshot = null) {
        const snapshot = suppliedSnapshot || options.getSnapshot();
        const signature = examStateSignature(snapshot);
        if (!force && signature === lastSignature) return snapshot;

        lastSignature = signature;
        for (const window of options.getWindows()) {
            if (!window || (typeof window.isDestroyed === 'function' && window.isDestroyed())) continue;
            if (!window.webContents || typeof window.webContents.send !== 'function') continue;
            window.webContents.send('examStateChanged', snapshot);
        }
        return snapshot;
    }

    return { broadcast };
}

module.exports = { examStateSignature, createExamStateBroadcaster };
