"use strict";
exports.__esModule = true;
var fs = require("fs");
var config = require("./config.json");
//TODO: add status and stats functions
//TODO: handle manual clock times better (what if manual time is after current time?; how to place in a shift that isn't the most recent)
/////// - FUNCTIONS CALLED BY TERMINAL - ///////
/**
 * clockInTime should be in ms as string
 */
module.exports.clockIn = function (clockInTime) {
    var _a = getNeededInfoForClocking(clockInTime, true), timeComponents = _a.timeComponents, currentMonthLog = _a.currentMonthLog, callLogs = _a.callLogs;
    if (!!currentMonthLog[timeComponents.date]) {
        currentMonthLog[timeComponents.date].push([timeComponents.ms, null]);
    }
    else {
        currentMonthLog[timeComponents.date] = [[timeComponents.ms, null]];
    }
    //write to log file when calculations are finished, but wait to write console.logs (hence use of sync)
    writeMonthLog(timeComponents.calendarMonth, timeComponents.year, currentMonthLog);
    callLogs();
};
module.exports.clockOut = function (clockOutTime) {
    var _a = getNeededInfoForClocking(clockOutTime, false), timeComponents = _a.timeComponents, currentMonthLog = _a.currentMonthLog, callLogs = _a.callLogs;
    //can't abstract into variables since we're writing directly to object here
    var dateShiftArray = currentMonthLog[timeComponents.date];
    if (!!dateShiftArray) {
        //make sure latest shift doesn't already have a clock-out
        if (!dateShiftArray[dateShiftArray.length - 1][1]) {
            dateShiftArray[dateShiftArray.length - 1][1] = timeComponents.ms;
        }
        else {
            dateShiftArray.push([null, timeComponents.ms]);
        }
    }
    else {
        //if no clock-in today, make sure this isn't an extension of yesterday's shift
        var yesterdayShiftArray = currentMonthLog[timeComponents.date - 1];
        if (!!yesterdayShiftArray) {
            //check for a clock-out of yesterday's last shift, if none, assume this shift extends yesterday's unless time seems too long
            if (yesterdayShiftArray[yesterdayShiftArray.length - 1][1] === null) {
                var hoursSinceYesterdayClockIn = (timeComponents.ms - yesterdayShiftArray[yesterdayShiftArray.length - 1][0]) / 3600000;
                if (hoursSinceYesterdayClockIn > 8) {
                    currentMonthLog[timeComponents.date] = [[null, timeComponents.ms]];
                    console.log("No corresponding clock-in today, last clock-in over 8 hours ago. Most likely a clock-out AND clock-in was missed. This clock-out will be written to a new shift. Use clock-in with ms time as parameter and clock-out with ms time as parameter to correct(set both clock-in and clock-out to midnight between current shifts if this is supposed to be one long shift).");
                }
                else {
                    currentMonthLog[timeComponents.date - 1][currentMonthLog[timeComponents.date - 1].length - 1][1] = timeComponents.ms;
                }
            }
            else {
                //indicates shifts exist for yesterday, but last one already has a clockout
                currentMonthLog[timeComponents.date] = [[null, timeComponents.ms]];
                console.log("Warning! No corresponding clock-in found, use clock-in with ms time as parameter to add missed clock-in");
            }
        }
        else {
            //if no clock-in today and no shifts yesterday at all, assume missed clock-in, log this clock-out, give warning to manually fix
            currentMonthLog[timeComponents.date] = [[null, timeComponents.ms]];
            console.log("Warning! No corresponding clock-in found, use clock-in with ms time as parameter to add missed clock-in");
        }
    }
    //write to log file when calculations are finished, but wait to write console.logs (hence use of sync)
    writeMonthLog(timeComponents.calendarMonth, timeComponents.year, currentMonthLog);
    callLogs();
};
module.exports.getStatus = function () {
    //TODO: get month logs
    // const allShiftsArray = getAllShiftsForCurrentAndLastMonth(currentMonthLog, pastMonthLog)
    //TODO: everything else (remember allshiftsarray can have length of 0)
};
/////// - FORMATTING FUNCS - ///////
/**
 * Single source of truth for file format and path
 * @param actualMonth calendar number for month e.g. 12 for December, not Date object number for month e.g. 11 for December
 * @param year
 * @returns proper file format
 */
