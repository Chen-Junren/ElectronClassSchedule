const test = require('node:test');
const assert = require('node:assert/strict');
const {
    DEFAULT_APPEARANCE_SETTINGS,
    normalizeAppearanceSettings,
    loadAppearanceSettings,
    saveAppearanceSettings
} = require('../electron/appearanceSettingsStore');

function createStore(initial = null) {
    let value = initial;
    return {
        get(_key, fallback) { return value == null ? fallback : value; },
        set(_key, next) { value = next; }
    };
}

test('appearance settings provide a light settings background and preserve floating-bar defaults', () => {
    const store = createStore();
    assert.deepEqual(loadAppearanceSettings(store), DEFAULT_APPEARANCE_SETTINGS);
    assert.equal(DEFAULT_APPEARANCE_SETTINGS.settingsBackground, '#f4f6fa');
    assert.equal(DEFAULT_APPEARANCE_SETTINGS.barBackground, '#000000');
});

test('appearance settings normalize valid colors and persist them', () => {
    const store = createStore();
    const input = { ...DEFAULT_APPEARANCE_SETTINGS, settingsBackground: '#FFFFFF', leftSidebarText: '#12AbEf' };
    const saved = saveAppearanceSettings(store, input);
    assert.equal(saved.settingsBackground, '#ffffff');
    assert.equal(saved.leftSidebarText, '#12abef');
    assert.deepEqual(loadAppearanceSettings(store), saved);
});

test('appearance settings reject malformed colors and safely fall back when storage is invalid', () => {
    assert.throws(() => normalizeAppearanceSettings({ ...DEFAULT_APPEARANCE_SETTINGS, barBackground: 'red' }), /color/i);
    assert.throws(() => normalizeAppearanceSettings({ ...DEFAULT_APPEARANCE_SETTINGS, classText: '#fff' }), /color/i);
    assert.deepEqual(loadAppearanceSettings(createStore({ settingsBackground: 'invalid' })), DEFAULT_APPEARANCE_SETTINGS);
});
