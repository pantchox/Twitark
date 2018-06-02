/* Logger class */
var winston = require('winston');
var moment = require('moment');

module.exports = Logger;

function Logger(logPath, prefix, tsSuffix) {
    tsSuffix = tsSuffix || '';
    var tsFormat = function () {
        return moment().format("DD-MM-YYYY HH:mm:ss") + tsSuffix;
    }

    var logger = new(winston.Logger)({
        transports: [
            new(winston.transports.Console)({
                timestamp: tsFormat,
                colorize: true,
                level: 'verbose',
                handleExceptions: true
            }),
            new(require('winston-daily-rotate-file'))({
                filename: `${logPath}/-${prefix}.log`,
                timestamp: tsFormat,
                datePattern: 'yyyy-MM-dd',
                colorize: true,
                prepend: true,
                json: false,
                level: 'info',
            })
        ],
        exceptionHandlers: [
            new winston.transports.File({
                filename: `${logPath}/${prefix}-exceptions.log`,
                prepend: true
            })
        ]
    });
    logger.emitErrs = false; // make it not to crash on error

    return logger;
}
