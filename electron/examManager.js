'use strict';

const STORE_KEY = 'examState';
const MAX_HISTORY_RECORDS = 200;
const DEFAULT_EXAM_SETTINGS = Object.freeze({
    title: '',
    durationMinutes: 120,
    showPageCount: false,
    totalPages: null
});
const VALID_RESULTS = new Set(['completed', 'ended_early', 'interrupted']);

function normalizeExamSettings(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('考试设置格式不正确');
    }
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    if (title.length > 100) throw new RangeError('考试名称最多 100 个字符');
    const durationMinutes = Number(value.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
        throw new RangeError('考试时长必须为 1 到 1440 分钟');
    }
    const showPageCount = value.showPageCount === true;
    let totalPages = null;
    if (showPageCount) {
        totalPages = Number(value.totalPages);
        if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 1000) {
            throw new RangeError('总页数必须为 1 到 1000 的整数');
        }
    }
    return { title, durationMinutes, showPageCount, totalPages };
}

function normalizeActiveSession(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (typeof value.id !== 'string' || !value.id
        || typeof value.title !== 'string'
        || !Number.isInteger(value.durationSeconds) || value.durationSeconds < 60 || value.durationSeconds > 86400
        || !['running', 'paused', 'finished'].includes(value.status)
        || !Number.isFinite(value.startedAtMs)
        || typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt))
        || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0) return null;
    const showPageCount = value.showPageCount === true;
    const totalPages = showPageCount && Number.isInteger(value.totalPages) && value.totalPages >= 1 && value.totalPages <= 1000
        ? value.totalPages : null;
    if (showPageCount && totalPages === null) return null;
    if (value.status === 'finished' && !VALID_RESULTS.has(value.result)) return null;
    if (value.status !== 'finished' && value.result != null) return null;
    const runningSinceMs = value.status === 'running'
        ? (Number.isFinite(value.runningSinceMs) ? value.runningSinceMs : value.startedAtMs)
        : null;
    return {
        id: value.id,
        title: value.title.slice(0, 100),
        durationSeconds: value.durationSeconds,
        showPageCount,
        totalPages,
        startedAt: value.startedAt,
        startedAtMs: value.startedAtMs,
        status: value.status,
        runningSinceMs,
        elapsedMs: Math.min(value.elapsedMs, value.durationSeconds * 1000),
        pausedAtMs: Number.isFinite(value.pausedAtMs) ? value.pausedAtMs : null,
        finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
        result: value.result == null ? null : value.result,
        recordSaved: value.recordSaved === true
    };
}

function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const rows = [];
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)
            || typeof item.id !== 'string' || !item.id || seen.has(item.id)
            || typeof item.title !== 'string'
            || !Number.isInteger(item.durationSeconds) || item.durationSeconds < 60 || item.durationSeconds > 86400
            || typeof item.startedAt !== 'string' || !Number.isFinite(Date.parse(item.startedAt))
            || typeof item.endedAt !== 'string' || !Number.isFinite(Date.parse(item.endedAt))
            || !Number.isInteger(item.elapsedSeconds) || item.elapsedSeconds < 0
            || !VALID_RESULTS.has(item.result)) continue;
        const showPageCount = item.showPageCount === true;
        const totalPages = showPageCount && Number.isInteger(item.totalPages) && item.totalPages >= 1 && item.totalPages <= 1000
            ? item.totalPages : null;
        seen.add(item.id);
        rows.push({
            id: item.id,
            title: item.title.slice(0, 100),
            durationSeconds: item.durationSeconds,
            startedAt: item.startedAt,
            endedAt: item.endedAt,
            elapsedSeconds: Math.min(item.elapsedSeconds, item.durationSeconds),
            result: item.result,
            showPageCount: showPageCount && totalPages !== null,
            totalPages
        });
        if (rows.length >= MAX_HISTORY_RECORDS) break;
    }
    return rows.sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
}

