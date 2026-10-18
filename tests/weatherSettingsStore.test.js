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
    qweatherLocationId: null,
    latitude: null,
    longitude: null
};

test('weather settings normalize V1 defaults and persist coordinates', () => {
    const store = createStore();
    assert.deepEqual(loadWeatherSettings(store), {
        enabled: false, apiHost: '', apiKey: '', region: null
    });
    const saved = saveWeatherSettings(store, {
        enabled: true, apiHost: 'example.qweatherapi.com', apiKey: 'local-test-key',
        region: { ...validRegion, latitude: 22.53, longitude: 113.93 }
    });
    assert.equal(saved.region.adminCode, '440305');
    assert.equal(saved.region.latitude, 22.53);
    assert.equal(loadWeatherSettings(store).apiKey, 'local-test-key');
});

test('legacy shared QWeather hosts are cleared so users configure their dedicated host', () => {
    const normalized = normalizeWeatherSettings({
        enabled: true, apiHost: 'api.qweather.com', apiKey: 'local-test-key', region: validRegion
    });
    assert.equal(normalized.apiHost, '');
    assert.equal(normalized.enabled, true);
});

test('weather settings reject enabled state without region or key', () => {
    assert.throws(() => normalizeWeatherSettings({ enabled: true, apiHost: '', apiKey: '', region: null }), TypeError);
});

test('weather settings reject malformed host, region code, QWeather ID, and coordinates', () => {
    assert.throws(() => normalizeWeatherSettings({ enabled: false, apiHost: 'https://example.qweatherapi.com/path', apiKey: '', region: null }), TypeError);
    assert.throws(() => normalizeWeatherSettings({ enabled: false, apiHost: '', apiKey: '', region: { ...validRegion, adminCode: 'abc' } }), TypeError);
    assert.throws(() => normalizeWeatherSettings({ enabled: false, apiHost: '', apiKey: '', region: { ...validRegion, qweatherLocationId: 'bad id' } }), TypeError);
    assert.throws(() => normalizeWeatherSettings({ enabled: false, apiHost: '', apiKey: '', region: { ...validRegion, latitude: 200, longitude: 113 } }), TypeError);
    assert.throws(() => normalizeWeatherSettings({ enabled: false, apiHost: '', apiKey: '', region: { ...validRegion, latitude: 22, longitude: null } }), TypeError);
});

test('invalid stored settings safely fall back to V1 defaults', () => {
    const store = createStore({ enabled: true, apiHost: 'https://invalid', apiKey: 'x', region: null });
    assert.deepEqual(loadWeatherSettings(store), {
        enabled: false, apiHost: '', apiKey: '', region: null
    });
});
