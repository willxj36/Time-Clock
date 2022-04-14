import { log, logDivider, logColors } from "./logger"
import * as Interfaces from "./interfaces"
const fs = require("fs")
const config = require("./config.json")

//TODO: add status and stats functions
//TODO: handle manual clock times better (what if manual time is after current time?; how to place in a shift that isn't the most recent)
//TODO: handle shifts that stretch over midnight for the logging

/////// - FUNCTIONS CALLED BY TERMINAL - ///////

module.exports.clockIn = function (clockInTime: Interfaces.ManualTime) {
	const { timeComponents, currentMonthLog, callLogs } = getNeededInfoForClocking(clockInTime, true)

	if(!!currentMonthLog[timeComponents.date]) {
		currentMonthLog[timeComponents.date].push([ timeComponents.ms, null ])
	} else {
		currentMonthLog[timeComponents.date] = [ [ timeComponents.ms, null ] ]
	}

	try {
		//write to log file when calculations are finished, but wait to write console.logs (hence use of sync)
		writeMonthLog(timeComponents.calendarMonth, timeComponents.year, currentMonthLog)
		callLogs()
	} catch (error) {
		console.error(error)
	}
}

module.exports.clockOut = function (clockOutTime: Interfaces.ManualTime) {
	const { timeComponents, currentMonthLog, callLogs } = getNeededInfoForClocking(clockOutTime, false)

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
				// if the shift exists, but clock out is null, there must be a clock in
				const hoursSinceYesterdayClockIn = (timeComponents.ms - yesterdayShiftArray[yesterdayShiftArray.length - 1][0]!)/3600000
				if(hoursSinceYesterdayClockIn > 8) {
					currentMonthLog[timeComponents.date] = [ [ null, timeComponents.ms ] ]
					log.alert("No corresponding clock-in today, last clock-in over 8 hours ago. Most likely a clock-out AND clock-in was missed. This clock-out will be written to a new shift. Use clock-in with manual time as parameter and clock-out with manual time as parameter to correct(set both clock-in and clock-out to midnight between current shifts if this is supposed to be one long shift).")
				} else {
					currentMonthLog[timeComponents.date - 1][currentMonthLog[timeComponents.date - 1].length - 1][1] = timeComponents.ms
				}
			} else {
				//indicates shifts exist for yesterday, but last one already has a clockout
				currentMonthLog[timeComponents.date] = [ [ null, timeComponents.ms ] ]
				log.alert("Warning! No corresponding clock-in found, use clock-in with ms time as parameter to add missed clock-in")
			}
		} else {
			//if no clock-in today and no shifts yesterday at all, assume missed clock-in, log this clock-out, give warning to manually fix
			currentMonthLog[timeComponents.date] = [ [ null, timeComponents.ms ] ]
			log.alert("Warning! No corresponding clock-in found, use clock-in with ms time as parameter to add missed clock-in")
		}
	}
	//write to log file when calculations are finished, but wait to write console.logs (hence use of sync)
	writeMonthLog(timeComponents.calendarMonth, timeComponents.year, currentMonthLog)

	callLogs()
}

module.exports.getStatus = function() {
	const currentDateObject = new Date()
	const timeComponents = getTimeComponents(currentDateObject)
	const currentMonthLog = getMonthLogSafe(timeComponents.calendarMonth, timeComponents.year)
	const pastMonthLog = getPreviousMonthLogSafe(timeComponents)
	const allShiftsArray = getAllShiftsForCurrentAndLastMonth(currentMonthLog, pastMonthLog)

	const mostRecentShift = allShiftsArray[allShiftsArray.length - 1] || null
	if(!mostRecentShift) {
		log.alert("No shifts found in logs")
	} else {
		const invalidShifts = getInvalidShifts(allShiftsArray)
		let clockedIn: boolean
		if(mostRecentShift[0] && !mostRecentShift[1]) {
			clockedIn = true
			log.success(`Currently clocked in since ${new Date(mostRecentShift[0]).toLocaleString()}`)
		} else {
			clockedIn = false
			log.alert(`Currently clocked out since ${new Date(mostRecentShift[1]!).toLocaleString()}`)
		}
		logDivider()
		const { totalHours, totalShifts } = getHoursAndShiftsWorkedForDay(currentDateObject, clockedIn)
		log.info(`Today's hours: ${getHoursAndMinutesFromDecimalHours(totalHours)}`)
		log.info(`Today's shifts: ${totalShifts}`)
		logDivider()
		log.success(`${invalidShifts.length || "No"} invalid shift${invalidShifts.length !== 1 ? "s": ""} in current month and last month logs`)
		if(invalidShifts.length) {
			log.error("Invalid shifts:")
			invalidShifts.forEach(shift => {
				const startTimeComponents = !!shift[0] ? getTimeComponents(new Date(shift[0])) : null
				const endTimeComponents = !!shift[1] ? getTimeComponents(new Date(shift[1])) : null
				log.info(`IN: ${startTimeComponents ? startTimeComponents.timeString : logColors.error("MISSING")}     |     OUT: ${endTimeComponents ? endTimeComponents.timeString : logColors.error("MISSING")}`)
			})
		}
	}
	/**
	 * clocked in?
	 * hours worked today
	 * hours worked this week
	 * shifts today
	 */
}

