'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'js', 'renderer.js'), 'utf8');

function channelsFromSet(setName) {
    const match = new RegExp('const ' + setName + ' = new Set\\(\\[([\\s\\S]*?)\\]\\);').exec(preload);
    assert.ok(match, 'preload.js must declare ' + setName);
    return new Set(Array.from(match[1].matchAll(/['"]([^'"]+)['"]/g), item => item[1]));
}

test('preload receive allowlist includes every renderer IPC event listener', () => {
    const allowed = channelsFromSet('receiveChannels');
    const used = new Set(Array.from(renderer.matchAll(/ipcRenderer\.on\(\s*['"]([^'"]+)['"]/g), item => item[1]));
    const missing = [...used].filter(channel => !allowed.has(channel));
    assert.deepEqual(missing, [], 'Missing receiveChannels entries: ' + missing.join(', '));
});

test('preload send allowlist includes every renderer IPC send channel', () => {
    const allowed = channelsFromSet('sendChannels');
    const used = new Set(Array.from(renderer.matchAll(/ipcRenderer\.send\(\s*['"]([^'"]+)['"]/g), item => item[1]));
    const missing = [...used].filter(channel => !allowed.has(channel));
    assert.deepEqual(missing, [], 'Missing sendChannels entries: ' + missing.join(', '));
});
