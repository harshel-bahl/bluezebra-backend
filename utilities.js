const { v4: uuidv4 } = require('uuid');

class utilities {

    // Returns the UTC datetime in the format YYYY-MM-DD HH:MM:SS
    get currDT() {
        return new Date().toISOString().replace('T', ' ').replace('Z', '');
    }

    get UUID() {
        return uuidv4();
    }

    funcErr(funcName, info) {
        return new Error(`func: ${funcName}, info: ${info}`);
    }

    eventErr(event, info = null, response = null) {
        if (response) {
            return new Error(`event: ${event}, response: ${response}`);
        } else {
            return new Error(`event: ${event}, info: ${info}`);
        };
    };

    eventS(
        eventName,
        info = null,
        origSocketID = null,
        origUID = null,
        recSocketID = null,
        recUID = null
    ) {
        return `event: ${eventName}${info != null ? `, info: ${info}` : ''}${origSocketID != null ? `, origSocketID: ${origSocketID}` : ''}${origUID != null ? `, origUID: ${origUID}` : ''}${recSocketID != null ? `, recSocketID: ${recSocketID}` : ''}${recUID != null ? `, recUID: ${recUID}` : ''}`;
    };

    eventF(
        eventName,
        err,
        info = null,
        origSocketID = null,
        origUID = null,
        recSocketID = null,
        recUID = null
    ) {
        return `event: ${eventName}, err: ${err.message}${info != null ? `, info: ${info}` : ''}${origSocketID != null ? `, origSocketID: ${origSocketID}` : ''}${origUID != null ? `, origUID: ${origUID}` : ''}${recSocketID != null ? `, recSocketID: ${recSocketID}` : ''}${recUID != null ? `, recUID: ${recUID}` : ''}`;
    };

    funcS(
        func,
        info = null,
        origSocketID = null,
        origUID = null,
        recSocketID = null,
        recUID = null) {
        return `func: ${func}${info != null ? `, info: ${info}` : ''}${origSocketID != null ? `, origSocketID: ${origSocketID}` : ''}${origUID != null ? `, origUID: ${origUID}` : ''}${recSocketID != null ? `, recSocketID: ${recSocketID}` : ''}${recUID != null ? `, recUID: ${recUID}` : ''}`;
    };

    funcF(
        func,
        err,
        info = null,
        origSocketID = null,
        origUID = null,
        recSocketID = null,
        recUID = null
    ) {
        return `func: ${func}, err: ${err.message}${info != null ? `, info: ${info}` : ''}${origSocketID != null ? `, origSocketID: ${origSocketID}` : ''}${origUID != null ? `, origUID: ${origUID}` : ''}${recSocketID != null ? `, recSocketID: ${recSocketID}` : ''}${recUID != null ? `, recUID: ${recUID}` : ''}`;
    };
};

module.exports = new utilities();