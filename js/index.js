﻿/*
 * Copyright (c) 2025. Chen Junren. All rights reserved.
 * This software is the proprietary information of Chen Junren.
 * Unauthorized use, reproduction, or distribution of this software
 * without prior written permission is strictly prohibited.
 * For authorized use, the following license applies: GNU GPL v3.0
 * For the full GPL license, read the LINCENSE file.
 * THIS SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,  ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

var weekIndex = localStorage.getItem('weekIndex')
if (weekIndex === null) {
  localStorage.setItem('weekIndex', '0')
}
weekIndex = Number(localStorage.getItem('weekIndex'))

var timeOffset = localStorage.getItem('timeOffset')
if (timeOffset === null) {
  localStorage.setItem('timeOffset', '0')
}
timeOffset = Number(localStorage.getItem('timeOffset'))

var dayOffset = localStorage.getItem('dayOffset')
if (dayOffset === null) {
  localStorage.setItem('dayOffset', '-1')
}
dayOffset = Number(localStorage.getItem('dayOffset'))

var setDayOffsetLastDay = localStorage.getItem('setDayOffsetLastDay')
if (setDayOffsetLastDay === null) {
  localStorage.setItem('setDayOffsetLastDay', '-1')
}
setDayOffsetLastDay = Number(localStorage.getItem('setDayOffsetLastDay'))

/**
 * Retrieves the current edited date, accounting for any time offset and handling the transition across days.
 *
 * @returns {Date} The current edited date.
 */
function getCurrentEditedDate() {
    let d = new Date();
    if(d.getHours() === 23 && d.getMinutes() === 59) {
        d.setDate(d.getDate() + 1); // 处理跨天
    }
    d.setSeconds(d.getSeconds() + timeOffset)
    return d;


}

/**
 * Retrieves the day of the week for the given date, taking into account any day offset.
 *
 * @param {Date} date - The date object.
 * @returns {number} The day of the week (0 = Sunday, 1 = Monday, ...).
 */
function getCurrentEditedDay(date) {
    if (dayOffset === -1) {
      return date.getDay();
    }
    if (setDayOffsetLastDay == new Date()
        .getDay()) {
        return dayOffset;
    }
    localStorage.setItem('dayOffset', '-1')
    localStorage.setItem('setDayOffsetLastDay', '-1')
    dayOffset = -1
    setDayOffsetLastDay = -1
    return date.getDay();
}

// Generated by ChatGPT4
/**
 * Checks if the current time falls within a specified break time range.
 *
 * @param {string} startTime - The start time of the break in the format "HH:MM".
 * @param {string} endTime - The end time of the break in the format "HH:MM".
 * @param {string} currentTime - The current time in the format "HH:MM".
 * @returns {boolean} True if the current time is within the break time range, false otherwise.
 */
