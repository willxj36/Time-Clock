"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logColors = exports.logDivider = exports.log = void 0;
const chalk_1 = __importDefault(require("chalk"));
exports.log = {
    info: console.log,
    muted: (...args) => console.log(chalk_1.default.dim(...args)),
    error: (...args) => console.log(chalk_1.default.redBright(...args)),
    alert: (...args) => console.log(chalk_1.default.yellowBright(...args)),
    emerg: (...args) => console.log(chalk_1.default.bgRedBright(...args)),
    success: (...args) => console.log(chalk_1.default.bgGreen(...args)),
};
const logDivider = () => {
    return exports.log.info("- - - - - - - - - - - -");
};
exports.logDivider = logDivider;
exports.logColors = {
    info: chalk_1.default.white,
    error: chalk_1.default.red,
    muted: chalk_1.default.dim,
    alert: chalk_1.default.yellow,
    emerg: chalk_1.default.bgRedBright,
    success: chalk_1.default.green
};
