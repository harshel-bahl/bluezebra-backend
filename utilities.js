const { v4: uuidv4 } = require('uuid');

const {
    ReqParamsNull,
    SocketStatusErr,
    EmptyObj,
    MissingObjProps,
    ObjPropsNull,
    ParseJSONErr,
    JSONBufferErr,
    DBErr,
    EmptyDBResult,
    MultipleDBResults,
    EventErr,
    FuncErr,
    ClientResponseErr,
} = require('./error');

const logger = require('./logger');


// Utility Functions
// =================

function currDT() {
    return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function UUID() {
    return uuidv4();
}

function isNull(value) {
    return value === null || value === undefined;
}

function isNotNull(value) {
    return value !== null && value !== undefined;
}

function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function bufferToObject(
    socketID = null,
    UID = null,
    buffer
) {
    try {
        return JSON.parse(buffer.toString());
    } catch (error) {
        throw new ParseJSONErr(error.message)
    }
}

function objectToBuffer(
    object
) {
    try {
        return Buffer.from(JSON.stringify(object));
    } catch (error) {
        throw new JSONBufferErr(error.message);
    }
}

function cleanStackTrace(
    error
) {
    if (!error.stack) return error;

    let stack = error.stack.split('\n');

    const relevantStack = stack.filter(line => {
        if (line.includes('(internal/')) return false;

        if (line.includes('node_modules')) return false;

        return true;
    });

    const cleanedStack = relevantStack.map(line => `--${line.replace(/^(\s*)at\s+/, '$1')}`).join('\n');

    error.stack = cleanedStack;

    return error;
}

function logObj(
    func = null,
    event = null,
    info = null,
    socketID = null,
    UID = null,
    recSocketID = null,
    recUID = null,
    json = null,
) {
    let outputLogObj = {};

    if (func !== null) outputLogObj.func = func;
    if (event !== null) outputLogObj.event = event;
    if (info !== null) outputLogObj.info = info;
    if (socketID !== null) outputLogObj.socketID = socketID;
    if (UID !== null) outputLogObj.UID = UID;
    if (recSocketID !== null) outputLogObj.recSocketID = recSocketID;
    if (recUID !== null) outputLogObj.recUID = recUID;
    if (json !== null) outputLogObj.json = json;

    return outputLogObj;
}

function logDebug(
    message = null,
    func = null,
    event = null,
    error = null,
    info = null,
    socketID = null,
    UID = null,
    recSocketID = null,
    recUID = null,
    json = null,
) {
    let inputLogObj = logObj(func, event, info, socketID, UID, recSocketID, recUID, json);

    let cleanedErr;
    if (error) { cleanedErr = cleanStackTrace(error); }

    let logArgs = [];

    if (message) logArgs.push(message);
    if (!isEmpty(inputLogObj)) logArgs.push(inputLogObj);
    if (cleanedErr) logArgs.push(cleanedErr);

    logger.debug(...logArgs);
}

function logInfo(
    message = null,
    func = null,
    event = null,
    error = null,
    info = null,
    socketID = null,
    UID = null,
    recSocketID = null,
    recUID = null,
    json = null,
) {
    let inputLogObj = logObj(func, event, info, socketID, UID, recSocketID, recUID, json);

    let cleanedErr;
    if (error) { cleanedErr = cleanStackTrace(error); }

    let logArgs = [];

    if (message) logArgs.push(message);
    if (!isEmpty(inputLogObj)) logArgs.push(inputLogObj);
    if (cleanedErr) logArgs.push(cleanedErr);

    logger.info(...logArgs);
}

function logWarn(
    message = null,
    func = null,
    event = null,
    error = null,
    info = null,
    socketID = null,
    UID = null,
    recSocketID = null,
    recUID = null,
    json = null,
) {
    let inputLogObj = logObj(func, event, info, socketID, UID, recSocketID, recUID, json);

    let cleanedErr;
    if (error) { cleanedErr = cleanStackTrace(error); }

    let logArgs = [];

    if (message) logArgs.push(message);
    if (!isEmpty(inputLogObj)) logArgs.push(inputLogObj);
    if (cleanedErr) logArgs.push(cleanedErr);

    logger.warn(...logArgs);
}

function logError(
    message = null,
    func = null,
    event = null,
    error = null,
    info = null,
    socketID = null,
    UID = null,
    recSocketID = null,
    recUID = null,
    json = null,
) {
    let inputLogObj = logObj(func, event, info, socketID, UID, recSocketID, recUID, json);

    let cleanedErr;
    if (error) { cleanedErr = cleanStackTrace(error); }

    let logArgs = [];

    if (message) logArgs.push(message);
    if (!isEmpty(inputLogObj)) logArgs.push(inputLogObj);
    if (cleanedErr) logArgs.push(cleanedErr);

    logger.error(...logArgs);
}

function checkParams(
    socketID = null,
    UID = null,
    params,
    reqParams,
) {
    let nullParams = reqParams.filter(param => isNull(params[param]));

    if (nullParams.length > 0) {
        throw new ReqParamsNull(`null params: ${nullParams.join(', ')}`);
    }
}

function checkObjReqProps(
    packetObject,
    reqProps,
    checkIfNull = true,
) {

    let missingProps = reqProps.filter(prop => !packetObject.hasOwnProperty(prop));

    if (missingProps.length > 0) {
        throw new MissingObjProps(`missing props: ${missingProps.join(', ')}`);
    }

    let nullProps = reqProps.filter(prop => checkIfNull && isNull(packetObject[prop]));

    if (checkIfNull && nullProps.length > 0) {
        throw new ObjPropsNull(`null props: ${nullProps.join(', ')}`);
    }
}

function checkObjProps(
    packetObject,
    errorOnEmpty = true
) {
    if (errorOnEmpty && isEmpty(packetObject)) {
        throw new EmptyObj();
    }

    let nullProps = Object.keys(packetObject).filter(prop => isNull(packetObject[prop]));

    if (nullProps.length > 0) {
        throw new ObjPropsNull(`null props: ${nullProps.join(', ')}`);
    }
}

function checkSocketStatus(
    socket,
) {
    if (!socket.userdata.connected || isNull(socket.userdata.userID)) {
        throw new SocketStatusErr(`socket status: (connected: ${socket.userdata.connected}, userID: ${socket.userdata.userID})`);
    }
}

module.exports = {
    currDT,
    UUID,
    isNull,
    isNotNull,
    isEmpty,
    bufferToObject,
    objectToBuffer,
    cleanStackTrace,
    logObj,
    logDebug,
    logInfo,
    logWarn,
    logError,
    checkParams,
    checkObjReqProps,
    checkObjProps,
    checkSocketStatus,
};