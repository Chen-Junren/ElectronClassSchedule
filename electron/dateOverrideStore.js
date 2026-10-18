'use strict';

const MAX_OVERRIDES = 366;

function isValidDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeDateOverrides(value) {
    if (!Array.isArray(value)) throw new TypeError('Date overrides must be an array');
    if (value.length > MAX_OVERRIDES) throw new RangeError('At most ' + MAX_OVERRIDES + ' date overrides are allowed');
    const seen = new Set();
    const normalized = value.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('Invalid date override');
        if (!isValidDateKey(item.date)) throw new TypeError('Invalid override date');
        if (seen.has(item.date)) throw new TypeError('Duplicate override date: ' + item.date);
        seen.add(item.date);
        if (item.type !== 'holiday' && item.type !== 'classDay') throw new TypeError('Invalid date override type');
        let dayOfWeek = null;
        if (item.type === 'classDay') {
            if (!Number.isInteger(item.dayOfWeek) || item.dayOfWeek < 0 || item.dayOfWeek > 6) {
                throw new RangeError('classDay overrides require a weekday from 0 to 6');
            }
            dayOfWeek = item.dayOfWeek;
        }
        const note = item.note == null ? '' : item.note;
        if (typeof note !== 'string' || note.length > 100) throw new TypeError('Override note must be a string up to 100 characters');
        return { date: item.date, type: item.type, dayOfWeek, note };
    });
    normalized.sort((a, b) => a.date.localeCompare(b.date));
    return normalized;
}

function loadDateOverrides(store) {
    try {
        return normalizeDateOverrides(store.get('dateOverrides', []));
    } catch (_error) {
        return [];
    }
}

function saveDateOverrides(store, value) {
    const normalized = normalizeDateOverrides(value);
    store.set('dateOverrides', normalized);
    return normalized;
}

module.exports = { MAX_OVERRIDES, isValidDateKey, normalizeDateOverrides, loadDateOverrides, saveDateOverrides };
