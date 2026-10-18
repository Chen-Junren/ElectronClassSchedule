'use strict';

const { normalize } = require('../js/chinaRegionSearch');

function makeUrl(host, pathname, params) {
    const url = new URL('https://' + host + pathname);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
    }
    return url.toString();
}

async function requestJson(fetchImpl, url, logger, apiKey) {
    const startedAt = Date.now();
    const parsedUrl = new URL(url);
    const requestDetails = {
        method: 'GET',
        url,
        path: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams.entries())
    };
    if (logger && typeof logger.info === 'function') logger.info('weather.api.request', requestDetails);

    try {
        const response = await fetchImpl(url, { headers: { Accept: 'application/json', 'X-QW-Api-Key': apiKey } });
        if (!response || response.ok === false) {
            let body = null;
            if (response && typeof response.json === 'function') {
                try { body = await response.json(); } catch (_error) {}
            }
            if (logger && typeof logger.warn === 'function') {
                logger.warn('weather.api.response', {
                    url,
                    status: response && Number.isInteger(response.status) ? response.status : null,
                    ok: false,
                    durationMs: Date.now() - startedAt,
                    body
                });
            }
            const status = response && Number.isInteger(response.status) ? ' (HTTP ' + response.status + ')' : '';
            throw new Error('QWeather request failed' + status);
        }

        const payload = await response.json();
        if (logger && typeof logger.info === 'function') {
            logger.info('weather.api.response', {
                url,
                status: Number.isInteger(response.status) ? response.status : null,
                ok: true,
                durationMs: Date.now() - startedAt,
                body: payload
            });
        }
        if (!payload || String(payload.code) !== '200') {
            throw new Error('QWeather API error: ' + String(payload && payload.code || 'unknown'));
        }
        return payload;
    } catch (error) {
        if (logger && typeof logger.error === 'function') {
            logger.error('weather.api.failure', {
                url,
                durationMs: Date.now() - startedAt,
                error: { name: error && error.name, message: error && error.message, stack: error && error.stack }
            });
        }
        throw error;
    }
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

    const logger = options.logger;
    const region = settings.region;
    if (logger && typeof logger.info === 'function') {
        logger.info('weather.snapshot.start', {
            enabled: settings.enabled,
            apiHost: settings.apiHost,
            geoApiHost: settings.geoApiHost,
            region: {
                label: region.label,
                province: region.province,
                city: region.city,
                district: region.district,
                adminCode: region.adminCode,
                qweatherLocationId: region.qweatherLocationId || null
            },
            locationIdCached: Boolean(region.qweatherLocationId)
        });
    }
    let locationId = region.qweatherLocationId || null;
    if (!locationId) {
        const lookupParams = {
            location: region.district + ',' + region.city + ',' + region.province,
        };
        let lookup = await requestJson(fetchImpl, makeUrl(settings.geoApiHost || 'geoapi.qweather.com', '/v2/city/lookup', lookupParams), logger, settings.apiKey);
        let selected = chooseLocation(lookup.location, region);
        if (!selected) {
            lookup = await requestJson(fetchImpl, makeUrl(settings.geoApiHost || 'geoapi.qweather.com', '/v2/city/lookup', {
                location: region.district,
            }), logger, settings.apiKey);
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

    const common = { location: locationId };
    const [nowPayload, hourlyPayload] = await Promise.all([
        requestJson(fetchImpl, makeUrl(settings.apiHost, '/v7/weather/now', common), logger, settings.apiKey),
        requestJson(fetchImpl, makeUrl(settings.apiHost, '/v7/weather/24h', common), logger, settings.apiKey)
    ]);
    const now = nowPayload.now || {};
    const hours = Array.isArray(hourlyPayload.hourly) ? hourlyPayload.hourly : [];
    const currentTime = Date.now();
    const nextHour = hours.find(item => {
        const timestamp = Date.parse(item.fxTime || '');
        return Number.isFinite(timestamp) && timestamp > currentTime;
    }) || hours[0] || null;

    const snapshot = {
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
    if (logger && typeof logger.info === 'function') logger.info('weather.snapshot.success', snapshot);
    return snapshot;
}

module.exports = { getWeatherSnapshot, chooseLocation, makeUrl };
