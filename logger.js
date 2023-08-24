const winston = require('winston');
require('winston-daily-rotate-file');

const { combine, timestamp, printf, colorize, align } = winston.format;

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
    align(),
    printf((info) => `[${info.timestamp}] ${info.level} -- ${info.message}`)
);

const fileFormat = combine(
    timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    align(),
    printf((info) => `[${info.timestamp}] ${info.level} -- ${info.message}`)
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