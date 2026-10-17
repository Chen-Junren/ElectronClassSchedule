(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.AppStateStore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEFAULTS = Object.freeze({
        weekIndex: 0,
        timeOffset: 0,
        dayOffset: -1,
        setDayOffsetLastDay: -1
    });

    const KEYS = Object.freeze({
        weekIndex: 'weekIndex',
        timeOffset: 'timeOffset',
        dayOffset: 'dayOffset',
        setDayOffsetLastDay: 'setDayOffsetLastDay'
    });

    function readInteger(storage, key, fallback) {
        try {
            const raw = storage.getItem(key);
            if (raw === null || raw === '') return fallback;
            const value = Number(raw);
            return Number.isSafeInteger(value) ? value : fallback;
        } catch (_error) {
            return fallback;
        }
    }

    function writeInteger(storage, key, value) {
        if (!Number.isSafeInteger(value)) {
            throw new TypeError('Expected a safe integer for ' + key);
        }
        storage.setItem(key, String(value));
        return value;
    }

    function loadState(storage) {
        return {
            weekIndex: readInteger(storage, KEYS.weekIndex, DEFAULTS.weekIndex),
            timeOffset: readInteger(storage, KEYS.timeOffset, DEFAULTS.timeOffset),
            dayOffset: readInteger(storage, KEYS.dayOffset, DEFAULTS.dayOffset),
            setDayOffsetLastDay: readInteger(storage, KEYS.setDayOffsetLastDay, DEFAULTS.setDayOffsetLastDay)
        };
    }

    function setWeekIndex(storage, value) {
        if (!Number.isInteger(value) || value < 0 || value > 3) {
            throw new RangeError('Week index must be an integer from 0 to 3');
        }
        return writeInteger(storage, KEYS.weekIndex, value);
    }

    function setTimeOffset(storage, value) {
        if (!Number.isSafeInteger(value)) {
            throw new TypeError('Time offset must be a safe integer');
        }
        return writeInteger(storage, KEYS.timeOffset, value);
    }

    function setDayOffset(storage, dayIndex, currentDay) {
        if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
            throw new RangeError('Day offset must be an integer from 0 to 6');
        }
        if (!Number.isInteger(currentDay) || currentDay < 0 || currentDay > 6) {
            throw new RangeError('Current day must be an integer from 0 to 6');
        }
        writeInteger(storage, KEYS.dayOffset, dayIndex);
        writeInteger(storage, KEYS.setDayOffsetLastDay, currentDay);
        return { dayOffset: dayIndex, setDayOffsetLastDay: currentDay };
    }

    function resetDayOffset(storage) {
        writeInteger(storage, KEYS.dayOffset, DEFAULTS.dayOffset);
        writeInteger(storage, KEYS.setDayOffsetLastDay, DEFAULTS.setDayOffsetLastDay);
        return { dayOffset: DEFAULTS.dayOffset, setDayOffsetLastDay: DEFAULTS.setDayOffsetLastDay };
    }

    function getEffectiveDay(storage, date, actualToday = new Date().getDay()) {
        const state = loadState(storage);
        if (state.dayOffset === DEFAULTS.dayOffset) return date.getDay();
        if (state.setDayOffsetLastDay === actualToday) return state.dayOffset;
        resetDayOffset(storage);
        return date.getDay();
    }

    return {
        DEFAULTS,
        KEYS,
        loadState,
        setWeekIndex,
        setTimeOffset,
        setDayOffset,
        resetDayOffset,
        getEffectiveDay
    };
}));
