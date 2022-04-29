import * as FileOperations from "./FileOperations"
import * as FormatOperations from "./FormatOperations"
import * as Interfaces from "./Interfaces"
import { log, logDivider, logColors } from "./Logger"

export const getNeededInfoForClocking = (clockTime: Interfaces.ManualTime, clockIn: boolean) => {
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

	const currentMonthLog: Interfaces.MonthLog = FileOperations.getMonthLogSafe(timeComponents.calendarMonth, timeComponents.year)
	const pastMonthLog = FileOperations.getPreviousMonthLogSafe(timeComponents)
	const recentShifts: Interfaces.RecentShifts | null = getMostRecentShiftsInfo(currentMonthLog, pastMonthLog)
	//shifts only exist after a successful clock-in is written, so lastShift[0] should never have a falsy value
	console.assert(recentShifts ? !!recentShifts.lastShift[0] : true, "Last clock-in null or undefined, manually edit logs to correct")
	const lastClockOut = determineLastClockOut(recentShifts, clockIn)
	const lastClockIn = determineLastClockIn(recentShifts)
	const lastClockOutString = recentShifts ? (lastClockOut ? `Last clock-out: ${new Date(lastClockOut).toLocaleString()}` : logColors.error("Missed clock-out! Use clock-out with manual date as parameter to fix")) : "No previous shifts found for current and previous months"
	let hasMissedClockIn: boolean
		if(!lastClockIn || (lastClockIn && lastClockOut && lastClockIn < lastClockOut)) {

		}
	const lastClockInString = recentShifts ? (lastClockIn ? `Last clock-in: ${new Date(lastClockIn).toLocaleString()}` : logColors.error("Missing clock-in! Use clock-in with manual date as parameter to fix")) : "No previous shifts found for current and previous months"
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
		log.muted(`Hours today: ${FormatOperations.getHoursAndMinutesFromDecimalHours(hoursAndShiftsToday.totalHours)}`)
		log.muted(`Shifts today: ${hoursAndShiftsToday.totalShifts}`)
		log.muted(`Hours this week: ${FormatOperations.getHoursAndMinutesFromDecimalHours(hoursThisWeek)}`)
		log.muted(`Hours last week: ${FormatOperations.getHoursAndMinutesFromDecimalHours(hoursLastWeek)}`)
		logDivider()
		log.muted(`4 week average hours: ${FormatOperations.getHoursAndMinutesFromDecimalHours(fourWeekAverage)}; days: ${fourWeekAverageDays}`)
		log.muted(`8 week average hours: ${FormatOperations.getHoursAndMinutesFromDecimalHours(eightWeekAverage)}; days; ${eightWeekAverageDays}`)
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

const getLastClockInString = (recentShifts: Interfaces.RecentShifts | null, lastClockIn: number | null, clockIn: boolean) => {

}

const getLastClockOutString = (recentShifts: Interfaces.RecentShifts | null, lastClockIn: number | null, clockIn: boolean) => {

}

export const getAllShiftsForCurrentAndLastMonth = (currentMonthLog: Interfaces.MonthLog | null, pastMonthLog: Interfaces.MonthLog | null) => {
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

export const getHoursAndShiftsWorkedForDay = (clockTime: Date, clockedIn: boolean): Interfaces.HoursAndShifts => {
	const clockTimeComponents = getTimeComponents(clockTime)
	const currentMonthLog: Interfaces.MonthLog = FileOperations.getMonthLogSafe(clockTimeComponents.calendarMonth, clockTimeComponents.year)
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
		monthLogs[month] = FileOperations.getMonthLogSafe(month, dateComponents.year)
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

export const getTimeComponents = (dateObject: Date): Interfaces.TimeComponents => {
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
export const getInvalidShifts = (allShifts: Interfaces.Shift[]): Interfaces.Shift[] => {
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