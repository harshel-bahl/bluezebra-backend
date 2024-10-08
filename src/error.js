
// General Errors
// ==============

class ReqParamsNull extends Error {
    constructor(message) {
        super(`(${message})`);
        this.name = 'ReqParamsNull';

        Error.captureStackTrace(this, ReqParamsNull);
    }
}

class SocketStatusErr extends Error {
    constructor(message) {
        super(`(${message})`);
        this.name = 'SocketStatusErr';

        Error.captureStackTrace(this, SocketStatusErr);
    }
}

// Auth Errors
// ===========

class AuthErr extends Error {
    constructor(message = "authentication failed") {
        super(`(${message})`);
        this.name = 'AuthErr';

        Error.captureStackTrace(this, AuthErr);
    }
}

// JSON Errors
// ===========

class ParseJSONErr extends Error {
    constructor(message = "JSON parsing failed") {
        super(`(${message})`);
        this.name = 'ParseJSONErr';

        Error.captureStackTrace(this, ParseJSONErr);
    }
}

class JSONBufferErr extends Error {
    constructor(message = "JSON buffer conversion failed") {
        super(`(${message})`);
        this.name = 'JSONBufferErr';

        Error.captureStackTrace(this, JSONBufferErr);
    }
}

class EmptyObj extends Error {
    constructor(message) {
        super(`(${message})`);
        this.name = 'EmptyObj';

        Error.captureStackTrace(this, EmptyObj);
    }
}

class MissingObjProps extends Error {
    constructor(message) {
        super(`(${message})`);
                this.name = 'MissingObjProps';

        Error.captureStackTrace(this, MissingObjProps);
    }
}

class ObjPropsNull extends Error {
    constructor(message) {
        super(`(${message})`);        
        this.name = 'ObjPropsNull';

        Error.captureStackTrace(this, ObjPropsNull);
    }
}

// Database Errors
// ===============

class DBErr extends Error {
    constructor(message) {
        super(`(${message})`);        
        this.name = 'DBErr';

        Error.captureStackTrace(this, DBErr);
    }
}

class EmptyDBResult extends Error {
    constructor(message) {
        super(`(${message})`);        
        this.name = 'EmptyDBResult';

        Error.captureStackTrace(this, EmptyDBResult);
    }
}

class MultipleDBResults extends Error {
    constructor(message) {
        super(`(${message})`);        
        this.name = 'MultipleDBResults';

        Error.captureStackTrace(this, MultipleDBResults);
    }
}

// Function Errors
// ===============

class FuncErr extends Error {
    constructor(message) {
        super(`(${message})`);        
        this.name = 'FuncErr';

        Error.captureStackTrace(this, FuncErr);
    }
}

// Event Errors
// ============

class EventErr extends Error {
    constructor(message) {
        super(`(${message})`);        
        this.name = 'EventErr';

        Error.captureStackTrace(this, EventErr);
    }
}

class ClientResponseErr extends Error {
    constructor(message) {
        super(`(${message})`);        
        this.name = 'ClientResponseErr';

        Error.captureStackTrace(this, ClientResponseErr);
    }
}

class EmitErr extends Error {
    constructor(message) {
        super(`(${message})`);
        this.name = 'EmitErr';

        Error.captureStackTrace(this, EmitErr);
    }
}

module.exports = {
    ReqParamsNull,
    SocketStatusErr,
    AuthErr,
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
    EmitErr
}