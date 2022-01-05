export interface TimeComponents {
	year: number,
	calendarMonth: number, //named such to remind that the calendar number for month is not the same as date object number
	date: number,
	day: number,
	timeString: string,
	ms: number
}

export interface MonthLog {
	[date: number]: Shift[]
}

export interface HoursAndShifts {
	totalHours: number,
	totalShifts: number
}

export interface RecentShifts {
	lastShift: Shift,
	secondLastShift: Shift | undefined
}

export type ClockEventTypes = "clockOut" | "clockIn" | "check"

//use ms for simplicity, storage space, and ease of calculations
export type Shift = [ClockIn | null, ClockOut | null]
//for clarity of use of each index
type ClockIn = number
type ClockOut = number