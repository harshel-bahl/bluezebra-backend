
class DBError extends Error {
    constructor(func, message) {
        super(message);
        this.name = 'DBError';
        this.func = func;
    }

    toString() {
        return `${this.name}[func: ${this.func}, info: ${this.message}]`;
    }
}

class FuncError extends Error {
    constructor(func, message) {
        super(message);
        this.name = 'FuncError';
        this.func = func;
    }

    toString() {
        return `${this.name}[func: ${this.func}, info: ${this.message}]`;
    }
}

class EventError extends Error {
    constructor(event, message) {
        super(message);
        this.name = 'EventError';
        this.event = event;
    }

    toString() {
        return `${this.name}[event: ${this.event}, info: ${this.message}]`;
    }
}

class ClientResponseError extends Error {
    constructor(func, message) {
        super(message);
        this.name = 'ClientResponseError';
        this.func = func;
    }

    toString() {
        return `${this.name}[func: ${this.func}, info: ${this.message}]`;
    }
}

module.exports = {
    DBError,
    EventError,
    FuncError,
    ClientResponseError,
}