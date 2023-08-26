
// General Errors
// ==============

class ReqParamsNull extends Error {
    constructor(message) {
        super(message);
        this.name = 'ReqParamsNull';

        Error.captureStackTrace(this, ReqParamsNull);
    }
}

class SocketStatusErr extends Error {
    constructor(message) {
        super(message);
        this.name = 'SocketStatusErr';

        Error.captureStackTrace(this, SocketStatusErr);
    }
}

// JSON Errors
// ===========

class ParseJSONErr extends Error {
    constructor(message = "JSON parsing failed") {
        super(message);
        this.name = 'ParseJSONErr';

        Error.captureStackTrace(this, ParseJSONErr);
    }
}

class JSONBufferErr extends Error {
    constructor(message = "JSON buffer conversion failed") {
        super(message);
        this.name = 'JSONBufferErr';

        Error.captureStackTrace(this, JSONBufferErr);
    }
}

class MissingPacketProps extends Error {
    constructor(message) {
        super(message);
                this.name = 'MissingPacketProps';

        Error.captureStackTrace(this, MissingPacketProps);
    }
}

class PacketPropsNull extends Error {
    constructor(message) {
        super(message);        
        this.name = 'PacketPropsNull';

        Error.captureStackTrace(this, PacketPropsNull);
    }
}

// Database Errors
// ===============

class DBErr extends Error {
    constructor(message) {
        super(message);        
        this.name = 'DBErr';

        Error.captureStackTrace(this, DBErr);
    }
}

class EmptyDBResult extends Error {
    constructor(message) {
        super(message);        
        this.name = 'EmptyDBResult';

        Error.captureStackTrace(this, EmptyDBResult);
    }
}

class MultipleDBResults extends Error {
    constructor(message) {
        super(message);        
        this.name = 'MultipleDBResults';

        Error.captureStackTrace(this, MultipleDBResults);
    }
}

// Function Errors
// ===============

class FuncErr extends Error {
    constructor(message) {
        super(message);        
        this.name = 'FuncErr';

        Error.captureStackTrace(this, FuncErr);
    }
}

// Event Errors
// ============

class EventErr extends Error {
    constructor(message) {
        super(message);        
        this.name = 'EventErr';

        Error.captureStackTrace(this, EventErr);
    }
}

class ClientResponseErr extends Error {
    constructor(message) {
        super(message);        
        this.name = 'ClientResponseErr';

        Error.captureStackTrace(this, ClientResponseErr);
    }
}

module.exports = {
    ReqParamsNull,
    SocketStatusErr,
    MissingPacketProps,
    PacketPropsNull,
    ParseJSONErr,
    JSONBufferErr,
    DBErr,
    EmptyDBResult,
    MultipleDBResults,
    EventErr,
    FuncErr,
    ClientResponseErr,
}