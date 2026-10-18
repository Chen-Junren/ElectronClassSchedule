/*
 * Searchable China province/city/county administrative divisions.
 * Dataset source: https://github.com/mumuy/data_location (MIT License).
 * The dataset contains six-digit administrative codes and names; weather-service
 * identifiers must be resolved separately and must not be assumed equal to these codes.
 */
'use strict';

function normalize(value) {
    return String(value == null ? '' : value)
        .toLocaleLowerCase('zh-CN')
        .replace(/[\s,，、。·._-]/g, '')
        .replace(/特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|自治州|自治县|自治旗|省|市|区|县|旗|盟|地区/g, '');
}

function buildDistrictIndex(codeNameMap) {
    if (!codeNameMap || typeof codeNameMap !== 'object' || Array.isArray(codeNameMap)) {
        throw new TypeError('District code data must be an object mapping codes to names');
    }

    const names = new Map(Object.entries(codeNameMap).map(([code, name]) => [String(code), String(name)]));
    const regions = [];

    for (const [code, district] of names) {
        if (!/^\d{6}$/.test(code) || code.endsWith('0000') || code.endsWith('00')) continue;

        const provinceCode = code.slice(0, 2) + '0000';
        const cityCode = code.slice(0, 4) + '00';
        const province = names.get(provinceCode);
        if (!province) continue;

        // Some municipalities do not publish a separate city-level row in this dataset.
        // For these cases, use the municipality name as the city label as well.
        const city = names.get(cityCode) || province;
        const label = code + '-' + province + ',' + city + ',' + district;
        regions.push({
            code,
            provinceCode,
            cityCode: names.has(cityCode) ? cityCode : null,
            province,
            city,
            district,
            label,
            searchText: normalize([code, province, city, district, label].join(' '))
        });
    }

    regions.sort((a, b) => a.code.localeCompare(b.code));
    return regions;
}

function searchDistricts(regions, query, limit = 20) {
    if (!Array.isArray(regions)) throw new TypeError('District index must be an array');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new RangeError('Search limit must be an integer between 1 and 100');
    }

    const rawQuery = String(query == null ? '' : query).trim();
    if (!rawQuery) return [];

    const terms = rawQuery.split(/[\s,，、;；]+/).map(normalize).filter(Boolean);
    const compactQuery = normalize(rawQuery);
    if (!compactQuery && terms.length === 0) return [];
    const matches = [];

    for (const region of regions) {
        const code = String(region.code);
        const searchable = region.searchText || normalize([
            code, region.province, region.city, region.district, region.label
        ].join(' '));
        const allTermsMatch = terms.length > 0 && terms.every(term => searchable.includes(term));
        const compactMatch = compactQuery && searchable.includes(compactQuery);
        if (!allTermsMatch && !compactMatch) continue;

        let score = 0;
        if (code === rawQuery) score += 1000;
        if (normalize(region.district) === compactQuery) score += 500;
        if (code.startsWith(rawQuery)) score += 300;
        if (normalize(region.district).startsWith(compactQuery)) score += 200;
        if (normalize(region.city).startsWith(compactQuery)) score += 100;
        matches.push({ region, score });
    }

    matches.sort((a, b) => b.score - a.score || a.region.label.localeCompare(b.region.label, 'zh-CN'));
    return matches.slice(0, limit).map(item => ({
        code: item.region.code,
        provinceCode: item.region.provinceCode,
        cityCode: item.region.cityCode,
        province: item.region.province,
        city: item.region.city,
        district: item.region.district,
        label: item.region.label
    }));
}

module.exports = { normalize, buildDistrictIndex, searchDistricts };
