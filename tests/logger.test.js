const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLogger } = require('../electron/logger');

function temporaryLogFile() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'class-schedule-log-'));
    return { directory, filePath: path.join(directory, 'logs', 'app.log') };
}

test('logger writes JSONL records with timestamps, level, event, and details', () => {
    const temp = temporaryLogFile();
    try {
        const logger = createLogger({ filePath: temp.filePath });
        logger.info('app.started', { version: '1.0.0', enabled: true });
        const records = fs.readFileSync(temp.filePath, 'utf8').trim().split('\n').map(line => JSON.parse(line));
        assert.equal(records.length, 1);
        assert.match(records[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
        assert.equal(records[0].level, 'INFO');
        assert.equal(records[0].event, 'app.started');
        assert.deepEqual(records[0].details, { version: '1.0.0', enabled: true });
    } finally {
        fs.rmSync(temp.directory, { recursive: true, force: true });
    }
});

test('logger redacts QWeather API keys in structured values and request URLs', () => {
    const temp = temporaryLogFile();
    try {
        const logger = createLogger({ filePath: temp.filePath });
        logger.info('weather.api.request', {
            url: 'https://api.qweather.com/v7/weather/now?location=101280604&key=super-secret',
            query: { location: '101280604', key: 'super-secret' },
            apiKey: 'another-secret'
        });
        const output = fs.readFileSync(temp.filePath, 'utf8');
        assert.equal(output.includes('super-secret'), false);
        assert.equal(output.includes('another-secret'), false);
        assert.match(output, /\[REDACTED\]/);
        assert.match(output, /101280604/);
    } finally {
        fs.rmSync(temp.directory, { recursive: true, force: true });
    }
});

test('logger continuously trims old records so the log file stays below its size budget', () => {
    const temp = temporaryLogFile();
    const maxBytes = 2048;
    try {
        const logger = createLogger({ filePath: temp.filePath, maxBytes });
        for (let i = 0; i < 80; i += 1) {
            logger.info('test.repeated_event', { index: i, message: 'x'.repeat(240) });
            assert.ok(fs.statSync(temp.filePath).size <= maxBytes);
        }
        const output = fs.readFileSync(temp.filePath, 'utf8');
        const lines = output.trim().split('\n');
        assert.ok(lines.length < 80, 'older rows should be discarded as the file rotates');
        assert.equal(JSON.parse(lines[lines.length - 1]).details.index, 79);
        assert.ok(lines.every(line => {
            try { JSON.parse(line); return true; } catch (_error) { return false; }
        }), 'retained rows should remain valid JSON lines');
    } finally {
        fs.rmSync(temp.directory, { recursive: true, force: true });
    }
});
