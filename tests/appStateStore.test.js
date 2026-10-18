const test = require('node:test');
const assert = require('node:assert/strict');
const AppStateStore = require('../js/appStateStore');

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); }
    };
}

test('loadState supplies defaults for absent or malformed values', () => {
    const storage = createStorage({
        weekIndex: 'not-a-number',
        timeOffset: '12',
        dayOffset: '9',
        setDayOffsetLastDay: '-1'
    });

    assert.deepEqual(AppStateStore.loadState(storage), {
        weekIndex: 0,
        timeOffset: 12,
        dayOffset: -1,
        setDayOffsetLastDay: -1
    });
});

test('week index and time offset are persisted and loaded', () => {
    const storage = createStorage();
    assert.equal(AppStateStore.setWeekIndex(storage, 3), 3);
    assert.equal(AppStateStore.setTimeOffset(storage, -45), -45);
    assert.deepEqual(AppStateStore.loadState(storage), {
        weekIndex: 3,
        timeOffset: -45,
        dayOffset: -1,
        setDayOffsetLastDay: -1
    });
});

test('setWeekIndex rejects values outside the supported four-week cycle', () => {
    const storage = createStorage();
    assert.throws(() => AppStateStore.setWeekIndex(storage, -1), RangeError);
    assert.throws(() => AppStateStore.setWeekIndex(storage, 4), RangeError);
    assert.throws(() => AppStateStore.setWeekIndex(storage, 1.5), RangeError);
});

test('setTimeOffset rejects non-integer values', () => {
    const storage = createStorage();
    assert.throws(() => AppStateStore.setTimeOffset(storage, 1.5), TypeError);
});

test('day override persists the selected day and the day it was selected', () => {
    const storage = createStorage();
    assert.deepEqual(AppStateStore.setDayOffset(storage, 4, 2), {
        dayOffset: 4,
        setDayOffsetLastDay: 2
    });
    assert.equal(AppStateStore.getEffectiveDay(storage, new Date(2026, 0, 4), 2), 4);
});

test('day override resets when the real day changes', () => {
    const storage = createStorage();
    AppStateStore.setDayOffset(storage, 4, 2);

    assert.equal(AppStateStore.getEffectiveDay(storage, new Date(2026, 0, 4), 3), 0);
    assert.deepEqual(AppStateStore.loadState(storage), {
        weekIndex: 0,
        timeOffset: 0,
        dayOffset: -1,
        setDayOffsetLastDay: -1
    });
});

test('resetDayOffset clears the manual day selection', () => {
    const storage = createStorage();
    AppStateStore.setDayOffset(storage, 5, 1);
    assert.deepEqual(AppStateStore.resetDayOffset(storage), {
        dayOffset: -1,
        setDayOffsetLastDay: -1
    });
});

test('loadState tolerates storage access errors', () => {
    const storage = {
        getItem() { throw new Error('storage unavailable'); },
        setItem() { throw new Error('storage unavailable'); }
    };
    assert.deepEqual(AppStateStore.loadState(storage), {
        weekIndex: 0,
        timeOffset: 0,
        dayOffset: -1,
        setDayOffsetLastDay: -1
    });
});


test('date keys use local calendar dates and date overrides match exact dates', () => {
    const date = new Date(2026, 9, 18, 23, 30);
    assert.equal(AppStateStore.getDateKey(date), '2026-10-18');
    const overrides = [
        { date: '2026-10-18', type: 'holiday' },
        { date: '2026-10-19', type: 'classDay', dayOfWeek: 1 }
    ];
    assert.deepEqual(AppStateStore.findDateOverride(date, overrides), overrides[0]);
    assert.equal(AppStateStore.findDateOverride(new Date(2026, 9, 20), overrides), null);
});

test('getDateKey rejects invalid dates', () => {
    assert.throws(() => AppStateStore.getDateKey(new Date('invalid')), TypeError);
});
