const fs = require("fs")
import * as Interfaces from "./interfaces"
const config = require("./config.json")

//TODO: add status and stats functions
//TODO: handle manual clock times better (what if manual time is after current time?; how to place in a shift that isn't the most recent)

/////// - FUNCTIONS CALLED BY TERMINAL - ///////

/**
 * clockInTime should be in ms as string
 */
module.exports.clockIn = function (clockInTime: Interfaces.ManualTime) {
	const { timeComponents, currentMonthLog, callLogs } = getNeededInfoForClocking(clockInTime, true)

	if(!!currentMonthLog[timeComponents.date]) {
		currentMonthLog[timeComponents.date].push([ timeComponents.ms, null ])
	} else {
		currentMonthLog[timeComponents.date] = [ [ timeComponents.ms, null ] ]
	}
	//write to log file when calculations are finished, but wait to write console.logs (hence use of sync)
	writeMonthLog(timeComponents.calendarMonth, timeComponents.year, currentMonthLog)

	callLogs()
}

module.exports.clockOut = function (clockOutTime: Interfaces.ManualTime) {
	const { timeComponents, currentMonthLog, callLogs } = getNeededInfoForClocking(clockOutTime, false)

	//can't abstract into variables since we're writing directly to object here
	const dateShiftArray = currentMonthLog[timeComponents.date]
	if(!!dateShiftArray) {
		//make sure latest shift doesn't already have a clock-out
		if(!dateShiftArray[dateShiftArray.length - 1][1]) {
			dateShiftArray[dateShiftArray.length - 1][1] = timeComponents.ms
		} else {
			dateShiftArray.push([ null, timeComponents.ms ])
		}
	} else {
		//if no clock-in today, make sure this isn't an extension of yesterday's shift
		const yesterdayShiftArray = currentMonthLog[timeComponents.date - 1]
		if(!!yesterdayShiftArray) {
			//check for a clock-out of yesterday's last shift, if none, assume this shift extends yesterday's unless time seems too long
			if(yesterdayShiftArray[yesterdayShiftArray.length - 1][1] === null) {
				const hoursSinceYesterdayClockIn = (timeComponents.ms - yesterdayShiftArray[yesterdayShiftArray.length - 1][0])/3600000
				if(hoursSinceYesterdayClockIn > 8) {
					currentMonthLog[timeComponents.date] = [ [ null, timeComponents.ms ] ]
					console.log("No corresponding clock-in today, last clock-in over 8 hours ago. Most likely a clock-out AND clock-in was missed. This clock-out will be written to a new shift. Use clock-in with ms time as parameter and clock-out with ms time as parameter to correct(set both clock-in and clock-out to midnight between current shifts if this is supposed to be one long shift).")
				} else {
					currentMonthLog[timeComponents.date - 1][currentMonthLog[timeComponents.date - 1].length - 1][1] = timeComponents.ms
				}
			} else {
				//indicates shifts exist for yesterday, but last one already has a clockout
				currentMonthLog[timeComponents.date] = [ [ null, timeComponents.ms ] ]
				console.log("Warning! No corresponding clock-in found, use clock-in with ms time as parameter to add missed clock-in")
			}
		} else {
			//if no clock-in today and no shifts yesterday at all, assume missed clock-in, log this clock-out, give warning to manually fix
			currentMonthLog[timeComponents.date] = [ [ null, timeComponents.ms ] ]
			console.log("Warning! No corresponding clock-in found, use clock-in with ms time as parameter to add missed clock-in")
		}
	}
	//write to log file when calculations are finished, but wait to write console.logs (hence use of sync)
	writeMonthLog(timeComponents.calendarMonth, timeComponents.year, currentMonthLog)

	callLogs()
}

module.exports.getStatus = function() {
	//TODO: get month logs

	// const allShiftsArray = getAllShiftsForCurrentAndLastMonth(currentMonthLog, pastMonthLog)

	//TODO: everything else (remember allshiftsarray can have length of 0)
}

/////// - FORMATTING FUNCS - ///////

/**
 * Single source of truth for file format and path
 * @param actualMonth calendar number for month e.g. 12 for December, not Date object number for month e.g. 11 for December
 * @param year 
 * @returns proper file format
 */
const monthFileFormatAndPath = (month: number, year: number) => {
	let monthToUse = month
	if(month <= 0) {
		monthToUse = (12 - month)
	}
	return `${config.rootPath}/logs/Log-${monthToUse}_${year}`
}

