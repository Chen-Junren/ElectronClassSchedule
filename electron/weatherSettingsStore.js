'use strict';

const STORE_KEY = 'weatherSettings';

function normalizeWeatherSettings(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('Weather settings must be an object');
    }

    let apiHost = typeof value.apiHost === 'string' ? value.apiHost.trim() : '';
    if (['api.qweather.com', 'devapi.qweather.com', 'geoapi.qweather.com'].includes(apiHost.toLowerCase())) apiHost = '';
    if (apiHost && (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(apiHost) || apiHost.includes('..'))) {
        throw new TypeError('Invalid QWeather API host');
    }

    const apiKey = typeof value.apiKey === 'string' ? value.apiKey.trim() : '';
    if (apiKey.length > 512) throw new RangeError('QWeather API key is too long');

    let region = null;
    if (value.region != null) {
        const input = value.region;
        if (!input || typeof input !== 'object' || Array.isArray(input)
            || typeof input.adminCode !== 'string' || !/^\d{6}$/.test(input.adminCode)
            || typeof input.label !== 'string' || input.label.length > 300
            || typeof input.province !== 'string' || input.province.length > 100
            || typeof input.city !== 'string' || input.city.length > 100
            || typeof input.district !== 'string' || input.district.length > 100) {
            throw new TypeError('Invalid selected administrative region');
        }
        const qweatherLocationId = input.qweatherLocationId == null ? null : String(input.qweatherLocationId);
        if (qweatherLocationId && !/^[a-zA-Z0-9_-]{1,64}$/.test(qweatherLocationId)) {
            throw new TypeError('Invalid QWeather location ID');
        }
        const latitude = input.latitude == null ? null : Number(input.latitude);
        const longitude = input.longitude == null ? null : Number(input.longitude);
        if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
            || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
            || ((latitude === null) !== (longitude === null))) {
            throw new TypeError('Invalid QWeather coordinates');
        }
        region = {
            adminCode: input.adminCode,
            label: input.label,
            province: input.province,
            city: input.city,
            district: input.district,
            qweatherLocationId,
            latitude,
            longitude
        };
    }

    const enabled = value.enabled === true;
    if (enabled && (!region || !apiKey)) {
        throw new TypeError('Weather panel requires a selected region and API key');
    }

    return { enabled, apiHost, apiKey, region };
}

function loadWeatherSettings(store) {
    const saved = store.get(STORE_KEY, null);
    if (!saved) {
        return { enabled: false, apiHost: '', apiKey: '', region: null };
    }
    try {
        return normalizeWeatherSettings(saved);
    } catch (_error) {
        return { enabled: false, apiHost: '', apiKey: '', region: null };
    }
}

function saveWeatherSettings(store, value) {
    const normalized = normalizeWeatherSettings(value);
    store.set(STORE_KEY, normalized);
    return normalized;
}

module.exports = { normalizeWeatherSettings, loadWeatherSettings, saveWeatherSettings };
