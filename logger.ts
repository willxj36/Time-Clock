import Chalk from "chalk"



export const log = {
    info: console.log,
    muted: (...args: any) => console.log(Chalk.dim(...args)),
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
    error: Chalk.red,
    muted: Chalk.dim,
    alert: Chalk.yellow,
    emerg: Chalk.bgRedBright,
    success: Chalk.green
}