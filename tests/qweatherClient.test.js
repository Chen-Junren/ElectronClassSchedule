const test = require('node:test');
const assert = require('node:assert/strict');
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

test('makeUrl safely encodes location query values', () => {
    const url = new URL(makeUrl('geoapi.qweather.com', '/v2/city/lookup', { location: '南山区,深圳市', key: 'x y' }));
    assert.equal(url.searchParams.get('location'), '南山区,深圳市');
    assert.equal(url.searchParams.get('key'), 'x y');
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
    const fetchImpl = async url => {
        requests.push(new URL(url));
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
