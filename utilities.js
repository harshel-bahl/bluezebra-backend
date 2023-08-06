
class utilities {
    get currDT() {
        return new Date().toISOString().replace('T', ' ');
    }
}

module.exports = new utilities();