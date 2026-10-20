const test = require('node:test');
const assert = require('node:assert/strict');
const { createExamStateBroadcaster, examStateSignature } = require('../electron/examStateBroadcaster');

function snapshot(overrides = {}) {
    return {
        settings: { title: '', durationMinutes: 120, showPageCount: false, totalPages: null },
        activeSession: null,
        history: [],
        serverNowMs: 1000,
        ...overrides
    };
}

function fakeWindow(destroyed = false) {
    const messages = [];
    return {
        messages,
        isDestroyed: () => destroyed,
        webContents: { send: (channel, payload) => messages.push({ channel, payload }) }
    };
}

test('broadcast sends the same exam snapshot to both windows', () => {
    const floatingWindow = fakeWindow();
    const settingsWindow = fakeWindow();
    const current = snapshot({ activeSession: {
        id: 'exam-1', title: '数学周测', status: 'running',
        result: null, remainingSeconds: 3600, elapsedSeconds: 0,
        showPageCount: true, totalPages: 8
    } });
    const broadcaster = createExamStateBroadcaster({
        getSnapshot: () => current,
        getWindows: () => [floatingWindow, settingsWindow]
    });

    assert.equal(broadcaster.broadcast(), current);
    assert.equal(floatingWindow.messages.length, 1);
    assert.equal(settingsWindow.messages.length, 1);
    assert.equal(floatingWindow.messages[0].channel, 'examStateChanged');
    assert.equal(floatingWindow.messages[0].payload, settingsWindow.messages[0].payload);
    assert.equal(floatingWindow.messages[0].payload.activeSession.title, '数学周测');
});

test('broadcast suppresses unchanged snapshots while ignoring the moving server clock', () => {
    const window = fakeWindow();
    let now = 1000;
    const broadcaster = createExamStateBroadcaster({
        getSnapshot: () => snapshot({ serverNowMs: now }),
        getWindows: () => [window]
    });

    broadcaster.broadcast();
    now = 1250;
    broadcaster.broadcast();
    assert.equal(window.messages.length, 1);
});

test('broadcast sends changes and force sends even when the signature is unchanged', () => {
    const window = fakeWindow();
    let current = snapshot();
    const broadcaster = createExamStateBroadcaster({
        getSnapshot: () => current,
        getWindows: () => [window]
    });

    broadcaster.broadcast();
    current = snapshot({ settings: { title: '期中考试', durationMinutes: 90, showPageCount: false, totalPages: null } });
    broadcaster.broadcast();
    broadcaster.broadcast(true);
    assert.equal(window.messages.length, 3);
    assert.equal(window.messages[1].payload.settings.title, '期中考试');
});

test('broadcast skips destroyed windows and windows without usable web contents', () => {
    const destroyed = fakeWindow(true);
    const healthy = fakeWindow();
    const broadcaster = createExamStateBroadcaster({
        getSnapshot: () => snapshot(),
        getWindows: () => [destroyed, null, {}, healthy]
    });

    broadcaster.broadcast();
    assert.equal(destroyed.messages.length, 0);
    assert.equal(healthy.messages.length, 1);
});

test('a supplied snapshot avoids an extra state read', () => {
    let reads = 0;
    const current = snapshot();
    const window = fakeWindow();
    const broadcaster = createExamStateBroadcaster({
        getSnapshot: () => { reads += 1; return current; },
        getWindows: () => [window]
    });

    assert.equal(broadcaster.broadcast(true, current), current);
    assert.equal(reads, 0);
});

test('exam state signature ignores server clock but includes timer and history changes', () => {
    const first = snapshot();
    const second = snapshot({ serverNowMs: 5000 });
    assert.equal(examStateSignature(first), examStateSignature(second));

    second.activeSession = {
        id: 'exam-2', title: '英语', status: 'running',
        result: null, remainingSeconds: 7200, elapsedSeconds: 0,
        showPageCount: false, totalPages: null
    };
    assert.notEqual(examStateSignature(first), examStateSignature(second));
});
