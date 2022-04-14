import Chalk from "chalk"

export const log = {
    info: console.log,
    muted: (...args: any) => console.log(Chalk.gray(...args)),
    error: (...args: any) => console.log(Chalk.redBright(...args)),
    alert: (...args: any) => console.log(Chalk.yellowBright(...args)),
    emerg: (...args: any) => console.log(Chalk.bgRedBright(...args)),
    success: (...args: any) => console.log(Chalk.bgGreen(...args)),
}

export const logDivider = () => {
    return log.info("- - - - - - - - - - - -")
}

export const logColors = {
    info: Chalk.white,
    error: Chalk.redBright,
    muted: Chalk.dim,
    alert: Chalk.yellowBright,
    emerg: Chalk.bgRedBright,
    success: Chalk.bgGreen
}