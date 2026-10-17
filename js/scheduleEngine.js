/*
 * Pure schedule/time helpers.
 *
 * This file can run both in the browser (as a classic script) and in Node.js
 * tests. Keep these functions independent of Electron, the DOM and localStorage.
 */
(function (root, factory) {
    const engine = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = engine;
    }

    if (root) {
        root.ScheduleEngine = engine;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function toMinutes(time) {
        if (typeof time !== 'string') {
            throw new TypeError('time must be a string in HH:MM or HH:MM:SS format');
        }

        const parts = time.split(':').map(Number);
        if ((parts.length !== 2 && parts.length !== 3) ||
            parts.some(part => !Number.isInteger(part)) ||
            parts[0] < 0 || parts[0] > 23 ||
            parts[1] < 0 || parts[1] > 59 ||
            (parts.length === 3 && (parts[2] < 0 || parts[2] > 59))) {
            throw new RangeError('Invalid time: ' + time);
        }

        return parts[0] * 60 + parts[1];
    }

    function isTimeInRange(startTime, endTime, currentTime) {
        const startMinutes = toMinutes(startTime);
        const endMinutes = toMinutes(endTime);
        const currentMinutes = toMinutes(currentTime);

        // Timetable ranges are intentionally inclusive: the configuration
        // stores each range's final minute (e.g. 07:40-08:19).
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }

    function getNextClassIndex(timetable, currentIndex) {
        const timeKeys = Object.keys(timetable);
        for (let i = currentIndex + 1; i < timeKeys.length; i++) {
            if (typeof timetable[timeKeys[i]] === 'number') {
                return timetable[timeKeys[i]];
            }
        }
        return null;
    }

    function calculateCountdown(targetTime, currentTime) {
        const [targetH, targetM] = targetTime.split(':').map(Number);
        const [currentH, currentM, currentS = 0] = currentTime.split(':').map(Number);

        // Existing timetable entries end one minute before the real boundary.
        // Keep the extra minute so the countdown reaches zero at the boundary.
        const targetTotalSeconds = targetH * 3600 + (targetM + 1) * 60;
        const currentTotalSeconds = currentH * 3600 + currentM * 60 + currentS;

        return targetTotalSeconds - currentTotalSeconds;
    }

    function formatCountdown(countdownSeconds) {
        const minutes = Math.floor(countdownSeconds / 60);
        const seconds = countdownSeconds % 60;
        return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }

    return {
        toMinutes,
        isTimeInRange,
        isBreakTime: isTimeInRange,
        isClassCurrent: isTimeInRange,
        getNextClassIndex,
        calculateCountdown,
        formatCountdown
    };
}));
