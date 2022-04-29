"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeMonthLog = exports.getPreviousMonthLogSafe = exports.getMonthLogSafe = void 0;
const FormatOperations = __importStar(require("./FormatOperations"));
const fs = require("fs");
/**
 * Reads file to retrieve full log for month indicated
 * @param calendarMonth calendar month number
 * @param year
 * @returns JSON object of current month log
 */
const getMonthLogSafe = (calendarMonth, year) => {
    const filePath = FormatOperations.monthFileFormatAndPath(calendarMonth, year);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
        return JSON.parse(fs.readFileSync(filePath, { encoding: "utf-8" }));
    }
    else {
        return JSON.parse("{}");
    }
};
exports.getMonthLogSafe = getMonthLogSafe;
/**
 * Used to get previous month specifically, as it will use time components to determine if prior year needs to be used, and return undefined if there is no log instead of an empty object
 * @param timeComponents
 */
const getPreviousMonthLogSafe = (timeComponents) => {
    const yearForPreviousMonth = timeComponents.calendarMonth === 1 ? timeComponents.year - 1 : timeComponents.year;
    const filePath = FormatOperations.monthFileFormatAndPath(timeComponents.calendarMonth - 1, yearForPreviousMonth);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
        return JSON.parse(fs.readFileSync(filePath, { encoding: "utf-8" }));
    }
    else {
        return null;
    }
};
exports.getPreviousMonthLogSafe = getPreviousMonthLogSafe;
const writeMonthLog = (month, year, data) => {
    fs.writeFileSync(FormatOperations.monthFileFormatAndPath(month, year), JSON.stringify(data), { encoding: "utf-8" });
};
exports.writeMonthLog = writeMonthLog;
