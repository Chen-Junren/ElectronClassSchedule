'use strict';

const { normalize } = require('../js/chinaRegionSearch');

function makeUrl(host, pathname, params = {}) {
    const url = new URL('https://' + host + pathname);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    return url.toString();
}

async function requestJson(fetchImpl, url, logger, apiKey) {
    const startedAt = Date.now();
    const parsedUrl = new URL(url);
    const requestDetails = {
        method: 'GET',
        host: parsedUrl.host,
        path: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams.entries())
    };
    if (logger && typeof logger.info === 'function') logger.info('weather.api.request', requestDetails);

    try {
        const response = await fetchImpl(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'X-QW-Api-Key': apiKey
            }
        });
        if (!response || response.ok === false || (Number.isInteger(response.status) && response.status >= 400)) {
            let body = null;
            if (response && typeof response.json === 'function') {
                try { body = await response.json(); } catch (_error) {}
            }
            if (logger && typeof logger.warn === 'function') {
                logger.warn('weather.api.response', {
                    host: parsedUrl.host,
                    path: parsedUrl.pathname,
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
                host: parsedUrl.host,
                path: parsedUrl.pathname,
                status: Number.isInteger(response.status) ? response.status : null,
                ok: true,
                durationMs: Date.now() - startedAt,
                body: payload
            });
        }
        // GeoAPI V2 includes code=200; Weather V1 returns its data object directly.
        if (!payload || (payload.code != null && String(payload.code) !== '200')) {
            throw new Error('QWeather API error: ' + String(payload && payload.code || 'empty response'));
        }
        return payload;
    } catch (error) {
        if (logger && typeof logger.error === 'function') {
            logger.error('weather.api.failure', {
                host: parsedUrl.host,
                path: parsedUrl.pathname,
                durationMs: Date.now() - startedAt,
                error: { name: error && error.name, message: error && error.message }
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

function validCoordinate(value, min, max) {
    if (value === null || value === undefined || value === '') return false;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max;
}

async function resolveCoordinates(settings, options, logger) {
    const region = settings.region;
    const fetchImpl = options.fetchImpl;
    const cachedLat = region.latitude;
    const cachedLon = region.longitude;
    if (validCoordinate(cachedLat, -90, 90) && validCoordinate(cachedLon, -180, 180)) {
        return { locationId: region.qweatherLocationId || null, latitude: Number(cachedLat), longitude: Number(cachedLon) };
    }

    const queryLocations = [];
    if (region.qweatherLocationId) queryLocations.push(region.qweatherLocationId);
    queryLocations.push(region.district + ',' + region.city + ',' + region.province);
    queryLocations.push(region.district);

    for (const locationQuery of [...new Set(queryLocations)]) {
        const payload = await requestJson(
            fetchImpl,
            makeUrl(settings.apiHost, '/geo/v2/city/lookup', { location: locationQuery, range: 'cn', lang: 'zh' }),
            logger,
            settings.apiKey
        );
        const selected = locationQuery === region.qweatherLocationId
            ? (Array.isArray(payload.location) ? payload.location[0] : null)
            : chooseLocation(payload.location, region);
        if (!selected || !validCoordinate(selected.lat, -90, 90) || !validCoordinate(selected.lon, -180, 180)) continue;

        const updatedSettings = {
            ...settings,
            region: {
                ...region,
                qweatherLocationId: selected.id ? String(selected.id) : region.qweatherLocationId || null,
                latitude: Number(selected.lat),
                longitude: Number(selected.lon)
            }
        };
        if (typeof options.saveSettings === 'function') await options.saveSettings(updatedSettings);
        return {
            locationId: updatedSettings.region.qweatherLocationId,
            latitude: updatedSettings.region.latitude,
            longitude: updatedSettings.region.longitude
        };
    }
    throw new Error('QWeather could not resolve coordinates for the selected district. Check the region and API Host.');
}

function stringValue(value) {
    return value == null ? null : String(value);
}

async function getWeatherSnapshot(settings, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable in this runtime');
    if (!settings || settings.enabled !== true || !settings.region || !settings.apiKey || !settings.apiHost) {
        return { enabled: false };
    }

    const logger = options.logger;
    const region = settings.region;
    if (logger && typeof logger.info === 'function') {
        logger.info('weather.snapshot.start', {
            enabled: settings.enabled,
            apiHost: settings.apiHost,
            apiVersion: 'v1',
            region: {
                label: region.label,
                province: region.province,
                city: region.city,
                district: region.district,
                adminCode: region.adminCode,
                qweatherLocationId: region.qweatherLocationId || null,
                hasCoordinates: validCoordinate(region.latitude, -90, 90) && validCoordinate(region.longitude, -180, 180)
            }
        });
    }

    const { locationId, latitude, longitude } = await resolveCoordinates(settings, options, logger);
    const lat = latitude.toFixed(2);
    const lon = longitude.toFixed(2);
    const [nowPayload, hourlyPayload] = await Promise.all([
        requestJson(fetchImpl, makeUrl(settings.apiHost, '/weather/v1/current/' + lat + '/' + lon, { lang: 'zh', localTime: 'true' }), logger, settings.apiKey),
        requestJson(fetchImpl, makeUrl(settings.apiHost, '/weather/v1/hourly/' + lat + '/' + lon, { hours: 2, lang: 'zh', localTime: 'true' }), logger, settings.apiKey)
    ]);

    if (!nowPayload.condition || typeof nowPayload.condition !== 'object'
        || !nowPayload.temperature || typeof nowPayload.temperature !== 'object'
        || !Array.isArray(hourlyPayload.hours)) {
        throw new Error('Unexpected QWeather V1 response schema');
    }
    const hours = hourlyPayload.hours;
    const currentTime = Date.now();
    const nextHour = hours.find(item => {
        const timestamp = Date.parse(item && item.forecastTime || '');
        return Number.isFinite(timestamp) && timestamp > currentTime;
    }) || hours[0] || null;
    const nowCondition = nowPayload.condition || {};
    const nowTemperature = nowPayload.temperature || {};
    const nextCondition = nextHour && nextHour.condition || {};
    const nextTemperature = nextHour && nextHour.temperature || {};
    const snapshot = {
        enabled: true,
        regionLabel: region.label,
        adminCode: region.adminCode,
        locationId,
        coordinates: { latitude, longitude },
        now: {
            temp: stringValue(nowTemperature.value),
            text: stringValue(nowCondition.text),
            icon: stringValue(nowCondition.code),
            obsTime: null
        },
        nextHour: nextHour ? {
            temp: stringValue(nextTemperature.value),
            text: stringValue(nextCondition.text),
            icon: stringValue(nextCondition.code),
            fxTime: stringValue(nextHour.forecastTime)
        } : null,
        attribution: Array.isArray(nowPayload.metadata && nowPayload.metadata.attributions)
            ? nowPayload.metadata.attributions
            : [],
        fetchedAt: new Date().toISOString()
    };
    if (logger && typeof logger.info === 'function') logger.info('weather.snapshot.success', snapshot);
    return snapshot;
}

module.exports = { getWeatherSnapshot, chooseLocation, makeUrl, resolveCoordinates };
