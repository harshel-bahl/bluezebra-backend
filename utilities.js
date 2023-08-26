const { v4: uuidv4 } = require('uuid');
const {
    ReqParamsNull,
    MissingPacketProps,
    PacketPropsNull,
    ParseJSONErr,
    JSONBufferErr,
    DBError,
    EmptyDBResult,
    MultipleDBResults,
    EventError,
    FuncError,
    ClientResponseError,
} = require('./error');


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
        throw new JSONBufferErr(error.message)
    }
}

function checkPacketProps(
    packetObject, 
    reqProps, 
    checkIfNull = true
    ) {

    let missingProps = reqProps.filter(prop => !packetObject.hasOwnProperty(prop));

    if (missingProps.length > 0) {
        throw new MissingPacketProps(`missing props: ${missingProps.join(', ')}`);
    }

    let nullProps = reqProps.filter(prop => checkIfNull && isNull(packetObject[prop]));

    if (checkIfNull && nullProps.length > 0) {
        throw new PacketPropsNull(`null props: ${nullProps.join(', ')}`);
    }
}

function checkParams(
    params,
    reqParams
) {
    let nullParams = reqParams.filter(param => isNull(params[param]));

    if (nullParams.length > 0) {
        throw new ReqParamsNull(`null params: ${nullParams.join(', ')}`);
    }
}

function checkSocketStatus(
    socket
) {
    if (!socket.userdata.connected || isNull(socket.userdata.userID)) {

    }
}

function extractStackTrace(
    message,
    sliceFromTop = 2
) {
    const err = new Error();
    const stackLines = err.stack.split('\n');
    
    const relevantStack = stackLines.slice(sliceFromTop).filter(line => {
        if (line.includes('(internal/')) return false;

        if (line.includes('node_modules')) return false;

        return true;
    });

    const cleanedStack = relevantStack.map(line => line.replace(/^(\s*)at\s+/, '$1')).join('\n');

    return `${message}\n${cleanedStack}`;
}

function funcS(
    func,
    info = null,
    origSocketID = null,
    origUID = null,
    recSocketID = null,
    recUID = null
) {
    let baseS = `func: ${func}`;
    let infoS = info !== null ? `, info: ${info}` : '';
    let origSocketIDS = origSocketID !== null ? `, origSocketID: ${origSocketID}` : '';
    let origUIDS = origUID !== null ? `, origUID: ${origUID}` : '';
    let recSocketIDS = recSocketID !== null ? `, recSocketID: ${recSocketID}` : '';
    let recUIDS = recUID !== null ? `, recUID: ${recUID}` : '';

    return baseS + infoS + origSocketIDS + origUIDS + recSocketIDS + recUIDS;
}

function errLog(
    err,
    info = null,
    origSocketID = null,
    origUID = null,
    recSocketID = null,
    recUID = null
) {
    let infoS = info !== null ? `, info: ${info}` : '';
    let origSocketIDS = origSocketID !== null ? `, origSocketID: ${origSocketID}` : '';
    let origUIDS = origUID !== null ? `, origUID: ${origUID}` : '';
    let recSocketIDS = recSocketID !== null ? `, recSocketID: ${recSocketID}` : '';
    let recUIDS = recUID !== null ? `, recUID: ${recUID}` : '';

    let errS = extractStackTrace(err + infoS + origSocketIDS + origUIDS + recSocketIDS + recUIDS, 3);
    
    return errS
}

function eventS(
    eventName,
    info = null,
    origSocketID = null,
    origUID = null,
    recSocketID = null,
    recUID = null
) {
    let baseS = `event: ${eventName}`;
    let infoS = info !== null ? `, info: ${info}` : '';
    let origSocketIDS = origSocketID !== null ? `, origSocketID: ${origSocketID}` : '';
    let origUIDS = origUID !== null ? `, origUID: ${origUID}` : '';
    let recSocketIDS = recSocketID !== null ? `, recSocketID: ${recSocketID}` : '';
    let recUIDS = recUID !== null ? `, recUID: ${recUID}` : '';

    return baseS + infoS + origSocketIDS + origUIDS + recSocketIDS + recUIDS;
}

function eventErrLog(
    eventName,
    err,
    info = null,
    origSocketID = null,
    origUID = null,
    recSocketID = null,
    recUID = null
) {
    let baseS = `, event: ${eventName}`;
    let infoS = info !== null ? `, info: ${info}` : '';
    let origSocketIDS = origSocketID !== null ? `, origSocketID: ${origSocketID}` : '';
    let origUIDS = origUID !== null ? `, origUID: ${origUID}` : '';
    let recSocketIDS = recSocketID !== null ? `, recSocketID: ${recSocketID}` : '';
    let recUIDS = recUID !== null ? `, recUID: ${recUID}` : '';

    let errS = extractStackTrace(err + baseS + infoS + origSocketIDS + origUIDS + recSocketIDS + recUIDS, 3);

    return errS
}

module.exports = {
    currDT,
    UUID,
    isNull,
    isNotNull,
    bufferToObject,
    objectToBuffer,
    checkPacketProps,
    checkParams,
    extractStackTrace,
    funcS,
    errLog,
    eventS,
    eventErrLog,
};