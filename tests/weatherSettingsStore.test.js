const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWeatherSettings, loadWeatherSettings, saveWeatherSettings } = require('../electron/weatherSettingsStore');

function createStore(initial = null) {
    const values = new Map();
    if (initial !== null) values.set('weatherSettings', initial);
    return {
        get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
        set(key, value) { values.set(key, value); }
    };
}

const validRegion = {
    adminCode: '440305',
    label: '440305-广东省,深圳市,南山区',
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    qweatherLocationId: null
};

test('weather settings normalize defaults and persist through the store', () => {
    const store = createStore();
    assert.deepEqual(loadWeatherSettings(store), {
        enabled: false, apiHost: 'api.qweather.com', apiKey: '', region: null
    });
    const saved = saveWeatherSettings(store, {
        enabled: true, apiHost: 'api.qweather.com', apiKey: 'local-test-key', region: validRegion
    });
    assert.equal(saved.region.adminCode, '440305');
    assert.equal(loadWeatherSettings(store).apiKey, 'local-test-key');
});

test('weather settings reject enabled state without region or key', () => {
    assert.throws(() => normalizeWeatherSettings({ enabled: true, apiHost: 'api.qweather.com', apiKey: '', region: null }), TypeError);
});

test('weather settings reject malformed host, region code, and QWeather ID', () => {
    assert.throws(() => normalizeWeatherSettings({ enabled: false, apiHost: 'https://api.qweather.com/path', apiKey: '', region: null }), TypeError);
    assert.throws(() => normalizeWeatherSettings({ enabled: false, apiHost: 'api.qweather.com', apiKey: '', region: { ...validRegion, adminCode: 'abc' } }), TypeError);
    assert.throws(() => normalizeWeatherSettings({ enabled: false, apiHost: 'api.qweather.com', apiKey: '', region: { ...validRegion, qweatherLocationId: 'bad id' } }), TypeError);
});

test('invalid stored weather settings safely fall back to defaults', () => {
    const store = createStore({ enabled: true, apiHost: 'https://invalid', apiKey: 'x', region: null });
    assert.deepEqual(loadWeatherSettings(store), {
        enabled: false, apiHost: 'api.qweather.com', apiKey: '', region: null
    });
});