const getHoursAndMinutesFromDecimalHours = (hoursDecimal: number) => {
	//hours should never be negative, so this shouldn't cause any issues
	const hours = Math.floor(hoursDecimal)
	//always rounds up, acceptable for the intended use of this program
	const minutes = Math.ceil((hoursDecimal - hours) * 60)
	
	return `${hours}h${minutes}m`
}

/////// - FILE OPERATIONS - ////////

/**
 * Reads file to retrieve full log for month indicated
 * @param month Date object month e.g. 11 for December
 * @param year 
 * @returns JSON object of current month log
 */
const getMonthLogSafe = (month: number, year: number) => {
	const filePath = monthFileFormatAndPath(month, year)
	const fileExists = fs.existsSync(filePath)
	if(fileExists) {
		return JSON.parse(fs.readFileSync(filePath, {encoding: "utf-8"}))
	} else {
		return JSON.parse("{}")
	}
}

const checkForMonthLog = (month: number, year: number) => {
	return fs.existsSync(monthFileFormatAndPath(month, year))
}

const writeMonthLog = (month: number, year: number, data: Interfaces.MonthLog) => {
	fs.writeFileSync(monthFileFormatAndPath(month, year), JSON.stringify(data), {encoding: "utf-8"})
}

/////// - GETTING INFO FROM INPUT INFORMATION - ///////

const getNeededInfoForClocking = (clockTime: Interfaces.ManualTime, clockIn: boolean) => {
	let validManualTime = true
	//terminal may hand in an array shorter than 5, so need to hardcode expected length as shorter arrays are not valid
	//TODO: handle falsy values at different indeces differently
	for(let i = 0 ; i < 5 ; i++) {
		if(clockTime[i] == undefined) {
			validManualTime = false
			break
		}
	}
	let timeToUse: Date
	if(!validManualTime) {
		timeToUse = new Date()
	} else {
		const numberClockTime = []
		for(let i = 0 ; i < clockTime.length ; i++) {
			numberClockTime.push(parseInt(clockTime[i]))
		}
		//time is entered with number for calendar month for user-friendliness, but this has to be changed to get the right date object
		timeToUse = new Date(numberClockTime[0], numberClockTime[1] - 1, numberClockTime[2], numberClockTime[3], numberClockTime[4])
	}
	const timeComponents = getTimeComponents(timeToUse)

	//months start at 0 in date object - see getMonthLog definition
	const currentMonthLogExists: boolean = checkForMonthLog(timeComponents.calendarMonth, timeComponents.year)
	const currentMonthLog: Interfaces.MonthLog = currentMonthLogExists ? getMonthLogSafe(timeComponents.calendarMonth, timeComponents.year) : {}
	//ensure previous year is used if it's currently January
	const pastMonthLogYear = timeComponents.calendarMonth === 1 ? timeComponents.year - 1 : timeComponents.year
	const pastMonthLogExists: boolean = checkForMonthLog(timeComponents.calendarMonth - 1, pastMonthLogYear)
	const pastMonthLog = pastMonthLogExists ? getMonthLogSafe(timeComponents.calendarMonth - 1, pastMonthLogYear) : undefined
	const recentShifts: Interfaces.RecentShifts = getMostRecentShiftsInfo(currentMonthLog, pastMonthLog)
	//shifts only exist after a successful clock-in is written, so lastShift[0] should never have a falsy value
	console.assert(recentShifts ? !!recentShifts.lastShift[0] : true, "Last clock-in null or undefined, manually edit logs to correct")
	const lastClockOut = determineLastClockOut(recentShifts, clockIn)
	const lastClockIn = determineLastClockIn(recentShifts)
	const lastClockOutString = recentShifts ? (lastClockOut ? `Last clock-out: ${new Date(lastClockOut).toLocaleString()}` : "Missed clock-out! Use clock-out with ms time as parameter to fix") : "No previous shifts found for current and previous months"
	const lastClockInString = recentShifts ? (lastClockIn ? `Last clock-in: ${new Date(lastClockIn).toLocaleString()}` : "Missing clock-in! Use clock-in with ms time as parameter to fix") : "No previous shifts found for current and previous months"
	const hoursAndShiftsToday: Interfaces.HoursAndShifts = getHoursAndShiftsWorkedForDay(timeToUse, clockIn ? "clockIn" : "clockOut", !clockIn) //parent function only called on clocking in or out, not status or stat checks
	const hoursThisWeek: number = getHoursForWeekContainingDate()
	const hoursLastWeek: number = getHoursForWeekContainingDate(new Date(timeComponents.year, timeComponents.calendarMonth - 1, timeComponents.date - 7))
	const { fourWeekAverage, eightWeekAverage } = getFourAndEightWeekAverageHours()
	const { fourWeekAverageDays, eightWeekAverageDays } = getFourAndEightWeekAverageDays()

	const callLogs = () => {
		console.log(`Successfully clocked ${clockIn ? "in" : "out"} at ${timeComponents.timeString}`)
		if(recentShifts) {
			console.log(lastClockInString)
			console.log(lastClockOutString)
		}
		console.log(`Worked ${getHoursAndMinutesFromDecimalHours(hoursAndShiftsToday.totalHours)} hours today in ${hoursAndShiftsToday.totalShifts} shifts`)
		console.log(`Hours this week: ${getHoursAndMinutesFromDecimalHours(hoursThisWeek)}`)
		console.log(`Hours last week: ${getHoursAndMinutesFromDecimalHours(hoursLastWeek)}`)
		console.log(`4 week average hours: ${getHoursAndMinutesFromDecimalHours(fourWeekAverage)}; days: ${fourWeekAverageDays}`)
		console.log(`8 week average hours: ${getHoursAndMinutesFromDecimalHours(eightWeekAverage)}; days; ${eightWeekAverageDays}`)
	}

	return {
		timeComponents,
		currentMonthLog,
		pastMonthLog,
		callLogs
	}
}

