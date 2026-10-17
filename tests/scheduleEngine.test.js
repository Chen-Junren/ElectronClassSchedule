const test = require('node:test');
const assert = require('node:assert/strict');
const ScheduleEngine = require('../js/scheduleEngine');

test('toMinutes parses HH:MM and HH:MM:SS times', () => {
    assert.equal(ScheduleEngine.toMinutes('07:40'), 460);
    assert.equal(ScheduleEngine.toMinutes('07:40:59'), 460);
});

test('time ranges include both configured endpoints', () => {
    assert.equal(ScheduleEngine.isClassCurrent('07:40', '08:19', '07:40'), true);
    assert.equal(ScheduleEngine.isClassCurrent('07:40', '08:19', '08:19'), true);
    assert.equal(ScheduleEngine.isClassCurrent('07:40', '08:19', '08:20'), false);
    assert.equal(ScheduleEngine.isBreakTime('08:20', '08:29', '08:25'), true);
});

test('toMinutes rejects malformed or out-of-range times', () => {
    assert.throws(() => ScheduleEngine.toMinutes('25:00'), RangeError);
    assert.throws(() => ScheduleEngine.toMinutes('08:75'), RangeError);
    assert.throws(() => ScheduleEngine.toMinutes('not-a-time'), RangeError);
});

test('getNextClassIndex finds the next numeric course entry', () => {
    const timetable = {
        '07:40-08:19': 0,
        '08:20-08:29': '课间',
        '08:30-09:09': 1,
        '09:10-09:19': '课间'
    };

    assert.equal(ScheduleEngine.getNextClassIndex(timetable, 0), 1);
    assert.equal(ScheduleEngine.getNextClassIndex(timetable, 2), null);
});

test('calculateCountdown preserves the configured end-minute convention', () => {
    assert.equal(ScheduleEngine.calculateCountdown('08:19', '08:19:00'), 60);
    assert.equal(ScheduleEngine.calculateCountdown('08:19', '08:19:59'), 1);
    assert.equal(ScheduleEngine.calculateCountdown('08:19', '08:20:00'), 0);
});

test('formatCountdown formats ordinary countdown values', () => {
    assert.equal(ScheduleEngine.formatCountdown(0), '00:00');
    assert.equal(ScheduleEngine.formatCountdown(125), '02:05');
    assert.equal(ScheduleEngine.formatCountdown(3600), '60:00');
});

test('buildScheduleData identifies the current class and countdown', () => {
    const config = {
        subject_name: { '语': '语文', '数': '数学' },
        daily_class: [{ timetable: 'workday' }],
        timetable: {
            workday: {
                '07:40-08:19': 0,
                '08:20-08:29': '课间',
                '08:30-09:09': 1
            }
        },
        divider: { workday: [0] }
    };

    const result = ScheduleEngine.buildScheduleData(config, ['语', '数'], '07:45:00', 0);
    assert.deepEqual(result.scheduleArray, ['语', '数']);
    assert.equal(result.timetable, 'workday');
    assert.deepEqual(result.divider, [0]);
    assert.deepEqual(result.currentHighlight, {
        index: 0,
        type: 'current',
        fullName: '语文',
        countdown: 2100,
        countdownText: '35:00'
    });
});

test('buildScheduleData highlights a break before the next class', () => {
    const config = {
        subject_name: { '语': '语文', '数': '数学' },
        daily_class: [{ timetable: 'workday' }],
        timetable: {
            workday: {
                '07:40-08:19': 0,
                '08:20-08:29': '课间',
                '08:30-09:09': 1
            }
        },
        divider: { workday: [] }
    };

    const result = ScheduleEngine.buildScheduleData(config, ['语', '数'], '08:25:00', 0);
    assert.equal(result.currentHighlight.index, 1);
    assert.equal(result.currentHighlight.type, 'upcoming');
    assert.equal(result.currentHighlight.fullName, '课间');
    assert.equal(result.currentHighlight.countdown, 300);
    assert.equal(result.currentHighlight.countdownText, '05:00');
});

test('buildScheduleData safely handles a missing day', () => {
    const result = ScheduleEngine.buildScheduleData({
        daily_class: [],
        timetable: {},
        divider: {},
        subject_name: {}
    }, [], '08:00:00', 3);

    assert.deepEqual(result.scheduleArray, []);
    assert.equal(result.currentHighlight.index, null);
    assert.equal(result.timetable, undefined);
});
