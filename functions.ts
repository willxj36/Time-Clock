import { log, logDivider, logColors } from "./Logger"
import * as Interfaces from "./Interfaces"
import * as FormatOperations from "./FormatOperations"
import * as FileOperations from "./FileOperations"
import * as DataOperations from "./DataOperations"
const fs = require("fs")

//TODO: add status and stats functions
//TODO: handle manual clock times better (what if manual time is after current time?; how to place in a shift that isn't the most recent)
//TODO: handle shifts that stretch over midnight for the logging
//TODO: finish get clock in/out string funcs
//TODO: make graph of hours worked for day

/////// - FUNCTIONS CALLED BY TERMINAL - ///////

module.exports.clockIn = function (clockInTime: Interfaces.ManualTime) {
	const { timeComponents, currentMonthLog, callLogs } = DataOperations.getNeededInfoForClocking(clockInTime, true)

	if(!!currentMonthLog[timeComponents.date]) {
		currentMonthLog[timeComponents.date].push([ timeComponents.ms, null ])
	} else {
		currentMonthLog[timeComponents.date] = [ [ timeComponents.ms, null ] ]
	}

	try {
		//write to log file when calculations are finished, but wait to write console.logs (hence use of sync)
		FileOperations.writeMonthLog(timeComponents.calendarMonth, timeComponents.year, currentMonthLog)
		callLogs()
	} catch (error) {
		console.error(error)
	}
}

module.exports.clockOut = function (clockOutTime: Interfaces.ManualTime) {
	const { timeComponents, currentMonthLog, callLogs } = DataOperations.getNeededInfoForClocking(clockOutTime, false)

	const dateShiftArray = currentMonthLog[timeComponents.date]
	if(!!dateShiftArray) {
		//make sure latest shift doesn't already have a clock-out
		if(!dateShiftArray[dateShiftArray.length - 1][1]) {
			dateShiftArray[dateShiftArray.length - 1][1] = timeComponents.ms
		} else {
			// TODO: this means missing clock-in 
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
				log.alert("Warning! No corresponding clock-in found, use clock-in with manual date as parameter to add missed clock-in")
			}
		} else {
			//if no clock-in today and no shifts yesterday at all, assume missed clock-in, log this clock-out, give warning to manually fix
			currentMonthLog[timeComponents.date] = [ [ null, timeComponents.ms ] ]
			log.alert("Warning! No corresponding clock-in found, use clock-in with manual date as parameter to add missed clock-in")
		}
	}
	//write to log file when calculations are finished, but wait to write console.logs (hence use of sync)
	FileOperations.writeMonthLog(timeComponents.calendarMonth, timeComponents.year, currentMonthLog)

	callLogs()
}

module.exports.getStatus = function() {
	const currentDateObject = new Date()
	const timeComponents = DataOperations.getTimeComponents(currentDateObject)
	const currentMonthLog = FileOperations.getMonthLogSafe(timeComponents.calendarMonth, timeComponents.year)
	const pastMonthLog = FileOperations.getPreviousMonthLogSafe(timeComponents)
	const allShiftsArray = DataOperations.getAllShiftsForCurrentAndLastMonth(currentMonthLog, pastMonthLog)

	const mostRecentShift = allShiftsArray[allShiftsArray.length - 1] || null
	if(!mostRecentShift) {
		log.alert("No shifts found in logs")
	} else {
		const invalidShifts = DataOperations.getInvalidShifts(allShiftsArray)
		let clockedIn: boolean
		if(mostRecentShift[0] && !mostRecentShift[1]) {
			clockedIn = true
			log.success(`Currently clocked in since ${new Date(mostRecentShift[0]).toLocaleString()}`)
		} else {
			clockedIn = false
			log.alert(`Currently clocked out since ${new Date(mostRecentShift[1]!).toLocaleString()}`)
		}
		logDivider()
		const { totalHours, totalShifts } = DataOperations.getHoursAndShiftsWorkedForDay(currentDateObject, clockedIn)
		log.info(`Today's hours: ${FormatOperations.getHoursAndMinutesFromDecimalHours(totalHours)}`)
		log.info(`Today's shifts: ${totalShifts}`)
		logDivider()
		log.success(`${invalidShifts.length || "No"} invalid shift${invalidShifts.length !== 1 ? "s": ""} in current month and last month logs`)
		if(invalidShifts.length) {
			log.error("Invalid shifts:")
			invalidShifts.forEach(shift => {
				const startTimeComponents = !!shift[0] ? DataOperations.getTimeComponents(new Date(shift[0])) : null
				const endTimeComponents = !!shift[1] ? DataOperations.getTimeComponents(new Date(shift[1])) : null
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