function isBreakTime(startTime, endTime, currentTime) {
    const [startH, startM] = startTime.split(':')
        .map(Number);
    const [endH, endM] = endTime.split(':')
        .map(Number);
    const [currentH, currentM] = currentTime.split(':')
        .map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const currentMinutes = currentH * 60 + currentM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// Generated by ChatGPT4
/**
 * Retrieves the index of the next class in the timetable, starting from the current index.
 *
 * @param {Object} timetable - The timetable object.
 * @param {number} currentIndex - The current index in the timetable.
 * @returns {number|null} The index of the next class, or null if there is no next class.
 */
function getNextClassIndex(timetable, currentIndex) {
    // 从当前时间点的下一个时间段开始，找到下一个课程的索引
    const timeKeys = Object.keys(timetable);
    for (let i = currentIndex + 1; i < timeKeys.length; i++) {
        if (typeof timetable[timeKeys[i]] === 'number') {
            return timetable[timeKeys[i]];
        }
    }
    return null; // 如果没有下一堂课，返回 null
}

// Generated by ChatGPT4
/**
 * Retrieves the schedule for the current day, taking into account the current week number.
 *
 * @returns {string[]} The schedule for the current day.
 */
function getCurrentDaySchedule() {
    const date = getCurrentEditedDate();
    const dayOfWeek = getCurrentEditedDay(date); // 0 = Sunday, 1 = Monday, ...
    const weekNumber = weekIndex; // 当前周数
    const dailyClass = scheduleConfig.daily_class[dayOfWeek] || {classList: []};
    if (!dailyClass) {
      return [];
    }
    return dailyClass.classList.map(subject => {
        if (Array.isArray(subject)) {
            return subject[weekNumber]; // 处理每周不同的课程
        }
        return subject;
    });
}

// Generated by ChatGPT4
/**
 * Checks if the current time falls within a specified class time range.
 *
 * @param {string} startTime - The start time of the class in the format "HH:MM".
 * @param {string} endTime - The end time of the class in the format "HH:MM".
 * @param {string} currentTime - The current time in the format "HH:MM".
 * @returns {boolean} True if the current time is within the class time range, false otherwise.
 */
function isClassCurrent(startTime, endTime, currentTime) {
    const [startH, startM] = startTime.split(':')
        .map(Number);
    const [endH, endM] = endTime.split(':')
        .map(Number);
    const [currentH, currentM] = currentTime.split(':')
        .map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const currentMinutes = currentH * 60 + currentM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}


// Generated by ChatGPT4
/**
 * Retrieves the current time in the format "HH:MM:SS".
 *
 * @returns {string} The current time.
 */
function getCurrentTime() {
    const now = getCurrentEditedDate();
    return [
        now.getHours()
            .toString()
            .padStart(2, '0'),
        now.getMinutes()
            .toString()
            .padStart(2, '0'),
        now.getSeconds()
            .toString()
            .padStart(2, '0')
    ].join(':');
}

// Generated by ChatGPT4
/**
 * Retrieves the schedule data for the current day, including the schedule array, current highlight information,
 * timetable, and divider.
 *
 * @returns {Object} The schedule data object.
 * @property {string[]} scheduleArray - An array of subject short names representing the schedule.
 * @property {Object} currentHighlight - Information about the current highlighted class or break.
 * @property {number} currentHighlight.index - The index of the current highlighted class or break in the schedule array.
 * @property {string} currentHighlight.type - The type of the current highlighted item ('current' or 'upcoming').
 * @property {string} currentHighlight.fullName - The full name of the current highlighted class or break.
 * @property {number} currentHighlight.countdown - The countdown in seconds to the end of the current highlighted item.
 * @property {string} currentHighlight.countdownText - The formatted countdown string of the current highlighted item.
 * @property {string} timetable - The timetable identifier for the current day.
 * @property {string} divider - The divider identifier for the current day.
 */
function getScheduleData() {
    const currentSchedule = getCurrentDaySchedule();
    const currentTime = getCurrentTime();
    // let currentTime = '07:10:01';
    const dayOfWeek = getCurrentEditedDay(getCurrentEditedDate());

    const {timetable} = scheduleConfig.daily_class[dayOfWeek]
    const dayTimetable = scheduleConfig.timetable[timetable];
    const divider = scheduleConfig.divider[timetable];
    let scheduleArray = [];
    let currentHighlight = {
        index: null,
        type: null,
        fullName: null,
        countdown: null,
        countdownText: null
    };
    Object.keys(dayTimetable)
        .forEach((timeRange, index) => {
            const [startTime, endTime] = timeRange.split('-');
            const classIndex = dayTimetable[timeRange];

            if (typeof classIndex === 'number') {
                const subjectShortName = currentSchedule[classIndex];
                const subjectFullName = scheduleConfig.subject_name[subjectShortName];
                scheduleArray.push(subjectShortName);

                if (isClassCurrent(startTime, endTime, currentTime)) {
                    currentHighlight.index = scheduleArray.length - 1;
                    currentHighlight.type = 'current';
                    currentHighlight.fullName = subjectFullName;
                    currentHighlight.countdown = calculateCountdown(endTime, currentTime);
                    currentHighlight.countdownText = formatCountdown(currentHighlight.countdown);
                }
            } else if (currentHighlight.index === null && isBreakTime(startTime, endTime, currentTime)) {
                let highlighted = false;
                for (let i = index + 1; i < Object.keys(dayTimetable)
                    .length; i++) {
                    const nextTimeRange = Object.keys(dayTimetable)[i];
                    const nextClassIndex = dayTimetable[nextTimeRange];
                    if (typeof nextClassIndex === 'number') {
                        currentHighlight.index = scheduleArray.length;
                        currentHighlight.type = 'upcoming';
                        const nextSubjectShortName = currentSchedule[nextClassIndex];
                        const nextSubjectFullName = scheduleConfig.subject_name[nextSubjectShortName];
                        currentHighlight.fullName = dayTimetable[timeRange];
                        const [nextStartTime] = nextTimeRange.split('-');
                        currentHighlight.countdown = calculateCountdown(timeRange.split('-')[1], currentTime);
                        currentHighlight.countdownText = formatCountdown(currentHighlight.countdown);
                        highlighted = true;
                        break;
                    }
                }
                if (!highlighted) {
                    currentHighlight.index = currentSchedule.length - 1;
                    currentHighlight.type = 'upcoming';
                    currentHighlight.fullName = dayTimetable[timeRange];
                    currentHighlight.countdown = calculateCountdown(timeRange.split('-')[1], currentTime);
                    currentHighlight.countdownText = formatCountdown(currentHighlight.countdown);
                    currentHighlight.isEnd = true;
                }
            } else if (currentHighlight.index === null && !dayTimetable[timeRange]) {
                // 当前时间是非课程时间（如课间休息）
                currentHighlight.fullName = currentSchedule[classIndex]; // 使用时间表中的描述
            }
        });
    return {
        scheduleArray,
        currentHighlight,
        timetable,
        divider
    };
}


// Generated by ChatGPT4
/**
 * Calculates the countdown in seconds from the current time to a target time.
 *
 * @param {string} targetTime - The target time in the format "HH:MM".
 * @param {string} currentTime - The current time in the format "HH:MM:SS".
 * @returns {number} The countdown in seconds.
 */
function calculateCountdown(targetTime, currentTime) {
    const [targetH, targetM] = targetTime.split(':')
        .map(Number);
    const [currentH, currentM, currentS = '00'] = currentTime.split(':')
        .map(Number);

    const targetTotalSeconds = targetH * 3600 + (targetM + 1) * 60;
    const currentTotalSeconds = currentH * 3600 + currentM * 60 + currentS;

    return targetTotalSeconds - currentTotalSeconds;
}



// Generated by ChatGPT4
/**
 * Formats the countdown in seconds into a string representation of "MM:SS".
 *
 * @param {number} countdownSeconds - The countdown in seconds.
 * @returns {string} The formatted countdown string.
 */
function formatCountdown(countdownSeconds) {
    const minutes = Math.floor(countdownSeconds / 60);
    const seconds = countdownSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
