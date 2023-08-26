const winston = require('winston');
require('winston-daily-rotate-file');

const { combine, timestamp, printf, colorize, align, errors } = winston.format;

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const consoleFormat = combine(
    colorize({ all: true }),
    timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    errors({ stack: true }),
    // align(),
    printf((info) => {
        let maxWidth = 41;
        let timestampStr = `[${info.timestamp}]`;
        let levelStr = info.level; 
        let spacePadding = maxWidth - timestampStr.length - levelStr.length;
        let paddingStr = ' '.repeat(spacePadding);
        
        return `${timestampStr} ${levelStr}${paddingStr}|| ${info.message}`;
    })
);

const fileFormat = combine(
    timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    errors({ stack: true }),
    // align(),
    printf((info) => {
        let maxWidth = 31;
        let timestampStr = `[${info.timestamp}]`;
        let levelStr = info.level.toUpperCase(); 
        let spacePadding = maxWidth - timestampStr.length - levelStr.length;
        let paddingStr = ' '.repeat(spacePadding);
        
        return `${timestampStr} ${levelStr}${paddingStr}|| ${info.message}`;
    })
);

const fileRotateTransport = new winston.transports.DailyRotateFile({
    format: fileFormat,
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '20d',
});

const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || 'debug',
    transports: [
        new winston.transports.Console({ format: consoleFormat }),
        fileRotateTransport,
    ],
});

module.exports = logger;