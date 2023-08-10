const { v4: uuidv4 } = require('uuid');

class utilities {

    // Returns the UTC datetime in the format YYYY-MM-DD HH:MM:SS
    get currDT() {
        return new Date().toISOString().replace('T', ' ').replace('Z', '');
    }

    get UUID() {
        return uuidv4();
    }

    handleSuccess(blockName, message, showLogs = true) {
        if (showLogs == true) {
            console.log(`SUCCESS ${this.currDT}: ${blockName} message: (${message})`)
        };
    };

    handleFailure(blockName, err, message, showLogs = true) {
        if (showLogs == true) {
            console.log(`FAILED ${this.currDT}: ${blockName} (${err.message}), message: (${message})`)
        };
    };
}

module.exports = new utilities();