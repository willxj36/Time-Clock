"use strict";
exports.__esModule = true;
var fs = require("fs");
var config = require("./config.json");
//TODO: add status and stats functions
//TODO: handle manual clock times better (what if manual time is after current time?; how to place in a shift that isn't the most recent)
//TODO: handle shifts that stretch over midnight for the logging
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
    try {
        //write to log file when calculations are finished, but wait to write console.logs (hence use of sync)
        writeMonthLog(timeComponents.calendarMonth, timeComponents.year, currentMonthLog);
        callLogs();
    }
    catch (error) {
        console.error(error);
    }
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
    var currentDateObject = new Date();
    var timeComponents = getTimeComponents(currentDateObject);
    var currentMonthLog = getMonthLogSafe(timeComponents.calendarMonth, timeComponents.year);
    var pastMonthLog = getPreviousMonthLogSafe(timeComponents);
    var allShiftsArray = getAllShiftsForCurrentAndLastMonth(currentMonthLog, pastMonthLog);
    var mostRecentShift = allShiftsArray[allShiftsArray.length - 1] || null;
    if (!mostRecentShift) {
        console.log("No shifts found in logs");
    }
    else {
        var invalidShifts = getInvalidShifts(allShiftsArray);
        var clockedIn = void 0;
        if (mostRecentShift[0] && !mostRecentShift[1]) {
            clockedIn = true;
            console.log("Currently clocked in since ".concat(new Date(mostRecentShift[0]).toLocaleString()));
        }
        else {
            clockedIn = false;
            console.log("Currently clocked out since ".concat(new Date(mostRecentShift[1]).toLocaleString()));
        }
        logDivider();
        var _a = getHoursAndShiftsWorkedForDay(currentDateObject, clockedIn), totalHours = _a.totalHours, totalShifts = _a.totalShifts;
        console.log("Today's hours: ".concat(getHoursAndMinutesFromDecimalHours(totalHours)));
        console.log("Today's shifts: ".concat(totalShifts));
        logDivider();
        console.log("".concat(invalidShifts.length || "No", " invalid shift").concat(invalidShifts.length !== 1 ? "s" : "", " in current month and last month logs"));
        if (invalidShifts.length) {
            console.log("Invalid shifts:");
            invalidShifts.forEach(function (shift) {
                var startTimeComponents = !!shift[0] ? getTimeComponents(new Date(shift[0])) : null;
                var endTimeComponents = !!shift[1] ? getTimeComponents(new Date(shift[1])) : null;
                console.log("IN: ".concat(startTimeComponents ? startTimeComponents.timeString : "MISSING", "     |     OUT: ").concat(endTimeComponents ? endTimeComponents.timeString : "MISSING"));
            });
        }
    }
    /**
     * clocked in?
     * hours worked today
     * hours worked this week
     * shifts today
     */
};
/////// - FORMATTING FUNCS - ///////
/**
 * Single source of truth for file format and path
 * @param calendarMonth calendar number for month e.g. 12 for December, not Date object number for month e.g. 11 for December
 * @param year
 * @returns proper file format
 */
var monthFileFormatAndPath = function (calendarMonth, year) {
    var monthToUse = calendarMonth;
    var yearToUse = year;
    if (calendarMonth <= 0) {
        monthToUse = (12 - calendarMonth);
        yearToUse = year - 1;
    }
    return "".concat(config.rootPath, "/logs/Log-").concat(monthToUse, "_").concat(yearToUse);
};
var getHoursAndMinutesFromDecimalHours = function (hoursDecimal) {
    //hours should never be negative, so this shouldn't cause any issues
    var hours = Math.floor(hoursDecimal);
    //always rounds up, acceptable for the intended use of this program
    var minutes = Math.ceil((hoursDecimal - hours) * 60);
    return "".concat(hours, "h").concat(minutes, "m");
};
var logDivider = function () {
    return console.log("- - - - - - - - - - - -");
};
/////// - FILE OPERATIONS - ////////
/**
 * Reads file to retrieve full log for month indicated
 * @param calendarMonth calendar month number
 * @param year
 * @returns JSON object of current month log
 */
var getMonthLogSafe = function (calendarMonth, year) {
    var filePath = monthFileFormatAndPath(calendarMonth, year);
    var fileExists = fs.existsSync(filePath);
    if (fileExists) {
        return JSON.parse(fs.readFileSync(filePath, { encoding: "utf-8" }));
    }
    else {
        return JSON.parse("{}");
    }
};
/**
 * Used to get previous month specifically, as it will use time components to determine if prior year needs to be used, and return undefined if there is no log instead of an empty object
 * @param timeComponents
 */
