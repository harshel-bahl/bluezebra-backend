const { v4: uuidv4 } = require('uuid');

class utilities {

    // Returns the UTC datetime in the format YYYY-MM-DD HH:MM:SS
    get currDT() {
        return new Date().toISOString().replace('T', ' ').replace('Z', '');
    }

    get UUID() {
        return uuidv4();
    }

    eventS(
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

    eventF(
        eventName,
        err,
        info = null,
        origSocketID = null,
        origUID = null,
        recSocketID = null,
        recUID = null
    ) {
        let baseS = `event: ${eventName}`;
        let errS = typeof err.toString === 'function' ? `, err: ${err.toString()}` : `, err: null`;
        let infoS = info !== null ? `, info: ${info}` : '';
        let origSocketIDS = origSocketID !== null ? `, origSocketID: ${origSocketID}` : '';
        let origUIDS = origUID !== null ? `, origUID: ${origUID}` : '';
        let recSocketIDS = recSocketID !== null ? `, recSocketID: ${recSocketID}` : '';
        let recUIDS = recUID !== null ? `, recUID: ${recUID}` : '';
    
        return baseS + errS + infoS + origSocketIDS + origUIDS + recSocketIDS + recUIDS;
    }

    funcS(
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
    
    funcF(
        func,
        err,
        info = null,
        origSocketID = null,
        origUID = null,
        recSocketID = null,
        recUID = null
    ) {
        let baseS = `func: ${func}`;
        let errS = typeof err.toString === 'function' ? `, err: ${err.toString()}` : `, err: null`;
        let infoS = info !== null ? `, info: ${info}` : '';
        let origSocketIDS = origSocketID !== null ? `, origSocketID: ${origSocketID}` : '';
        let origUIDS = origUID !== null ? `, origUID: ${origUID}` : '';
        let recSocketIDS = recSocketID !== null ? `, recSocketID: ${recSocketID}` : '';
        let recUIDS = recUID !== null ? `, recUID: ${recUID}` : '';
    
        return baseS + errS + infoS + origSocketIDS + origUIDS + recSocketIDS + recUIDS;
    }
};

module.exports = new utilities();