function createExamManager(options) {
    if (!options || !options.store || typeof options.store.get !== 'function' || typeof options.store.set !== 'function') {
        throw new TypeError('Exam manager requires a persistent store');
    }
    const store = options.store;
    const now = typeof options.now === 'function' ? options.now : () => Date.now();
    const createId = typeof options.createId === 'function'
        ? options.createId
        : () => require('node:crypto').randomUUID();

    function readState() {
        let saved = null;
        try {
            saved = store.get(STORE_KEY, null);
        } catch (_error) {
            saved = null;
        }
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
            return { settings: { ...DEFAULT_EXAM_SETTINGS }, activeSession: null, history: [] };
        }
        let settings;
        try {
            settings = normalizeExamSettings(saved.settings || DEFAULT_EXAM_SETTINGS);
        } catch (_error) {
            settings = { ...DEFAULT_EXAM_SETTINGS };
        }
        return {
            settings,
            activeSession: normalizeActiveSession(saved.activeSession),
            history: normalizeHistory(saved.history)
        };
    }

    function writeState(state) {
        store.set(STORE_KEY, state);
        return state;
    }

    function elapsedAt(session, timestamp) {
        const runningElapsed = session.status === 'running'
            ? Math.max(0, timestamp - session.runningSinceMs)
            : 0;
        return Math.max(0, Math.min(session.durationSeconds * 1000, session.elapsedMs + runningElapsed));
    }

    function appendHistory(state, session, result, timestamp, elapsedMs) {
        const record = {
            id: session.id,
            title: session.title,
            durationSeconds: session.durationSeconds,
            startedAt: session.startedAt,
            endedAt: new Date(timestamp).toISOString(),
            elapsedSeconds: Math.min(session.durationSeconds, Math.max(0, Math.floor(elapsedMs / 1000))),
            result,
            showPageCount: session.showPageCount,
            totalPages: session.totalPages
        };
        const history = [record, ...state.history.filter(item => item.id !== session.id)]
            .slice(0, MAX_HISTORY_RECORDS);
        return { ...state, history };
    }

    function finishState(state, result, timestamp) {
        const session = state.activeSession;
        if (!session || session.status === 'finished') return state;
        const elapsedMs = result === 'completed'
            ? session.durationSeconds * 1000
            : elapsedAt(session, timestamp);
        const next = appendHistory(state, session, result, timestamp, elapsedMs);
        next.activeSession = {
            ...session,
            status: 'finished',
            runningSinceMs: null,
            elapsedMs,
            pausedAtMs: null,
            finishedAt: new Date(timestamp).toISOString(),
            result,
            recordSaved: true
        };
        return writeState(next);
    }

    function publicSnapshot(state, timestamp) {
        const session = state.activeSession;
        let activeSession = null;
        if (session) {
            const elapsedMs = session.status === 'finished'
                ? session.elapsedMs
                : elapsedAt(session, timestamp);
            activeSession = {
                id: session.id,
                title: session.title,
                durationSeconds: session.durationSeconds,
                showPageCount: session.showPageCount,
                totalPages: session.totalPages,
                startedAt: session.startedAt,
                status: session.status,
                result: session.result,
                finishedAt: session.finishedAt,
                elapsedMs,
                elapsedSeconds: Math.floor(elapsedMs / 1000),
                remainingSeconds: Math.max(0, Math.ceil((session.durationSeconds * 1000 - elapsedMs) / 1000))
            };
        }
        return {
            settings: { ...state.settings },
            activeSession,
            history: state.history.map(item => ({ ...item })),
            serverNowMs: timestamp
        };
    }

    function getSnapshot() {
        const timestamp = now();
        let state = readState();
        const session = state.activeSession;
        if (session && session.status === 'running' && elapsedAt(session, timestamp) >= session.durationSeconds * 1000) {
            state = finishState(state, 'completed', timestamp);
        }
        return publicSnapshot(state, timestamp);
    }

    function saveSettings(value) {
        const settings = normalizeExamSettings(value);
        const state = readState();
        writeState({ ...state, settings });
        return getSnapshot();
    }

    function start(value) {
        const state = readState();
        if (state.activeSession) throw new Error('当前仍有一场考试，请先退出上一场考试');
        const settings = normalizeExamSettings(value);
        if (!settings.title) throw new TypeError('请填写考试名称');
        const timestamp = now();
        const session = {
            id: createId(),
            title: settings.title,
            durationSeconds: settings.durationMinutes * 60,
            showPageCount: settings.showPageCount,
            totalPages: settings.totalPages,
            startedAt: new Date(timestamp).toISOString(),
            startedAtMs: timestamp,
            status: 'running',
            runningSinceMs: timestamp,
            elapsedMs: 0,
            pausedAtMs: null,
            finishedAt: null,
            result: null,
            recordSaved: false
        };
        writeState({ settings, activeSession: session, history: state.history });
        return getSnapshot();
    }

    function pause() {
        const state = readState();
        const session = state.activeSession;
        if (!session || session.status !== 'running') throw new Error('当前没有正在计时的考试');
        const timestamp = now();
        const elapsedMs = elapsedAt(session, timestamp);
        if (elapsedMs >= session.durationSeconds * 1000) {
            return publicSnapshot(finishState(state, 'completed', timestamp), timestamp);
        }
        const next = {
            ...state,
            activeSession: {
                ...session,
                status: 'paused',
                runningSinceMs: null,
                elapsedMs,
                pausedAtMs: timestamp
            }
        };
        writeState(next);
        return getSnapshot();
    }

    function resume() {
        const state = readState();
        const session = state.activeSession;
        if (!session || session.status !== 'paused') throw new Error('当前考试不处于暂停状态');
        const timestamp = now();
        writeState({
            ...state,
            activeSession: {
                ...session,
                status: 'running',
                runningSinceMs: timestamp,
                pausedAtMs: null
            }
        });
        return getSnapshot();
    }

    function endEarly() {
        const state = readState();
        const session = state.activeSession;
        if (!session || !['running', 'paused'].includes(session.status)) {
            throw new Error('当前没有可以结束的考试');
        }
        const timestamp = now();
        const result = session.status === 'running' && elapsedAt(session, timestamp) >= session.durationSeconds * 1000
            ? 'completed'
            : 'ended_early';
        return publicSnapshot(finishState(state, result, timestamp), timestamp);
    }

    function exit() {
        const state = readState();
        if (!state.activeSession) return getSnapshot();
        if (state.activeSession.status !== 'finished') {
            throw new Error('请先结束考试，再退出考试面板');
        }
        writeState({ ...state, activeSession: null });
        return getSnapshot();
    }

    function getPersistedActiveSession() {
        const state = readState();
        return state.activeSession ? { ...state.activeSession } : null;
    }

    function resumeAfterRestart() {
        // A paused session remains paused; a running session continues against real wall-clock time.
        return getSnapshot();
    }

    function interruptForRestart() {
        const state = readState();
        const session = state.activeSession;
        if (!session || !['running', 'paused'].includes(session.status)) return getSnapshot();
        const timestamp = now();
        const elapsedMs = elapsedAt(session, timestamp);
        const withHistory = appendHistory(state, session, 'interrupted', timestamp, elapsedMs);
        writeState({ ...withHistory, activeSession: null });
        return getSnapshot();
    }

    return {
        getSnapshot,
        saveSettings,
        start,
        pause,
        resume,
        endEarly,
        exit,
        getPersistedActiveSession,
        resumeAfterRestart,
        interruptForRestart
    };
}

module.exports = {
    STORE_KEY,
    MAX_HISTORY_RECORDS,
    DEFAULT_EXAM_SETTINGS,
    normalizeExamSettings,
    createExamManager
};
