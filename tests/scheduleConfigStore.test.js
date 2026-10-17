const test = require('node:test');
const assert = require('node:assert/strict');
const ScheduleConfigStore = require('../js/scheduleConfigStore');

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); }
    };
}

function createConfig() {
    return {
        subject_name: { '语': '语文', '数': '数学', '英': '英语' },
        daily_class: [
            { classList: ['语', '数'], timetable: 'workday' },
            { classList: ['英'], timetable: 'weekend' }
        ]
    };
}

test('loadConfig returns a clone and applies saved overrides', () => {
    const defaults = createConfig();
    const storage = createStorage();
    ScheduleConfigStore.saveClassOverride(storage, 0, 1, '英', defaults);

    const loaded = ScheduleConfigStore.loadConfig(defaults, storage);
    assert.equal(loaded.daily_class[0].classList[1], '英');
    assert.equal(defaults.daily_class[0].classList[1], '数');
    assert.notEqual(loaded, defaults);
});

test('saving a second override preserves the first override', () => {
    const config = createConfig();
    const storage = createStorage();
    ScheduleConfigStore.saveClassOverride(storage, 0, 0, '数', config);
    ScheduleConfigStore.saveClassOverride(storage, 1, 0, '语', config);

    const loaded = ScheduleConfigStore.loadConfig(config, storage);
    assert.deepEqual(loaded.daily_class.map(day => day.classList), [['数', '数'], ['语']]);
});

test('loadConfig safely ignores malformed storage and invalid entries', () => {
    const config = createConfig();
    const storage = createStorage({
        [ScheduleConfigStore.STORAGE_KEY]: JSON.stringify({
            0: { 0: 'not-a-subject', 1: '英', 99: '语' },
            99: { 0: '语' },
            invalid: { 0: '语' }
        })
    });

    const loaded = ScheduleConfigStore.loadConfig(config, storage);
    assert.deepEqual(loaded.daily_class[0].classList, ['语', '英']);
    assert.deepEqual(loaded.daily_class[1].classList, ['英']);
    assert.deepEqual(config.daily_class[0].classList, ['语', '数']);
});

test('saveClassOverride rejects invalid indices and unknown subjects', () => {
    const config = createConfig();
    const storage = createStorage();
    assert.throws(() => ScheduleConfigStore.saveClassOverride(storage, 9, 0, '语', config), RangeError);
    assert.throws(() => ScheduleConfigStore.saveClassOverride(storage, 0, 9, '语', config), RangeError);
    assert.throws(() => ScheduleConfigStore.saveClassOverride(storage, 0, 0, '未知', config), TypeError);
});
