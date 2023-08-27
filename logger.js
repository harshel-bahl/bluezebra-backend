const { json } = require('express');
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
    printf((info) => {

        const { timestamp, level, message, error, stack, json, ...metadata } = info;

        let timestampStr = `[${timestamp}]`;
        let levelStr = level; 

        let maxWidth = 41;
        let spacePadding = maxWidth - timestampStr.length - levelStr.length;
        let paddingStr = ' '.repeat(spacePadding);
        
        let log = `${timestampStr} ${levelStr}${paddingStr}|| `;

        if (message) {
            log += message;
        }

        if (error) {
            log += `error: ${error}`;
        }

        if (metadata) {
            for (let key in metadata) {
                log += `${key}: ${metadata[key]}`;
            }
        }

        if (json) {
            log += `JSON: ${JSON.stringify(json, null, 2)}`;
        }

        if (stack) {
            log += '\n' + stack;
        }
        
        return log;
    })
);

const fileFormat = combine(
    timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    errors({ stack: true }),
    printf((info) => {

        const { timestamp, level, message, error, stack, json, ...metadata } = info;

        let timestampStr = `[${timestamp}]`;
        let levelStr = level.toUpperCase(); 

        let maxWidth = 31;
        let spacePadding = maxWidth - timestampStr.length - levelStr.length;
        let paddingStr = ' '.repeat(spacePadding);
        
        let log = `${timestampStr} ${levelStr}${paddingStr}|| `;

        if (message) {
            log += message;
        }

        if (error) {
            log += `error: ${error}`;
        }

        if (metadata) {
            for (let key in metadata) {
                log += `${key}: ${metadata[key]}`;
            }
        }

        if (json) {
            log += `JSON: ${JSON.stringify(json, null, 2)}`;
        }

        if (stack) {
            log += '\n' + stack;
        }
        
        return log;
    })
);

const jsonFileFormat = combine(
    timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    errors({ stack: true }),
    json(),
);

const consoleTransport = new winston.transports.Console({ format: consoleFormat });

const fileRotateTransport = new winston.transports.DailyRotateFile({
    format: fileFormat,
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '20d',
});

const jsonFileRotateTransport = new winston.transports.DailyRotateFile({
    format: jsonFileFormat,
    filename: 'logs/json-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '20d',
});

const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || 'debug',
    transports: [
        consoleTransport,
        fileRotateTransport,
        jsonFileRotateTransport,
    ],
});

module.exports = logger;