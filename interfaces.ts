export interface TimeComponents {
	year: number,
	calendarMonth: number, //named such to remind that the calendar number for month is not the same as date object number
	date: number,
	day: number, //day of the week using index numbers i.e. Sunday is 0, Monday is 1, etc
	timeString: string,
	ms: number
}

export type ManualTime = [string, string, string, string, string]

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