var getPreviousMonthLogSafe = function (timeComponents) {
    var yearForPreviousMonth = timeComponents.calendarMonth === 1 ? timeComponents.year - 1 : timeComponents.year;
    var filePath = monthFileFormatAndPath(timeComponents.calendarMonth - 1, yearForPreviousMonth);
    var fileExists = fs.existsSync(filePath);
    if (fileExists) {
        return JSON.parse(fs.readFileSync(filePath, { encoding: "utf-8" }));
    }
    else {
        return undefined;
    }
};
var writeMonthLog = function (month, year, data) {
    fs.writeFileSync(monthFileFormatAndPath(month, year), JSON.stringify(data), { encoding: "utf-8" });
};
/////// - GETTING INFO FROM INPUT INFORMATION - ///////
var getNeededInfoForClocking = function (clockTime, clockIn) {
    var validManualTime = true;
    //terminal may hand in an array shorter than 5, so need to hardcode expected length as shorter arrays are not valid
    for (var i = 0; i < 5; i++) {
        if (clockTime[i] == undefined) {
            validManualTime = false;
            if (i > 0) {
                throw new Error("Received ".concat(i, " arguments, 5 arguments are required (yr, mo, date, hr, min) for manual time, or no arguments for current system time. Please try again."));
            }
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
        if (timeToUse > new Date()) {
            throw new Error("Future clock times not allowed");
        }
    }
    var timeComponents = getTimeComponents(timeToUse);
    var currentMonthLog = getMonthLogSafe(timeComponents.calendarMonth, timeComponents.year);
    var pastMonthLog = getPreviousMonthLogSafe(timeComponents);
    var recentShifts = getMostRecentShiftsInfo(currentMonthLog, pastMonthLog);
    //shifts only exist after a successful clock-in is written, so lastShift[0] should never have a falsy value
    console.assert(recentShifts ? !!recentShifts.lastShift[0] : true, "Last clock-in null or undefined, manually edit logs to correct");
    var lastClockOut = determineLastClockOut(recentShifts, clockIn);
    var lastClockIn = determineLastClockIn(recentShifts);
    var lastClockOutString = recentShifts ? (lastClockOut ? "Last clock-out: ".concat(new Date(lastClockOut).toLocaleString()) : "Missed clock-out! Use clock-out with ms time as parameter to fix") : "No previous shifts found for current and previous months";
    var lastClockInString = recentShifts ? (lastClockIn ? "Last clock-in: ".concat(new Date(lastClockIn).toLocaleString()) : "Missing clock-in! Use clock-in with ms time as parameter to fix") : "No previous shifts found for current and previous months";
    var hoursAndShiftsToday = getHoursAndShiftsWorkedForDay(timeToUse, !clockIn); //parent function only called on clocking in or out, not status or stat checks
    var hoursThisWeek = getHoursForWeekContainingDate();
    var hoursLastWeek = getHoursForWeekContainingDate(new Date(timeComponents.year, timeComponents.calendarMonth - 1, timeComponents.date - 7));
    var _a = getFourAndEightWeekAverageHours(), fourWeekAverage = _a.fourWeekAverage, eightWeekAverage = _a.eightWeekAverage;
    var _b = getFourAndEightWeekAverageDays(), fourWeekAverageDays = _b.fourWeekAverageDays, eightWeekAverageDays = _b.eightWeekAverageDays;
    var callLogs = function () {
        console.log("Successfully clocked ".concat(clockIn ? "in" : "out", " at ").concat(timeComponents.timeString));
        logDivider();
        if (recentShifts) {
            console.log(lastClockInString);
            console.log(lastClockOutString);
            logDivider();
        }
        console.log("Hours today: ".concat(getHoursAndMinutesFromDecimalHours(hoursAndShiftsToday.totalHours)));
        console.log("Shifts today: ".concat(hoursAndShiftsToday.totalShifts));
        console.log("Hours this week: ".concat(getHoursAndMinutesFromDecimalHours(hoursThisWeek)));
        console.log("Hours last week: ".concat(getHoursAndMinutesFromDecimalHours(hoursLastWeek)));
        logDivider();
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
var determineLastClockIn = function (recentShifts) {
    // new clock is not saved until after this function is called, so this will always be the clock-in time of the most recent saved shift
    return recentShifts === null || recentShifts === void 0 ? void 0 : recentShifts.lastShift[0];
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
var getHoursAndShiftsWorkedForDay = function (clockTime, clockedIn) {
    var clockTimeComponents = getTimeComponents(clockTime);
    var currentMonthLog = getMonthLogSafe(clockTimeComponents.calendarMonth, clockTimeComponents.year);
    var todayShifts = currentMonthLog[clockTimeComponents.date] || [];
    var totalHours = todayShifts.reduce(function (cumHours, shift, shiftIndex, shiftArray) {
        //check for scenarios where the most recent shift shouldn't have a clock-out, then add a value when last shift is reached
        if (clockedIn && (shiftIndex === shiftArray.length - 1)) {
            var timeToUse = clockTimeComponents.ms;
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
/**
 * Used to filter shifts to get an array of shifts with missed clock-in/clock-out
 * @param allShifts array of allShifts from current and previous month logs
 * @returns filtered array of same type with only invalid shifts
 */
var getInvalidShifts = function (allShifts) {
    var invalidShifts = allShifts.filter(function (shift, index) {
        if (index !== allShifts.length - 1) {
            // if not at last index, any null value means missed clock/invalid shift
            return !shift[0] || !shift[1];
        }
        else {
            // if at last index, null value for clock-in means missed clock/invalid shift
            return !shift[0];
        }
    });
    return invalidShifts;
};
