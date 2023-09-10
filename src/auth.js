const { server, io } = require('./server');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const config = require('./config');
const util = require('./utilities');
const errors = require('./error');

// const privateKey = fs.readFileSync('path_to/privkey.pem', 'utf8');
// const certificate = fs.readFileSync('path_to/fullchain.pem', 'utf8');
// const ca = fs.readFileSync('path_to/chain.pem', 'utf8');

// const credentials = {
// key: privateKey,
// cert: certificate,
// ca: ca
// };
// const server = https.createServer(credentials, app);

// add JWT middleware to io

// connectedUsers
// - userID: { socketID }
let connectedUsers = {};

function hashPassword(
    socketID,
    uID,
    password,
    saltRounds = config.passwordSaltRounds
) {
    return new Promise((resolve, reject) => {
        try {
            util.checkParams({
                password,
                saltRounds
            }, ["password", "saltRounds"]);

            bcrypt.hash(password, saltRounds, (err, hash) => {
                try {
                    if (err) {
                        throw new errors.FuncErr(err.message);
                    } else {
                        util.logDebug("password hashed successfully", "auth.hashPassword", undefined, undefined, `uID: ${uID}, hash: ${hash}`, socketID);
                        resolve(hash);
                    }
                } catch (error) {
                    util.logDebug("failed to hash password", "auth.hashPassword", undefined, error, `uID: ${uID}`, socketID);
                    reject(error);
                }
            });
        } catch (error) {
            util.logDebug("failed to hash password", "auth.hashPassword", undefined, error, `uID: ${uID}`, socketID);
            reject(error);
        }
    });
}

function comparePassword(
    socketID,
    uID,
    password,
    hashedPassword
) {
    return new Promise((resolve, reject) => {
        try {
            util.checkParams({
                password,
                hashedPassword
            }, ["password", "hashedPassword"]);

            bcrypt.compare(password, hashedPassword, (err, result) => {
                try {
                    if (err) {
                        throw errors.FuncErr(err.message);
                    } else {
                        if (result == true) {
                            util.logDebug("authentication successful", "auth.comparePassword", undefined, undefined, undefined, socketID, uID);
                            resolve(true);
                        } else {
                            throw errors.AuthErr("auth failed - passwords don't match");
                        }
                    }
                } catch (error) {
                    util.logDebug("authentication failed", "auth.comparePassword", undefined, error, `uID: ${uID}`, socketID);
                    reject(error);
                }
            });

        } catch (error) {
            util.logDebug("authentication failed", "auth.comparePassword", undefined, error, `uID: ${uID}`, socketID);
            reject(error);
        }
    });
}

async function connectUser(
    socket,
    socketID,
    uID,
    password,
    hashedPassword
) {
    try {
        let authResult = await comparePassword(socketID, uID, password, hashedPassword);

        if (authResult == true) {
            socket.userdata.uID = uID;
            socket.userdata.connected = true;
    
            connectedUsers[uID] = {
                socketID: socketID
            };

            util.logDebug("user connection successful", "auth.connectUser", undefined, undefined, undefined, socketID, uID);
        }
    } catch (error) {
        util.logDebug("user connection failed", "auth.connectUser", undefined, error, `uID: ${uID}`, socketID);
        throw error;
    }
};

function disconnectUser(
    socket,
    socketID,
    uID
) {
    delete connectedUsers[uID];
    socket.userdata.connected = false;
    socket.userdata.uID = null;

    util.logDebug("user disconnection successful", "auth.disconnectUser", undefined, undefined,  undefined, socketID, uID);
};

module.exports = {
    connectedUsers,
    hashPassword,
    comparePassword,
    connectUser,
    disconnectUser,
}