var monthFileFormatAndPath = function (month, year) {
    var monthToUse = month;
    if (month <= 0) {
        monthToUse = (12 - month);
    }
    return "".concat(config.rootPath, "/logs/Log-").concat(monthToUse, "_").concat(year);
};
var getHoursAndMinutesFromDecimalHours = function (hoursDecimal) {
    //hours should never be negative, so this shouldn't cause any issues
    var hours = Math.floor(hoursDecimal);
    //always rounds up, acceptable for the intended use of this program
    var minutes = Math.ceil((hoursDecimal - hours) * 60);
    return "".concat(hours, ":").concat(minutes);
};
/////// - FILE OPERATIONS - ////////
/**
 * Reads file to retrieve full log for month indicated
 * @param month Date object month e.g. 11 for December
 * @param year
 * @returns JSON object of current month log
 */
var getMonthLogSafe = function (month, year) {
    var filePath = monthFileFormatAndPath(month, year);
    var fileExists = fs.existsSync(filePath);
    if (fileExists) {
        return JSON.parse(fs.readFileSync(filePath, { encoding: "utf-8" }));
    }
    else {
        return JSON.parse("{}");
    }
};
var checkForMonthLog = function (month, year) {
    return fs.existsSync(monthFileFormatAndPath(month, year));
};
var writeMonthLog = function (month, year, data) {
    fs.writeFileSync(monthFileFormatAndPath(month, year), JSON.stringify(data), { encoding: "utf-8" });
};
/////// - GETTING INFO FROM INPUT INFORMATION - ///////
var getNeededInfoForClocking = function (clockTime, clockIn) {
    var validManualTime = true;
    //terminal may hand in an array shorter than 5, so need to hardcode expected length as shorter arrays are not valid
    //TODO: handle falsy values at different indeces differently
    for (var i = 0; i < 5; i++) {
        if (!!!clockTime[i]) {
            validManualTime = false;
            break;
        }
    }
    var timeToUse;
    if (!validManualTime) {
        timeToUse = new Date();
    }
    else {
        var numberClockTime = [];
        for (var i = 0; i < clockTime.length; i++) {
            numberClockTime.push(parseInt(clockTime[i]));
        }
        //time is entered with number for calendar month for user-friendliness, but this has to be changed to get the right date object
        timeToUse = new Date(numberClockTime[0], numberClockTime[1] - 1, numberClockTime[2], numberClockTime[3], numberClockTime[4]);
    }
    var timeComponents = getTimeComponents(timeToUse);
    //months start at 0 in date object - see getMonthLog definition
    var currentMonthLogExists = checkForMonthLog(timeComponents.calendarMonth, timeComponents.year);
    var currentMonthLog = currentMonthLogExists ? getMonthLogSafe(timeComponents.calendarMonth, timeComponents.year) : {};
    //ensure previous year is used if it's currently January
    var pastMonthLogYear = timeComponents.calendarMonth === 1 ? timeComponents.year - 1 : timeComponents.year;
    var pastMonthLogExists = checkForMonthLog(timeComponents.calendarMonth - 1, pastMonthLogYear);
    var pastMonthLog = pastMonthLogExists ? getMonthLogSafe(timeComponents.calendarMonth - 1, pastMonthLogYear) : undefined;
    var recentShifts = getMostRecentShiftsInfo(currentMonthLog, pastMonthLog);
    //shifts only exist after a successful clock-in is written, so lastShift[0] should never have a falsy value
    console.assert(recentShifts ? !!recentShifts.lastShift[0] : true, "Last clock-in null or undefined, manually edit logs to correct");
    var lastClockOut = determineLastClockOut(recentShifts, clockIn);
    var lastClockIn = determineLastClockIn(recentShifts, clockIn);
    var lastClockOutString = recentShifts ? (lastClockOut ? "Last clock-out: ".concat(new Date(lastClockOut).toLocaleString()) : "Missed clock-out! Use clock-out with ms time as parameter to fix") : "No previous shifts found for current and previous months";
    var lastClockInString = recentShifts ? (lastClockIn ? "Last clock-in: ".concat(new Date(lastClockIn).toLocaleString()) : "Missing clock-in! Use clock-in with ms time as parameter to fix") : "No previous shifts found for current and previous months";
    var hoursAndShiftsToday = getHoursAndShiftsWorkedForDay(timeToUse, clockIn ? "clockIn" : "clockOut", !clockIn); //parent function only called on clocking in or out, not status or stat checks
    var hoursThisWeek = getHoursForWeekContainingDate();
    var hoursLastWeek = getHoursForWeekContainingDate(new Date(timeComponents.year, timeComponents.calendarMonth - 1, timeComponents.date - 7));
    var _a = getFourAndEightWeekAverageHours(), fourWeekAverage = _a.fourWeekAverage, eightWeekAverage = _a.eightWeekAverage;
    var _b = getFourAndEightWeekAverageDays(), fourWeekAverageDays = _b.fourWeekAverageDays, eightWeekAverageDays = _b.eightWeekAverageDays;
    var callLogs = function () {
        console.log("Successfully clocked ".concat(clockIn ? "in" : "out", " at ").concat(timeComponents.timeString));
        if (recentShifts) {
            console.log(lastClockInString);
            console.log(lastClockOutString);
        }
        console.log("Worked ".concat(getHoursAndMinutesFromDecimalHours(hoursAndShiftsToday.totalHours), " hours today in ").concat(hoursAndShiftsToday.totalShifts, " shifts"));
        console.log("Hours this week: ".concat(getHoursAndMinutesFromDecimalHours(hoursThisWeek)));
        console.log("Hours last week: ".concat(getHoursAndMinutesFromDecimalHours(hoursLastWeek)));
        console.log("4 week average hours: ".concat(getHoursAndMinutesFromDecimalHours(fourWeekAverage), "; days: ").concat(fourWeekAverageDays));
        console.log("8 week average hours: ".concat(getHoursAndMinutesFromDecimalHours(eightWeekAverage), "; days; ").concat(eightWeekAverageDays));
    };
    return {
        timeComponents: timeComponents,
        currentMonthLog: currentMonthLog,
        pastMonthLog: pastMonthLog,
        callLogs: callLogs
    };
};
var determineLastClockIn = function (recentShifts, clockIn) {
    if (clockIn) {
        return recentShifts === null || recentShifts === void 0 ? void 0 : recentShifts.secondLastShift[0];
    }
    else {
        return recentShifts === null || recentShifts === void 0 ? void 0 : recentShifts.lastShift[0];
    }
};
var determineLastClockOut = function (recentShifts, clockIn) {
    if (clockIn) {
        return recentShifts === null || recentShifts === void 0 ? void 0 : recentShifts.lastShift[1];
    }
    else {
        return recentShifts === null || recentShifts === void 0 ? void 0 : recentShifts.secondLastShift[1];
    }
};
var getAllShiftsForCurrentAndLastMonth = function (currentMonthLog, pastMonthLog) {
    var allShiftsArray = [];
    if (pastMonthLog) {
        Object.values(pastMonthLog).forEach(function (shiftArray) {
            shiftArray.forEach(function (shift) {
                allShiftsArray.push(shift);
            });
        });
    }
    if (currentMonthLog) {
        Object.values(currentMonthLog).forEach(function (shiftArray) {
            shiftArray.forEach(function (shift) {
                allShiftsArray.push(shift);
            });
        });
    }
    return allShiftsArray;
};
var getMostRecentShiftsInfo = function (currentMonthLog, pastMonthLog) {
    var allShiftsArray = getAllShiftsForCurrentAndLastMonth(currentMonthLog, pastMonthLog);
    if (!allShiftsArray.length) {
        return undefined;
    }
    var lastShift = allShiftsArray[allShiftsArray.length - 1];
    var secondLastShift = allShiftsArray.length > 1 ? allShiftsArray[allShiftsArray.length - 2] : undefined;
    return { lastShift: lastShift, secondLastShift: secondLastShift };
};
var getHoursAndShiftsWorkedForDay = function (clockTime, typeOfCheck, clockedIn) {
    var clockTimeComponents = getTimeComponents(clockTime);
    var currentMonthLog = getMonthLogSafe(clockTimeComponents.calendarMonth, clockTimeComponents.year);
    var todayShifts = currentMonthLog[clockTimeComponents.date] || [];
    var totalHours = todayShifts.reduce(function (cumHours, shift, shiftIndex, shiftArray) {
        //check for scenarios where the most recent shift shouldn't have a clock-out, then add a value when last shift is reached
        if (clockedIn && (shiftIndex === shiftArray.length - 1)) {
            var timeToUse = void 0;
            if (typeOfCheck === "clockOut") {
                timeToUse = clockTime.getTime();
            }
            else if (typeOfCheck === "check") {
                timeToUse = clockTimeComponents.ms;
            }
            return cumHours + ((timeToUse - shift[0]) / 3600000);
        }
        else {
            //if any shift but last has a missing clock, don't add any time. A log should already have been thrown for the missed clocks.
            if (!shift[0] || !shift[1]) {
                return cumHours;
            }
            return cumHours + ((shift[1] - shift[0]) / 3600000);
        }
    }, 0);
    var totalShifts = todayShifts.length;
    return { totalHours: totalHours, totalShifts: totalShifts };
};
/**
 *
 * @param passedDate if checking for week containing current day, pass in nothing
 * @returns
 */
