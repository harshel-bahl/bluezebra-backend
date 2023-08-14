const { v4: uuidv4 } = require('uuid');

class utilities {

    // Returns the UTC datetime in the format YYYY-MM-DD HH:MM:SS
    get currDT() {
        return new Date().toISOString().replace('T', ' ').replace('Z', '');
    }

    get UUID() {
        return uuidv4();
    }

    handleSuccess(blockName, info, showLogs = true) {
        if (showLogs == true) {
            console.log(`SUCCESS ${this.currDT} ${blockName} -- info: (${info})`)
        };
    };

    handleFailure(blockName, err, info, showLogs = true) {
        if (showLogs == true) {
            console.log(`FAILED ${this.currDT} ${blockName} -- err: (${err.message}), info: (${info})`)
        };
    };
}

module.exports = new utilities();