/////// - FORMATTING FUNCS - ///////

/**
 * Single source of truth for file format and path
 * @param calendarMonth calendar number for month e.g. 12 for December, not Date object number for month e.g. 11 for December
 * @param year 
 * @returns proper file format
 */
const monthFileFormatAndPath = (calendarMonth: number, year: number) => {
	let monthToUse = calendarMonth
	let yearToUse = year
	if(calendarMonth <= 0) {
		monthToUse = (12 - calendarMonth)
		yearToUse = year - 1
	}
	return `${config.rootPath}/logs/Log-${monthToUse}_${yearToUse}`
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
 * @param calendarMonth calendar month number
 * @param year 
 * @returns JSON object of current month log
 */
const getMonthLogSafe = (calendarMonth: number, year: number): Interfaces.MonthLog => {
	const filePath = monthFileFormatAndPath(calendarMonth, year)
	const fileExists = fs.existsSync(filePath)
	if(fileExists) {
		return JSON.parse(fs.readFileSync(filePath, {encoding: "utf-8"}))
	} else {
		return JSON.parse("{}")
	}
}

/**
 * Used to get previous month specifically, as it will use time components to determine if prior year needs to be used, and return undefined if there is no log instead of an empty object
 * @param timeComponents 
 */
const getPreviousMonthLogSafe = (timeComponents: Interfaces.TimeComponents): Interfaces.MonthLog | null => {
	const yearForPreviousMonth = timeComponents.calendarMonth === 1 ? timeComponents.year - 1 : timeComponents.year
	const filePath = monthFileFormatAndPath(timeComponents.calendarMonth - 1, yearForPreviousMonth)
	const fileExists = fs.existsSync(filePath)
	if(fileExists) {
		return JSON.parse(fs.readFileSync(filePath, {encoding: "utf-8"}))
	} else {
		return null
	}
}

const writeMonthLog = (month: number, year: number, data: Interfaces.MonthLog) => {
	fs.writeFileSync(monthFileFormatAndPath(month, year), JSON.stringify(data), {encoding: "utf-8"})
}

/////// - GETTING INFO FROM INPUT INFORMATION - ///////

const getNeededInfoForClocking = (clockTime: Interfaces.ManualTime, clockIn: boolean) => {
	let validManualTime = true
	//terminal may hand in an array shorter than 5, so need to hardcode expected length as shorter arrays are not valid
	for(let i = 0 ; i < 5 ; i++) {
		if(clockTime[i] == undefined) {
			validManualTime = false
			if(i > 0) {
				throw new Error(`Received ${i} arguments, 5 arguments are required (yr, mo, date, hr, min) for manual time, or no arguments for current system time. Please try again.`)
			}
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
		if(timeToUse > new Date()) {
			throw new Error("Future clock times not allowed")
		}
	}
	const timeComponents = getTimeComponents(timeToUse)

	const currentMonthLog: Interfaces.MonthLog = getMonthLogSafe(timeComponents.calendarMonth, timeComponents.year)
	const pastMonthLog = getPreviousMonthLogSafe(timeComponents)
	const recentShifts: Interfaces.RecentShifts | null = getMostRecentShiftsInfo(currentMonthLog, pastMonthLog)
	//shifts only exist after a successful clock-in is written, so lastShift[0] should never have a falsy value
	console.assert(recentShifts ? !!recentShifts.lastShift[0] : true, "Last clock-in null or undefined, manually edit logs to correct")
	const lastClockOut = determineLastClockOut(recentShifts, clockIn)
	const lastClockIn = determineLastClockIn(recentShifts)
	const lastClockOutString = recentShifts ? (lastClockOut ? `Last clock-out: ${new Date(lastClockOut).toLocaleString()}` : "Missed clock-out! Use clock-out with ms time as parameter to fix") : "No previous shifts found for current and previous months"
	const lastClockInString = recentShifts ? (lastClockIn ? `Last clock-in: ${new Date(lastClockIn).toLocaleString()}` : "Missing clock-in! Use clock-in with ms time as parameter to fix") : "No previous shifts found for current and previous months"
	const hoursAndShiftsToday: Interfaces.HoursAndShifts = getHoursAndShiftsWorkedForDay(timeToUse, !clockIn) //parent function only called on clocking in or out, not status or stat checks
	const hoursThisWeek: number = getHoursForWeekContainingDate()
	const hoursLastWeek: number = getHoursForWeekContainingDate(new Date(timeComponents.year, timeComponents.calendarMonth - 1, timeComponents.date - 7))
	const { fourWeekAverage, eightWeekAverage } = getFourAndEightWeekAverageHours()
	const { fourWeekAverageDays, eightWeekAverageDays } = getFourAndEightWeekAverageDays()

	const callLogs = () => {
		log.success(`Successfully clocked ${clockIn ? "in" : "out"} at ${timeComponents.timeString}`)
		logDivider()
		if(recentShifts) {
			log.info(lastClockInString)
			log.info(lastClockOutString)
			logDivider()
		}
		log.muted(`Hours today: ${getHoursAndMinutesFromDecimalHours(hoursAndShiftsToday.totalHours)}`)
		log.muted(`Shifts today: ${hoursAndShiftsToday.totalShifts}`)
		log.muted(`Hours this week: ${getHoursAndMinutesFromDecimalHours(hoursThisWeek)}`)
		log.muted(`Hours last week: ${getHoursAndMinutesFromDecimalHours(hoursLastWeek)}`)
		logDivider()
		log.muted(`4 week average hours: ${getHoursAndMinutesFromDecimalHours(fourWeekAverage)}; days: ${fourWeekAverageDays}`)
		log.muted(`8 week average hours: ${getHoursAndMinutesFromDecimalHours(eightWeekAverage)}; days; ${eightWeekAverageDays}`)
	}

	return {
		timeComponents,
		currentMonthLog,
		pastMonthLog,
		callLogs
	}
}

const determineLastClockIn = (recentShifts: Interfaces.RecentShifts | null) => {
	// new clock is not saved until after this function is called, so this will always be the clock-in time of the most recent saved shift
	return recentShifts?.lastShift[0]
}

const determineLastClockOut = (recentShifts: Interfaces.RecentShifts | null, clockIn: boolean) => {
	if(clockIn) {
		return recentShifts?.lastShift[1]
	} else {
		return recentShifts?.secondLastShift ? recentShifts?.secondLastShift[1] : undefined
	}
}

const getAllShiftsForCurrentAndLastMonth = (currentMonthLog: Interfaces.MonthLog | null, pastMonthLog: Interfaces.MonthLog | null) => {
	const allShiftsArray: Interfaces.Shift[] = []
	if(pastMonthLog) {
		Object.values(pastMonthLog).forEach((shiftArray: Interfaces.Shift[]) => {
			shiftArray.forEach(shift => {
				allShiftsArray.push(shift)
			})
		})
	}
	if(currentMonthLog) {
		Object.values(currentMonthLog).forEach((shiftArray: Interfaces.Shift[]) => {
			shiftArray.forEach(shift => {
				allShiftsArray.push(shift)
			})
		})
	}

	return allShiftsArray
}

const getMostRecentShiftsInfo = (currentMonthLog: Interfaces.MonthLog | null, pastMonthLog: Interfaces.MonthLog | null): Interfaces.RecentShifts | null => {
	const allShiftsArray = getAllShiftsForCurrentAndLastMonth(currentMonthLog, pastMonthLog)

	if(!allShiftsArray.length) {
		return null
	}

	const lastShift = allShiftsArray[allShiftsArray.length - 1]
	const secondLastShift = allShiftsArray.length > 1 ? allShiftsArray[allShiftsArray.length - 2] : null

	return { lastShift, secondLastShift }
}

const getHoursAndShiftsWorkedForDay = (clockTime: Date, clockedIn: boolean): Interfaces.HoursAndShifts => {
	const clockTimeComponents = getTimeComponents(clockTime)
	const currentMonthLog: Interfaces.MonthLog = getMonthLogSafe(clockTimeComponents.calendarMonth, clockTimeComponents.year)
	const todayShifts: Interfaces.Shift[] = currentMonthLog[clockTimeComponents.date] || []
	const totalHours = todayShifts.reduce((cumHours, shift, shiftIndex, shiftArray) => {
		//check for scenarios where the most recent shift shouldn't have a clock-out, then add a value when last shift is reached
		if(clockedIn && (shiftIndex === shiftArray.length - 1)) {
			const timeToUse = clockTimeComponents.ms
			return cumHours + ((timeToUse - shift[0]!)/3600000)
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
				if(shift[1] && shift[0]) {
					return cumHours + ((shift[1] - shift[0])/3600000)
				} else {
					if(!passedDate && shift[0]) {
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
	const monthLogs: {[month: number]: Interfaces.MonthLog} = {}
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

/**
 * Used to filter shifts to get an array of shifts with missed clock-in/clock-out
 * @param allShifts array of allShifts from current and previous month logs
 * @returns filtered array of same type with only invalid shifts
 */
const getInvalidShifts = (allShifts: Interfaces.Shift[]): Interfaces.Shift[] => {
	const invalidShifts: Interfaces.Shift[] = allShifts.filter((shift, index) => {
		if(index !== allShifts.length - 1) {
			// if not at last index, any null value means missed clock/invalid shift
			return !shift[0] || !shift[1]
		} else {
			// if at last index, null value for clock-in means missed clock/invalid shift
			return !shift[0]
		}
	})

	return invalidShifts
}