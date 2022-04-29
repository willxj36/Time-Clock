import * as FormatOperations from "./FormatOperations"
import * as Interfaces from "./Interfaces"
const fs = require("fs")

/**
 * Reads file to retrieve full log for month indicated
 * @param calendarMonth calendar month number
 * @param year 
 * @returns JSON object of current month log
 */
export const getMonthLogSafe = (calendarMonth: number, year: number): Interfaces.MonthLog => {
	const filePath = FormatOperations.monthFileFormatAndPath(calendarMonth, year)
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
export const getPreviousMonthLogSafe = (timeComponents: Interfaces.TimeComponents): Interfaces.MonthLog | null => {
	const yearForPreviousMonth = timeComponents.calendarMonth === 1 ? timeComponents.year - 1 : timeComponents.year
	const filePath = FormatOperations.monthFileFormatAndPath(timeComponents.calendarMonth - 1, yearForPreviousMonth)
	const fileExists = fs.existsSync(filePath)
	if(fileExists) {
		return JSON.parse(fs.readFileSync(filePath, {encoding: "utf-8"}))
	} else {
		return null
	}
}

export const writeMonthLog = (month: number, year: number, data: Interfaces.MonthLog) => {
	fs.writeFileSync(FormatOperations.monthFileFormatAndPath(month, year), JSON.stringify(data), {encoding: "utf-8"})
}