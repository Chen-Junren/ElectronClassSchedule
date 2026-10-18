'use strict';

const fs = require('fs');
const path = require('path');

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const RETAIN_LOG_BYTES = Math.floor(MAX_LOG_BYTES / 2);
const MAX_STRING_LENGTH = 12000;
const MAX_DEPTH = 8;

function redactUrl(value) {
    try {
        const url = new URL(value);
        for (const key of [...url.searchParams.keys()]) {
            if (/^(key|api[_-]?key|token|access_token|secret|password|authorization)$/i.test(key)) {
                url.searchParams.set(key, '[REDACTED]');
            }
        }
        return url.toString();
    } catch (_error) {
        return value;
    }
}

function sanitize(value, key = '', depth = 0) {
    if (/^(api[_-]?key|key|authorization|access[_-]?token|token|secret|password|client[_-]?secret)$/i.test(key)) {
        return value == null || value === '' ? value : '[REDACTED]';
    }
    if (depth > MAX_DEPTH) return '[MAX_DEPTH_REACHED]';
    if (typeof value === 'string') {
        let result = value;
        if (/^https?:\/\//i.test(result)) result = redactUrl(result);
        // Avoid very large single log fields while retaining useful diagnostics.
        if (result.length > MAX_STRING_LENGTH) result = result.slice(0, MAX_STRING_LENGTH) + '…[TRUNCATED]';
        return result;
    }
    if (value instanceof Error) {
        return {
            name: value.name,
            message: sanitize(value.message, 'message', depth + 1),
            stack: sanitize(value.stack || '', 'stack', depth + 1)
        };
    }
    if (Array.isArray(value)) {
        return value.slice(0, 500).map(item => sanitize(item, '', depth + 1))
            .concat(value.length > 500 ? ['…[ARRAY_TRUNCATED]'] : []);
    }
    if (value && typeof value === 'object') {
        const result = {};
        for (const [childKey, childValue] of Object.entries(value)) {
            result[childKey] = sanitize(childValue, childKey, depth + 1);
        }
        return result;
    }
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'function') return '[Function]';
    return value;
}

function createLogger(options = {}) {
    const filePath = options.filePath || path.join(options.directory || process.cwd(), 'logs', 'app.log');
    const maxBytes = Number.isSafeInteger(options.maxBytes) && options.maxBytes > 1024
        ? options.maxBytes
        : MAX_LOG_BYTES;
    const retainBytes = Math.min(Math.floor(maxBytes / 2), RETAIN_LOG_BYTES);

    function safeWrite(level, event, details) {
        const record = {
            timestamp: new Date().toISOString(),
            level,
            event: String(event || 'log'),
            ...(details === undefined ? {} : { details: sanitize(details) })
        };
        let line = Buffer.from(JSON.stringify(record) + '\n', 'utf8');
        // Never allow one malformed/oversized event to exceed the entire log budget.
        if (line.length > maxBytes) {
            line = Buffer.from(JSON.stringify({
                timestamp: record.timestamp,
                level,
                event: record.event,
                details: { truncated: true, message: 'Log entry exceeded size limit', originalBytes: line.length }
            }) + '\n', 'utf8');
        }

        try {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            let currentSize = 0;
            try {
                currentSize = fs.statSync(filePath).size;
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }

            if (currentSize + line.length > maxBytes) {
                let tail = Buffer.alloc(0);
                try {
                    const existing = fs.readFileSync(filePath);
                    const start = Math.max(0, existing.length - retainBytes);
                    const newline = existing.indexOf(0x0a, start);
                    tail = newline >= 0 ? existing.subarray(newline + 1) : Buffer.alloc(0);
                } catch (error) {
                    if (error.code !== 'ENOENT') throw error;
                }
                // Further trim only if necessary; the current file plus the new row stays under maxBytes.
                const budget = Math.max(0, maxBytes - line.length);
                if (tail.length > budget) {
                    const start = tail.length - budget;
                    const newline = tail.indexOf(0x0a, start);
                    tail = newline >= 0 ? tail.subarray(newline + 1) : Buffer.alloc(0);
                }
                fs.writeFileSync(filePath, tail);
            }
            fs.appendFileSync(filePath, line);
        } catch (error) {
            // Logging must never crash the application. Fall back to stderr for filesystem failures.
            try {
                process.stderr.write('[logger] Failed to write log: ' + String(error && error.message || error) + '\n');
            } catch (_ignored) {}
        }
    }

    return {
        debug(event, details) { safeWrite('DEBUG', event, details); },
        info(event, details) { safeWrite('INFO', event, details); },
        warn(event, details) { safeWrite('WARN', event, details); },
        error(event, details) { safeWrite('ERROR', event, details); },
        filePath,
        maxBytes
    };
}

module.exports = { createLogger, MAX_LOG_BYTES, sanitize, redactUrl };
