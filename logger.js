const winston = require('winston');
require('winston-daily-rotate-file');

const { combine, timestamp, printf, colorize, align } = winston.format;

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const fileRotateTransport = new winston.transports.DailyRotateFile({
    filename: 'combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '20d',
  });

const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || 'debug',
    format: combine(
        colorize({ all: true }),
        timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS',
        }),
        align(),
        printf((info) => `[${info.timestamp}] ${info.level}: (${info.message})`)
    ),
    transports: [
        new winston.transports.Console(),
        fileRotateTransport,
    ],
});

module.exports = logger;