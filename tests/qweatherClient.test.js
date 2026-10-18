const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLogger } = require('../electron/logger');
const { getWeatherSnapshot, chooseLocation, makeUrl } = require('../electron/qweatherClient');

const region = {
    adminCode: '440305',
    label: '440305-广东省,深圳市,南山区',
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    qweatherLocationId: null,
    latitude: null,
    longitude: null
};
const settings = {
    enabled: true,
    apiHost: 'example.qweatherapi.com',
    apiKey: 'test-key',
    region
};

function response(payload) {
    return { ok: true, status: 200, json: async () => payload };
}

test('makeUrl safely encodes location query values without putting credentials in the URL', () => {
    const url = new URL(makeUrl('example.qweatherapi.com', '/geo/v2/city/lookup', { location: '南山区,深圳市' }));
    assert.equal(url.searchParams.get('location'), '南山区,深圳市');
    assert.equal(url.searchParams.has('key'), false);
});

test('chooseLocation disambiguates by district, city, and province', () => {
    const selected = chooseLocation([
        { id: 'wrong', name: '朝阳区', adm1: '北京市', adm2: '北京市' },
        { id: 'right', name: '南山区', adm1: '广东省', adm2: '深圳市' }
    ], region);
    assert.equal(selected.id, 'right');
});

test('getWeatherSnapshot resolves the QWeather ID and returns current and next-hour data', async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
        requests.push({ url: new URL(url), headers: options.headers });
        if (url.includes('/v2/city/lookup')) {
            return response({ code: '200', location: [{ id: '101280604', name: '南山区', adm1: '广东省', adm2: '深圳市', lat: '22.53332', lon: '113.93041' }] });
        }
        if (url.includes('/weather/v1/current/')) {
            return response({ condition: { text: '多云', code: '101' }, temperature: { value: 27, unit: '°C' } });
        }
        return response({ hours: [{ forecastTime: '2999-01-01T11:00+08:00', temperature: { value: 28, unit: '°C' }, condition: { text: '晴', code: '100' } }] });
    };
    let saved;
    const snapshot = await getWeatherSnapshot(settings, {
        fetchImpl,
        saveSettings: async value => { saved = value; }
    });

    assert.equal(snapshot.locationId, '101280604');
    assert.equal(snapshot.now.temp, '27');
    assert.equal(snapshot.now.text, '多云');
    assert.equal(snapshot.nextHour.temp, '28');
    assert.equal(saved.region.qweatherLocationId, '101280604');
    assert.equal(saved.region.latitude, 22.53332);
    assert.equal(saved.region.longitude, 113.93041);
    assert.equal(requests.length, 3);
    assert.equal(requests[0].url.pathname, '/geo/v2/city/lookup');
    assert.equal(requests[1].url.pathname, '/weather/v1/current/22.53/113.93');
    assert.equal(requests[2].url.pathname, '/weather/v1/hourly/22.53/113.93');
    assert.equal(requests[1].url.searchParams.get('lang'), 'zh');
    assert.equal(requests[2].url.searchParams.get('hours'), '2');
    assert.equal(requests[1].url.searchParams.has('key'), false);
    assert.equal(requests[1].headers['X-QW-Api-Key'], 'test-key');
});

test('getWeatherSnapshot rejects lookup results that do not match the selected region', async () => {
    const fetchImpl = async () => response({ code: '200', location: [
        { id: '1', name: '南山区', adm1: '广东省', adm2: '其他市', lat: '22.5', lon: '113.9' },
        { id: '2', name: '南山区', adm1: '其他省', adm2: '其他市', lat: '22.5', lon: '113.9' }
    ] });
    await assert.rejects(() => getWeatherSnapshot(settings, { fetchImpl }), /could not resolve/);
});

test('getWeatherSnapshot rejects unexpected V1 response payloads instead of displaying blank data', async () => {
    const configuredSettings = {
        ...settings,
        region: { ...region, qweatherLocationId: '101280604', latitude: 22.53, longitude: 113.93 }
    };
    const fetchImpl = async url => {
        if (url.includes('/weather/v1/current/')) return response({ unexpected: true });
        return response({ hours: [] });
    };
    await assert.rejects(() => getWeatherSnapshot(configuredSettings, { fetchImpl }), /Unexpected QWeather V1 response schema/);
});

test('getWeatherSnapshot sends the API key in the documented header', async () => {
    const configuredSettings = {
        ...settings,
        region: { ...region, qweatherLocationId: '101280604', latitude: 22.53, longitude: 113.93 }
    };
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push({ url, headers: options.headers });
        if (url.includes('/weather/v1/current/')) return response({ condition: { text: '晴', code: '100' }, temperature: { value: 25, unit: '°C' } });
        return response({ hours: [] });
    };
    await getWeatherSnapshot(configuredSettings, { fetchImpl });
    assert.equal(calls.length, 2);
    assert.equal(calls.every(call => call.headers['X-QW-Api-Key'] === 'test-key'), true);
    assert.equal(calls.every(call => !call.url.includes('test-key')), true);
});

test('getWeatherSnapshot returns disabled when weather is not configured', async () => {
    assert.deepEqual(await getWeatherSnapshot({ enabled: false }), { enabled: false });
});


test('getWeatherSnapshot logs request inputs and API response bodies without exposing the API key', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qweather-log-test-'));
    const logPath = path.join(directory, 'app.log');
    try {
        const logger = createLogger({ filePath: logPath });
        const configuredSettings = {
            ...settings,
            region: { ...region, qweatherLocationId: '101280604', latitude: 22.53, longitude: 113.93 }
        };
        const fetchImpl = async url => {
            if (url.includes('/weather/v1/current/')) {
                return response({ condition: { text: '多云', code: '101' }, temperature: { value: 27, unit: '°C' }, metadata: { attributions: ['https://developer.qweather.com/attribution.html'] } });
            }
            return response({ hours: [{ forecastTime: '2999-01-01T11:00+08:00', temperature: { value: 28, unit: '°C' }, condition: { text: '晴', code: '100' } }] });
        };

        const snapshot = await getWeatherSnapshot(configuredSettings, { fetchImpl, logger });
        const output = fs.readFileSync(logPath, 'utf8');
        const records = output.trim().split('\n').map(line => JSON.parse(line));
        const requests = records.filter(record => record.event === 'weather.api.request');
        const responses = records.filter(record => record.event === 'weather.api.response');

        assert.equal(snapshot.now.temp, '27');
        assert.equal(requests.length, 2);
        assert.equal(responses.length, 2);
        assert.equal(requests[0].details.path, '/weather/v1/current/22.53/113.93');
        assert.equal(requests[0].details.query.key, undefined);
        assert.equal(responses.some(record => record.details.body.condition && record.details.body.temperature.value === 27), true);
        assert.equal(output.includes('test-key'), false);
        assert.equal(records.at(-1).event, 'weather.snapshot.success');
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
