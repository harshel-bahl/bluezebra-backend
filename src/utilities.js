const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

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


// Utility Functions
// =================

function currDT() {
    return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function UUID() {
    return uuidv4();
}

function genRandPassword(
    length = 13
    ) {

    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!£$?%^&*()_+-=<>@#~";

    let password = "";

    for (let i = 0; i < length; ++i) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }

    return password;
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
    error,
    sliceFromTop = 0
) {
    if (!error.stack) return error;

    let stack = error.stack.split('\n');

    const relevantStack = stack.slice(sliceFromTop).filter(line => {
        if (line.includes('(internal/')) return false;

        if (line.includes('node_modules')) return false;

        return true;
    });

    return relevantStack.join('\n');
}

function errToObj(
    error,
    cleanStack = false
) {
    if (error instanceof Error) {

        let errObj = {
            name: error.name,
            message: error.message,
        };

        if (error.stack) {
            if (cleanStack) {
                errObj.stack = cleanStackTrace(error, 1);
            } else {
                errObj.stack = error.stack;
            }
        }

        return errObj
    } else {
        return error;
    }
}

function logObj(
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
    let outputLogObj = {};

    if (isNotNull(func)) outputLogObj.func = func;
    if (isNotNull(event)) outputLogObj.event = event;
    if (isNotNull(error)) outputLogObj.error = errToObj(error, true);
    if (isNotNull(info)) outputLogObj.info = info;
    if (isNotNull(socketID)) outputLogObj.socketID = socketID;
    if (isNotNull(UID)) outputLogObj.UID = UID;
    if (isNotNull(recSocketID)) outputLogObj.recSocketID = recSocketID;
    if (isNotNull(recUID)) outputLogObj.recUID = recUID;
    if (isNotNull(json)) outputLogObj.json = json;

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
    let inputLogObj = logObj(func, event, error, info, socketID, UID, recSocketID, recUID, json);

    let logArgs = [];

    if (message) {
        logArgs.push(message);
    } else {
        logArgs.push('');
    }

    if (!isEmpty(inputLogObj)) logArgs.push(inputLogObj);

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
    let inputLogObj = logObj(func, event, error, info, socketID, UID, recSocketID, recUID, json);

    let logArgs = [];

    if (message) {
        logArgs.push(message);
    } else {
        logArgs.push('');
    }

    if (!isEmpty(inputLogObj)) logArgs.push(inputLogObj);

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
    let inputLogObj = logObj(func, event, error, info, socketID, UID, recSocketID, recUID, json);

    let logArgs = [];

    if (message) {
        logArgs.push(message);
    } else {
        logArgs.push('');
    }

    if (!isEmpty(inputLogObj)) logArgs.push(inputLogObj);

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
    let inputLogObj = logObj(func, event, error, info, socketID, UID, recSocketID, recUID, json);

    let logArgs = [];

    if (message) {
        logArgs.push(message);
    } else {
        logArgs.push('');
    }

    if (!isEmpty(inputLogObj)) logArgs.push(inputLogObj);

    logger.error(...logArgs);
}

function checkParams(
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
    genRandPassword,
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