'use strict';

const STORE_KEY = 'appearanceSettings';
const DEFAULT_APPEARANCE_SETTINGS = Object.freeze({
    settingsBackground: '#f4f6fa',
    barBackground: '#000000',
    classText: '#ffffff',
    highlightText: '#00ff0a',
    countdownClassText: '#00ff0a',
    countdownText: '#ffffff',
    leftSidebarText: '#00eeff',
    rightSidebarText: '#ff3a3a',
    weatherText: '#ffffff',
    weatherMutedText: '#dce6f5'
});
const COLOR_KEYS = Object.keys(DEFAULT_APPEARANCE_SETTINGS);
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function normalizeAppearanceSettings(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('Appearance settings must be an object');
    }

    const normalized = {};
    for (const key of COLOR_KEYS) {
        const candidate = value[key] == null ? DEFAULT_APPEARANCE_SETTINGS[key] : value[key];
        if (typeof candidate !== 'string' || !HEX_COLOR_PATTERN.test(candidate)) {
            throw new TypeError('Invalid appearance color: ' + key);
        }
        normalized[key] = candidate.toLowerCase();
    }
    return normalized;
}

function loadAppearanceSettings(store) {
    const saved = store.get(STORE_KEY, null);
    if (saved == null) return { ...DEFAULT_APPEARANCE_SETTINGS };
    try {
        return normalizeAppearanceSettings(saved);
    } catch (_error) {
        return { ...DEFAULT_APPEARANCE_SETTINGS };
    }
}

function saveAppearanceSettings(store, value) {
    const normalized = normalizeAppearanceSettings(value);
    store.set(STORE_KEY, normalized);
    return normalized;
}

module.exports = {
    STORE_KEY,
    DEFAULT_APPEARANCE_SETTINGS,
    normalizeAppearanceSettings,
    loadAppearanceSettings,
    saveAppearanceSettings
};
