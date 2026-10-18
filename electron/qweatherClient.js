'use strict';

const { normalize } = require('../js/chinaRegionSearch');

function makeUrl(host, pathname, params) {
    const url = new URL('https://' + host + pathname);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
    }
    return url.toString();
}

async function requestJson(fetchImpl, url) {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!response || response.ok === false) {
        const status = response && Number.isInteger(response.status) ? ' (HTTP ' + response.status + ')' : '';
        throw new Error('QWeather request failed' + status);
    }
    const payload = await response.json();
    if (!payload || String(payload.code) !== '200') {
        throw new Error('QWeather API error: ' + String(payload && payload.code || 'unknown'));
    }
    return payload;
}

function chooseLocation(locations, region) {
    if (!Array.isArray(locations) || locations.length === 0) return null;
    const district = normalize(region.district);
    const city = normalize(region.city);
    const province = normalize(region.province);
    const exactDistrict = locations.find(item =>
        normalize(item.name) === district &&
        (!city || normalize(item.adm2) === city || normalize(item.adm2) === district) &&
        (!province || normalize(item.adm1) === province));
    if (exactDistrict) return exactDistrict;

    const districtAndCity = locations.find(item =>
        normalize(item.name) === district &&
        (!city || normalize(item.adm2) === city));
    if (districtAndCity) return districtAndCity;

    if (locations.length === 1 && normalize(locations[0].name) === district) return locations[0];
    return null;
}

async function getWeatherSnapshot(settings, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable in this runtime');
    if (!settings || settings.enabled !== true || !settings.region || !settings.apiKey) {
        return { enabled: false };
    }

    const region = settings.region;
    let locationId = region.qweatherLocationId || null;
    if (!locationId) {
        const lookupParams = {
            location: region.district + ',' + region.city + ',' + region.province,
            key: settings.apiKey
        };
        let lookup = await requestJson(fetchImpl, makeUrl(settings.geoApiHost || 'geoapi.qweather.com', '/v2/city/lookup', lookupParams));
        let selected = chooseLocation(lookup.location, region);
        if (!selected) {
            lookup = await requestJson(fetchImpl, makeUrl(settings.geoApiHost || 'geoapi.qweather.com', '/v2/city/lookup', {
                location: region.district,
                key: settings.apiKey
            }));
            selected = chooseLocation(lookup.location, region);
        }
        if (!selected || !selected.id) {
            throw new Error('QWeather could not resolve the selected district. Check the region and API host.');
        }
        locationId = String(selected.id);
        const updatedSettings = {
            ...settings,
            region: { ...region, qweatherLocationId: locationId }
        };
        if (typeof options.saveSettings === 'function') await options.saveSettings(updatedSettings);
    }

    const common = { location: locationId, key: settings.apiKey };
    const [nowPayload, hourlyPayload] = await Promise.all([
        requestJson(fetchImpl, makeUrl(settings.apiHost, '/v7/weather/now', common)),
        requestJson(fetchImpl, makeUrl(settings.apiHost, '/v7/weather/1h', common))
    ]);
    const now = nowPayload.now || {};
    const hours = Array.isArray(hourlyPayload.hourly) ? hourlyPayload.hourly : [];
    const currentTime = Date.now();
    const nextHour = hours.find(item => {
        const timestamp = Date.parse(item.fxTime || '');
        return Number.isFinite(timestamp) && timestamp > currentTime;
    }) || hours[0] || null;

    return {
        enabled: true,
        regionLabel: region.label,
        adminCode: region.adminCode,
        locationId,
        now: {
            temp: typeof now.temp === 'string' ? now.temp : null,
            text: typeof now.text === 'string' ? now.text : null,
            icon: typeof now.icon === 'string' ? now.icon : null,
            obsTime: typeof now.obsTime === 'string' ? now.obsTime : null
        },
        nextHour: nextHour ? {
            temp: typeof nextHour.temp === 'string' ? nextHour.temp : null,
            text: typeof nextHour.text === 'string' ? nextHour.text : null,
            icon: typeof nextHour.icon === 'string' ? nextHour.icon : null,
            fxTime: typeof nextHour.fxTime === 'string' ? nextHour.fxTime : null
        } : null,
        fetchedAt: new Date().toISOString()
    };
}

module.exports = { getWeatherSnapshot, chooseLocation, makeUrl };