var getHoursForWeekContainingDate = function (passedDate) {
    var _a = determineDatesToGetForAWeek(passedDate), datesToGet = _a.datesToGet, monthLogs = _a.monthLogs, dateComponents = _a.dateComponents;
    var hoursForWeek = datesToGet.reduce(function (cumHours, dateTuple) {
        var month = dateTuple[0];
        var date = dateTuple[1];
        var shiftArrayForDate = monthLogs[month][date];
        var hoursForDate;
        if (!shiftArrayForDate) {
            hoursForDate = 0;
        }
        else {
            hoursForDate = shiftArrayForDate.reduce(function (cumHours, shift) {
                if (shift[1]) {
                    return cumHours + ((shift[1] - shift[0]) / 3600000);
                }
                else {
                    if (!passedDate) {
                        //indicates most likely currently clocked in - use current time
                        return cumHours + ((dateComponents.ms - shift[0]) / 3600000);
                    }
                    else {
                        //indicates most likely missed clock - shift not included until fixed
                        return cumHours;
                    }
                }
            }, 0);
        }
        return cumHours + hoursForDate;
    }, 0);
    return hoursForWeek;
};
var getDaysForWeekContainingDate = function (passedDate) {
    var _a = determineDatesToGetForAWeek(passedDate), datesToGet = _a.datesToGet, monthLogs = _a.monthLogs;
    var daysInWeekWithShifts = datesToGet.reduce(function (cumDays, dateTuple) {
        var month = dateTuple[0];
        var date = dateTuple[1];
        var dateHasShifts = !!monthLogs[month][date];
        return cumDays + (dateHasShifts ? 1 : 0);
    }, 0);
    return daysInWeekWithShifts;
};
var determineDatesToGetForAWeek = function (passedDate) {
    var dateToUse = passedDate || new Date();
    var dateComponents = getTimeComponents(dateToUse);
    var monthsToGet = [];
    // [month, date]
    var datesToGet = [];
    var _loop_1 = function (i) {
        var date = new Date(dateComponents.year, dateComponents.calendarMonth - 1, dateComponents.date + i);
        //if week spans 2 months, need to grab previous month as well
        if (!monthsToGet.some(function (month) { return month === date.getMonth() + 1; })) {
            monthsToGet.push(date.getMonth() + 1);
        }
        //the same date will never appear in one week
        datesToGet.push([date.getMonth() + 1, date.getDate()]);
    };
    //day starts at 0 for Sunday; this will start the for loop at this week's Sunday and go until "today"
    for (var i = dateComponents.day * -1; i < (7 - dateComponents.day); i++) {
        _loop_1(i);
    }
    var monthLogs = {};
    monthsToGet.forEach(function (month) {
        monthLogs[month] = getMonthLogSafe(month, dateComponents.year);
    });
    return { datesToGet: datesToGet, monthLogs: monthLogs, dateComponents: dateComponents };
};
var getFourAndEightWeekAverageHours = function () {
    var today = new Date();
    var todayComponents = getTimeComponents(today);
    var totalHours = 0;
    for (var i = 7; i <= 28; i = i + 7) {
        var weekHours = getHoursForWeekContainingDate(new Date(todayComponents.year, todayComponents.calendarMonth - 1, todayComponents.date - i));
        totalHours = totalHours + weekHours;
    }
    var fourWeekAverage = totalHours / 4;
    for (var i = 35; i <= 56; i = i + 7) {
        var weekHours = getHoursForWeekContainingDate(new Date(todayComponents.year, todayComponents.calendarMonth - 1, todayComponents.date - i));
        totalHours = totalHours + weekHours;
    }
    var eightWeekAverage = totalHours / 8;
    return { fourWeekAverage: fourWeekAverage, eightWeekAverage: eightWeekAverage };
};
var getFourAndEightWeekAverageDays = function () {
    var today = new Date();
    var todayComponents = getTimeComponents(today);
    var totalDays = 0;
    for (var i = 7; i <= 28; i = i + 7) {
        var weekDays = getDaysForWeekContainingDate(new Date(todayComponents.year, todayComponents.calendarMonth - 1, todayComponents.date - i));
        totalDays = totalDays + weekDays;
    }
    var fourWeekAverageDays = totalDays / 4;
    for (var i = 35; i <= 56; i = i + 7) {
        var weekDays = getDaysForWeekContainingDate(new Date(todayComponents.year, todayComponents.calendarMonth - 1, todayComponents.date - i));
        totalDays = totalDays + weekDays;
    }
    var eightWeekAverageDays = totalDays / 8;
    return { fourWeekAverageDays: fourWeekAverageDays, eightWeekAverageDays: eightWeekAverageDays };
};
var getTimeComponents = function (dateObject) {
    return {
        year: dateObject.getFullYear(),
        calendarMonth: dateObject.getMonth() + 1,
        date: dateObject.getDate(),
        day: dateObject.getDay(),
        timeString: dateObject.toLocaleString(),
        ms: dateObject.getTime()
    };
};
