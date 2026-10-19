const test = require('node:test');
const assert = require('node:assert/strict');
const { createExamManager, normalizeExamSettings } = require('../electron/examManager');

function createStore(initial = null) {
    let value = initial;
    return {
        get(_key, fallback) { return value == null ? fallback : value; },
        set(_key, next) { value = JSON.parse(JSON.stringify(next)); },
        read() { return value == null ? null : JSON.parse(JSON.stringify(value)); }
    };
}

function setup() {
    let clock = Date.parse('2026-10-19T08:00:00.000Z');
    let id = 0;
    const store = createStore();
    const manager = createExamManager({
        store,
        now: () => clock,
        createId: () => 'exam-' + (++id)
    });
    return {
        store,
        manager,
        advance(milliseconds) { clock += milliseconds; },
        setTime(timestamp) { clock = timestamp; }
    };
}

const validSettings = {
    title: '数学周测',
    durationMinutes: 60,
    showPageCount: true,
    totalPages: 8
};

test('exam settings validate duration and optional page count', () => {
    assert.deepEqual(normalizeExamSettings({
        title: '  数学周测 ',
        durationMinutes: 90,
        showPageCount: false,
        totalPages: 10
    }), {
        title: '数学周测',
        durationMinutes: 90,
        showPageCount: false,
        totalPages: null
    });
    assert.throws(() => normalizeExamSettings({ ...validSettings, durationMinutes: 0 }), /时长/);
    assert.throws(() => normalizeExamSettings({ ...validSettings, totalPages: 0 }), /总页数/);
    assert.throws(() => normalizeExamSettings({ ...validSettings, title: 'x'.repeat(101) }), /名称/);
});

test('start creates one session and rejects a second active session', () => {
    const { manager } = setup();
    const snapshot = manager.start(validSettings);
    assert.equal(snapshot.activeSession.title, '数学周测');
    assert.equal(snapshot.activeSession.status, 'running');
    assert.equal(snapshot.activeSession.remainingSeconds, 3600);
    assert.equal(snapshot.activeSession.totalPages, 8);
    assert.throws(() => manager.start(validSettings), /上一场考试/);
});

test('pause freezes elapsed time and resume continues from the paused duration', () => {
    const { manager, advance } = setup();
    manager.start(validSettings);
    advance(125000);
    const paused = manager.pause();
    assert.equal(paused.activeSession.status, 'paused');
    assert.equal(paused.activeSession.elapsedSeconds, 125);
    advance(600000);
    assert.equal(manager.getSnapshot().activeSession.elapsedSeconds, 125);
    const resumed = manager.resume();
    assert.equal(resumed.activeSession.status, 'running');
    advance(5000);
    assert.equal(manager.getSnapshot().activeSession.elapsedSeconds, 130);
});

test('zero ends the timer once, keeps the finished panel active until explicit exit', () => {
    const { manager, advance } = setup();
    manager.start(validSettings);
    advance(60 * 60 * 1000);
    const finished = manager.getSnapshot();
    assert.equal(finished.activeSession.status, 'finished');
    assert.equal(finished.activeSession.result, 'completed');
    assert.equal(finished.activeSession.remainingSeconds, 0);
    assert.equal(finished.history.length, 1);
    manager.getSnapshot();
    assert.equal(manager.getSnapshot().history.length, 1);
    const exited = manager.exit();
    assert.equal(exited.activeSession, null);
    assert.equal(exited.history.length, 1);
});

test('early end saves one record and keeps the end panel until exit', () => {
    const { manager, advance } = setup();
    manager.start(validSettings);
    advance(12 * 60 * 1000);
    const ended = manager.endEarly();
    assert.equal(ended.activeSession.status, 'finished');
    assert.equal(ended.activeSession.result, 'ended_early');
    assert.equal(ended.history[0].elapsedSeconds, 720);
    assert.equal(manager.getSnapshot().history.length, 1);
});

test('restart recovery counts wall-clock time for running sessions', () => {
    const { manager, advance, store } = setup();
    manager.start({ ...validSettings, durationMinutes: 5 });
    advance(60 * 1000);
    const reloadedManager = createExamManager({
        store,
        now: () => Date.parse('2026-10-19T08:03:00.000Z'),
        createId: () => 'unused'
    });
    assert.equal(reloadedManager.getPersistedActiveSession().status, 'running');
    const restored = reloadedManager.resumeAfterRestart();
    assert.equal(restored.activeSession.elapsedSeconds, 180);
    assert.equal(restored.activeSession.remainingSeconds, 120);
});

test('choosing interruption saves history and clears the active session', () => {
    const { manager, advance } = setup();
    manager.start(validSettings);
    advance(42000);
    const result = manager.interruptForRestart();
    assert.equal(result.activeSession, null);
    assert.equal(result.history.length, 1);
    assert.equal(result.history[0].result, 'interrupted');
    assert.equal(result.history[0].elapsedSeconds, 42);
});

test('a paused session stays paused after restart and excludes downtime', () => {
    const { manager, advance, store } = setup();
    manager.start(validSettings);
    advance(70000);
    manager.pause();
    const reloadedManager = createExamManager({
        store,
        now: () => Date.parse('2026-10-19T08:30:00.000Z'),
        createId: () => 'unused'
    });
    const restored = reloadedManager.resumeAfterRestart();
    assert.equal(restored.activeSession.status, 'paused');
    assert.equal(restored.activeSession.elapsedSeconds, 70);
});

test('invalid or damaged stored data safely falls back to an empty exam state', () => {
    const store = createStore('damaged');
    assert.equal(createExamManager({ store }).getSnapshot().activeSession, null);
});
