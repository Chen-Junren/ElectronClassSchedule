/*
 * Persistence for user-edited timetable entries.
 * Keep storage access injectable so the module can be tested without Electron.
 */
(function (root, factory) {
    const store = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = store;
    }

    if (root) {
        root.ScheduleConfigStore = store;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const STORAGE_KEY = 'electronClassSchedule.classOverrides.v1';

    function cloneConfig(config) {
        return JSON.parse(JSON.stringify(config));
    }

    function readOverrides(storage) {
        try {
            const raw = storage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function loadConfig(defaultConfig, storage) {
        const config = cloneConfig(defaultConfig);
        const overrides = readOverrides(storage);

        Object.keys(overrides).forEach(dayKey => {
            const dayIndex = Number(dayKey);
            if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= config.daily_class.length) return;

            const dayOverrides = overrides[dayKey];
            if (!dayOverrides || typeof dayOverrides !== 'object' || Array.isArray(dayOverrides)) return;

            Object.keys(dayOverrides).forEach(classKey => {
                const classIndex = Number(classKey);
                const subject = dayOverrides[classKey];
                const classList = config.daily_class[dayIndex].classList;
                if (!Number.isInteger(classIndex) || classIndex < 0 || classIndex >= classList.length) return;
                if (typeof subject !== 'string' || !Object.prototype.hasOwnProperty.call(config.subject_name, subject)) return;
                classList[classIndex] = subject;
            });
        });

        return config;
    }

    function saveClassOverride(storage, dayIndex, classIndex, subject, config) {
        if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= config.daily_class.length) {
            throw new RangeError('Invalid day index: ' + dayIndex);
        }
        const classList = config.daily_class[dayIndex].classList;
        if (!Number.isInteger(classIndex) || classIndex < 0 || classIndex >= classList.length) {
            throw new RangeError('Invalid class index: ' + classIndex);
        }
        if (typeof subject !== 'string' || !Object.prototype.hasOwnProperty.call(config.subject_name, subject)) {
            throw new TypeError('Unknown subject: ' + subject);
        }

        const overrides = readOverrides(storage);
        if (!overrides[dayIndex] || typeof overrides[dayIndex] !== 'object' || Array.isArray(overrides[dayIndex])) {
            overrides[dayIndex] = {};
        }
        overrides[dayIndex][classIndex] = subject;
        storage.setItem(STORAGE_KEY, JSON.stringify(overrides));
        return overrides;
    }

    return { STORAGE_KEY, loadConfig, saveClassOverride };
}));
