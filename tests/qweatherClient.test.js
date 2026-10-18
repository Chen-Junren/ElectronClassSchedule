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
    qweatherLocationId: null
};
const settings = {
    enabled: true,
    apiHost: 'api.qweather.com',
    geoApiHost: 'geoapi.qweather.com',
    apiKey: 'test-key',
    region
};

function response(payload) {
    return { ok: true, status: 200, json: async () => payload };
}

test('makeUrl safely encodes location query values without putting credentials in the URL', () => {
    const url = new URL(makeUrl('geoapi.qweather.com', '/v2/city/lookup', { location: '南山区,深圳市' }));
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
            return response({ code: '200', location: [{ id: '101280604', name: '南山区', adm1: '广东省', adm2: '深圳市' }] });
        }
        if (url.includes('/v7/weather/now')) {
            return response({ code: '200', now: { temp: '27', text: '多云', icon: '101', obsTime: '2026-10-18T10:00+08:00' } });
        }
        return response({ code: '200', hourly: [{ fxTime: '2999-01-01T11:00+08:00', temp: '28', text: '晴' }] });
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
    assert.equal(requests.length, 3);
    assert.equal(requests[1].url.pathname, '/v7/weather/now');
    assert.equal(requests[2].url.pathname, '/v7/weather/24h');
    assert.equal(requests[1].url.searchParams.has('key'), false);
    assert.equal(requests[1].headers['X-QW-Api-Key'], 'test-key');
});

test('getWeatherSnapshot rejects lookup results that do not match the selected region', async () => {
    const fetchImpl = async () => response({ code: '200', location: [
        { id: '1', name: '南山区', adm1: '广东省', adm2: '其他市' },
        { id: '2', name: '南山区', adm1: '其他省', adm2: '其他市' }
    ] });
    await assert.rejects(() => getWeatherSnapshot(settings, { fetchImpl }), /could not resolve/);
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
            region: { ...region, qweatherLocationId: '101280604' }
        };
        const fetchImpl = async url => {
            if (url.includes('/v7/weather/now')) {
                return response({ code: '200', now: { temp: '27', text: '多云', icon: '101' } });
            }
            return response({ code: '200', hourly: [{ fxTime: '2999-01-01T11:00+08:00', temp: '28', text: '晴' }] });
        };

        const snapshot = await getWeatherSnapshot(configuredSettings, { fetchImpl, logger });
        const output = fs.readFileSync(logPath, 'utf8');
        const records = output.trim().split('\n').map(line => JSON.parse(line));
        const requests = records.filter(record => record.event === 'weather.api.request');
        const responses = records.filter(record => record.event === 'weather.api.response');

        assert.equal(snapshot.now.temp, '27');
        assert.equal(requests.length, 2);
        assert.equal(responses.length, 2);
        assert.equal(requests[0].details.query.location, '101280604');
        assert.equal(requests[0].details.query.key, undefined);
        assert.equal(requests[0].details.path, '/v7/weather/now');
        assert.equal(responses.some(record => record.details.body.now && record.details.body.now.temp === '27'), true);
        assert.equal(output.includes('test-key'), false);
        assert.equal(records.at(-1).event, 'weather.snapshot.success');
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
