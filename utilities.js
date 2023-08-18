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

    handleEventSuccess(eventName, info = null, showLogs = true) {
        if (showLogs == true) {
            if (info) {
                console.log(`SUCCESS ${this.currDT} -- event: ${eventName}, info: (${info})`);
            } else {
                console.log(`SUCCESS ${this.currDT} -- event: ${eventName}`);
            };
        };
    };

    handleEventFailure(eventName, err, info = null, showLogs = true) {
        if (showLogs == true) {
            if (info) {
                console.log(`FAILED ${this.currDT} -- event: ${eventName}, err: (${err.message}), info: (${info})`);
            } else {
                console.log(`FAILED ${this.currDT} -- event: ${eventName}, err: (${err.message})`);
            };
        };
    };

    handleFuncSuccess(func, info = null, showLogs = true) {
        if (showLogs == true) {
            if (info) {
                console.log(`SUCCESS ${this.currDT} -- func: ${func}, info: (${info})`)
            } else {
                console.log(`SUCCESS ${this.currDT} -- func: ${func}`)
            };
        };
    };

    handleFuncFailure(func, err, info, showLogs = true) {
        if (showLogs == true) {
            if (info) {
                console.log(`FAILED ${this.currDT} -- func: ${func}, err: (${err.message}), info: (${info})`);
            } else {
                console.log(`FAILED ${this.currDT} -- func: ${func}, err: (${err.message})`)
            };
        };
    };

    handleSuccess(info, showLogs = true) {
        if (showLogs == true) {
            console.log(`SUCCESS ${this.currDT} -- info: (${info})`)
        };
    };

    handleFailure(err, info, showLogs = true) {
        if (showLogs == true) {
            console.log(`FAILED ${this.currDT} -- err: (${err.message}), info: (${info})`)
        };
    };
}

module.exports = new utilities();