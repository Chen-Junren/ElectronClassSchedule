const test = require('node:test');
const assert = require('node:assert/strict');
const codeNameMap = require('../data/china-district-codes.json');
const { buildDistrictIndex, searchDistricts, normalize } = require('../js/chinaRegionSearch');

const regions = buildDistrictIndex(codeNameMap);

test('buildDistrictIndex creates county-level records with display labels', () => {
    const nanshan = regions.find(region => region.code === '440305');
    assert.ok(nanshan);
    assert.equal(nanshan.province, '广东省');
    assert.equal(nanshan.city, '深圳市');
    assert.equal(nanshan.district, '南山区');
    assert.equal(nanshan.label, '440305-广东省,深圳市,南山区');
});

test('searchDistricts supports district names and multi-keyword searches', () => {
    const nanshan = searchDistricts(regions, '南山区');
    assert.ok(nanshan.some(region => region.code === '440305'));

    const qualified = searchDistricts(regions, '广东 深圳 南山');
    assert.ok(qualified.some(region => region.code === '440305'));
});

test('searchDistricts disambiguates same-named districts with full paths', () => {
    const results = searchDistricts(regions, '朝阳区', 50);
    assert.ok(results.length >= 2);
    assert.ok(results.every(region => region.label.includes(region.province) && region.label.includes(region.city)));
});

test('searchDistricts supports administrative code lookup and result limits', () => {
    assert.equal(searchDistricts(regions, '440305')[0].district, '南山区');
    const limitedResults = searchDistricts(regions, '深圳', 3);
    assert.ok(limitedResults.length > 0 && limitedResults.length <= 3);
    assert.deepEqual(searchDistricts(regions, ''), []);
});

test('searchDistricts validates arguments and normalize ignores common separators', () => {
    assert.equal(normalize(' 广东省，深圳市 '), '广东深圳');
    assert.throws(() => buildDistrictIndex([]), TypeError);
    assert.throws(() => searchDistricts(regions, '深圳', 0), RangeError);
});