const determineLastClockIn = (recentShifts: Interfaces.RecentShifts) => {
	// new clock is not saved until after this function is called, so this will always be the clock-in time of the most recent saved shift
	return recentShifts?.lastShift[0]
}

const determineLastClockOut = (recentShifts: Interfaces.RecentShifts, clockIn: boolean) => {
	if(clockIn) {
		return recentShifts?.lastShift[1]
	} else {
		return recentShifts?.secondLastShift[1]
	}
}

const getAllShiftsForCurrentAndLastMonth = (currentMonthLog: Interfaces.MonthLog, pastMonthLog: Interfaces.MonthLog) => {
	const allShiftsArray: Interfaces.Shift[] = []
	if(pastMonthLog) {
		Object.values(pastMonthLog).forEach(shiftArray => {
			shiftArray.forEach(shift => {
				allShiftsArray.push(shift)
			})
		})
	}
	if(currentMonthLog) {
		Object.values(currentMonthLog).forEach(shiftArray => {
			shiftArray.forEach(shift => {
				allShiftsArray.push(shift)
			})
		})
	}

	return allShiftsArray
}

const getMostRecentShiftsInfo = (currentMonthLog: Interfaces.MonthLog, pastMonthLog: Interfaces.MonthLog): Interfaces.RecentShifts | undefined => {
	const allShiftsArray = getAllShiftsForCurrentAndLastMonth(currentMonthLog, pastMonthLog)

	if(!allShiftsArray.length) {
		return undefined
	}

	const lastShift = allShiftsArray[allShiftsArray.length - 1]
	const secondLastShift = allShiftsArray.length > 1 ? allShiftsArray[allShiftsArray.length - 2] : undefined

	return { lastShift, secondLastShift }
}

const getHoursAndShiftsWorkedForDay = (clockTime: Date, typeOfCheck: Interfaces.ClockEventTypes, clockedIn: boolean): Interfaces.HoursAndShifts => {
	const clockTimeComponents = getTimeComponents(clockTime)
	const currentMonthLog: Interfaces.MonthLog = getMonthLogSafe(clockTimeComponents.calendarMonth, clockTimeComponents.year)
	const todayShifts: Interfaces.Shift[] = currentMonthLog[clockTimeComponents.date] || []
	const totalHours = todayShifts.reduce((cumHours, shift, shiftIndex, shiftArray) => {
		//check for scenarios where the most recent shift shouldn't have a clock-out, then add a value when last shift is reached
		if(clockedIn && (shiftIndex === shiftArray.length - 1)) {
			let timeToUse
			if(typeOfCheck === "clockOut") {
				timeToUse = clockTime.getTime()
			} else if(typeOfCheck === "check") {
				timeToUse = clockTimeComponents.ms
			}
			return cumHours + ((timeToUse - shift[0])/3600000)
		} else {
			//if any shift but last has a missing clock, don't add any time. A log should already have been thrown for the missed clocks.
			if(!shift[0] || !shift[1]) {
				return cumHours
			}
			return cumHours + ((shift[1] - shift[0])/3600000)
		}
	}, 0)
	const totalShifts = todayShifts.length

	return {totalHours, totalShifts}
}

/**
 * 
 * @param passedDate if checking for week containing current day, pass in nothing
 * @returns 
 */
