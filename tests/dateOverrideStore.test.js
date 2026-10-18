const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDateOverrides, loadDateOverrides, saveDateOverrides } = require('../electron/dateOverrideStore');

function createStore(initial = []) {
    let value = initial;
    return {
        get(key, fallback) { return key === 'dateOverrides' ? value : fallback; },
        set(key, next) { if (key === 'dateOverrides') value = next; },
        value() { return value; }
    };
}

test('normalizes and sorts holiday and make-up day overrides', () => {
    const result = normalizeDateOverrides([
        { date: '2026-10-24', type: 'classDay', dayOfWeek: 1, note: '周六补周一' },
        { date: '2026-10-01', type: 'holiday', note: '国庆节' }
    ]);
    assert.deepEqual(result.map(item => item.date), ['2026-10-01', '2026-10-24']);
    assert.deepEqual(result[1], { date: '2026-10-24', type: 'classDay', dayOfWeek: 1, note: '周六补周一' });
});

test('rejects invalid dates, duplicate dates, invalid weekdays and oversized notes', () => {
    assert.throws(() => normalizeDateOverrides([{ date: '2026-02-30', type: 'holiday' }]), /date/i);
    assert.throws(() => normalizeDateOverrides([
        { date: '2026-10-01', type: 'holiday' }, { date: '2026-10-01', type: 'holiday' }
    ]), /duplicate/i);
    assert.throws(() => normalizeDateOverrides([{ date: '2026-10-24', type: 'classDay', dayOfWeek: 8 }]), /weekday/i);
    assert.throws(() => normalizeDateOverrides([{ date: '2026-10-01', type: 'holiday', note: 'x'.repeat(101) }]), /note/i);
});

test('persists normalized overrides and safely loads malformed stored values', () => {
    const store = createStore();
    const saved = saveDateOverrides(store, [{ date: '2026-10-01', type: 'holiday' }]);
    assert.deepEqual(loadDateOverrides(store), saved);
    store.set('dateOverrides', 'broken');
    assert.deepEqual(loadDateOverrides(store), []);
});
