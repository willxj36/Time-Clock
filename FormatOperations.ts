const config = require("./config.json")

/**
 * Single source of truth for file format and path
 * @param calendarMonth calendar number for month e.g. 12 for December, not Date object number for month e.g. 11 for December
 * @param year 
 * @returns proper file format
 */
 export const monthFileFormatAndPath = (calendarMonth: number, year: number) => {
	let monthToUse = calendarMonth
	let yearToUse = year
	if(calendarMonth <= 0) {
		monthToUse = (12 - calendarMonth)
		yearToUse = year - 1
	}
	return `${config.rootPath}/logs/Log-${monthToUse}_${yearToUse}`
}

export const getHoursAndMinutesFromDecimalHours = (hoursDecimal: number) => {
	//hours should never be negative, so this shouldn't cause any issues
	const hours = Math.floor(hoursDecimal)
	//always rounds up, acceptable for the intended use of this program
	const minutes = Math.ceil((hoursDecimal - hours) * 60)
	
	return `${hours}h${minutes}m`
}