const getHoursForWeekContainingDate = (passedDate?: Date) => {
	const { datesToGet, monthLogs, dateComponents } = determineDatesToGetForAWeek(passedDate)
	const hoursForWeek = datesToGet.reduce((cumHours, dateTuple) => {
		const month = dateTuple[0]
		const date = dateTuple[1]
		const shiftArrayForDate = monthLogs[month][date]
		let hoursForDate
		if(!shiftArrayForDate) {
			hoursForDate = 0
		} else {
			hoursForDate = shiftArrayForDate.reduce((cumHours, shift) => {
				if(shift[1]) {
					return cumHours + ((shift[1] - shift[0])/3600000)
				} else {
					if(!passedDate) {
						//indicates most likely currently clocked in - use current time
						return cumHours + ((dateComponents.ms - shift[0])/3600000)
					} else {
						//indicates most likely missed clock - shift not included until fixed
						return cumHours
					}
				}
			}, 0)
		}

		return cumHours + hoursForDate
		
	}, 0)

	return hoursForWeek
}

const getDaysForWeekContainingDate = (passedDate?: Date) => {
	const { datesToGet, monthLogs } = determineDatesToGetForAWeek(passedDate)

	const daysInWeekWithShifts = datesToGet.reduce((cumDays, dateTuple) => {
		const month = dateTuple[0]
		const date = dateTuple[1]
		const dateHasShifts = !!monthLogs[month][date]
		return cumDays + (dateHasShifts ? 1 : 0)
	}, 0)

	return daysInWeekWithShifts
}

const determineDatesToGetForAWeek = (passedDate: Date | undefined) => {
	const dateToUse = passedDate || new Date()
	const dateComponents = getTimeComponents(dateToUse)
	const monthsToGet: number[] = []
	// [month, date]
	const datesToGet: [number, number][] = []
	//day starts at 0 for Sunday; this will start the for loop at this week's Sunday and go until "today"
	for(let i = dateComponents.day * -1; i < (7 - dateComponents.day); i++) {
		const date = new Date(dateComponents.year, dateComponents.calendarMonth - 1, dateComponents.date + i)
		//if week spans 2 months, need to grab previous month as well
		if(!monthsToGet.some(month => month === date.getMonth() + 1)) {
			monthsToGet.push(date.getMonth() + 1)
		}
		//the same date will never appear in one week
		datesToGet.push([ date.getMonth() + 1, date.getDate() ])
	}
	const monthLogs = {}
	monthsToGet.forEach(month => {
		monthLogs[month] = getMonthLogSafe(month, dateComponents.year)
	})

	return { datesToGet, monthLogs, dateComponents }
}

const getFourAndEightWeekAverageHours = () => {
	const today = new Date()
	const todayComponents = getTimeComponents(today)

	let totalHours = 0

	for(let i = 7; i <= 28; i = i + 7) {
		const weekHours = getHoursForWeekContainingDate(new Date(todayComponents.year, todayComponents.calendarMonth - 1, todayComponents.date - i))
		totalHours = totalHours + weekHours
	}
	const fourWeekAverage = totalHours / 4

	for(let i = 35; i <= 56; i = i + 7) {
		const weekHours = getHoursForWeekContainingDate(new Date(todayComponents.year, todayComponents.calendarMonth - 1, todayComponents.date - i))
		totalHours = totalHours + weekHours
	}
	const eightWeekAverage = totalHours / 8

	return { fourWeekAverage, eightWeekAverage }
}

const getFourAndEightWeekAverageDays = () => {
	const today = new Date()
	const todayComponents = getTimeComponents(today)

	let totalDays = 0

	for(let i = 7; i <= 28; i = i + 7) {
		const weekDays = getDaysForWeekContainingDate(new Date(todayComponents.year, todayComponents.calendarMonth - 1, todayComponents.date - i))
		totalDays = totalDays + weekDays
	}
	const fourWeekAverageDays = totalDays / 4

	for(let i = 35; i <= 56; i = i + 7) {
		const weekDays = getDaysForWeekContainingDate(new Date(todayComponents.year, todayComponents.calendarMonth - 1, todayComponents.date - i))
		totalDays = totalDays + weekDays
	}
	const eightWeekAverageDays = totalDays / 8

	return { fourWeekAverageDays, eightWeekAverageDays }
}

const getTimeComponents = (dateObject: Date): Interfaces.TimeComponents => {
	return {
		year: dateObject.getFullYear(),
		calendarMonth: dateObject.getMonth() + 1,
		date: dateObject.getDate(),
		day: dateObject.getDay(),
		timeString: dateObject.toLocaleString(),
		ms: dateObject.getTime()
	}
}