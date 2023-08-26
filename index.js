const dbC = require('./db');
const eventFuncsC = require('./eventFuncs');
const config = require('./config');
const logger = require('./logger');

const {
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
} = require('./error');

const {
    currDT,
    UUID,
    isNull,
    isNotNull,
    bufferToObject,
    objectToBuffer,
    checkPacketProps,
    checkParams,
    extractStackTrace,
    funcS,
    errLog,
    eventS,
    eventErrLog,
} = require('./utilities');

const app = require('express')();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// const privateKey = fs.readFileSync('path_to/privkey.pem', 'utf8');
// const certificate = fs.readFileSync('path_to/fullchain.pem', 'utf8');
// const ca = fs.readFileSync('path_to/chain.pem', 'utf8');

// const credentials = {
// key: privateKey,
// cert: certificate,
// ca: ca
// };
// const server = https.createServer(credentials, app);

// add JWTs for authentication

let db = new dbC(logger);
let ef = new eventFuncsC(db, logger);

db.connectDB();

function startServer() {
    server.listen(3000, () => {
        logger.info(funcS("startServer", "Server listening on localhost, port 3000"));
    });
}


// connectedUsers
// - userID: socketID
let connectedUsers = {};

io.on('connection', (socket) => {

    logger.info(eventS("connection", undefined, socket.id));

    socket.userdata = {
        socketID: socket.id,
        userID: null,
        connected: null,
        emittedPendingEvents: false
    };

    function connectUser(userID) {
        socket.userdata.userID = userID;
        socket.userdata.connected = true;

        connectedUsers[userID] = {
            socketID: socket.id
        };
    };

    function disconnectUser() {
        delete connectedUsers[socket.userdata.userID];
        socket.userdata.connected = false;
        socket.userdata.userID = null;
    };

    // checkUsername
    // request operation
    socket.on('checkUsername', async function (data, ack) {

        let username = data;

        try {
            checkParams({username: username}, ["username"]);

            let result = await db.fetchRecord(socket.id, null, "USERS", "username", username, undefined, undefined, "userID", false)

            if (result == undefined) {
                ack(null, true);
            } else {
                ack(null, false);
            };

            logger.debug(eventS("checkUsername", `username: ${username}, result: ${result == undefined ? true : false}`, socket.id));
        } catch (error) {
            logger.error(eventErrLog("checkUsername", error, `username: ${username}`, socket.id));
            ack(false);
        }
    });

    // createUser
    // creation operation
    socket.on('createUser', async function (data, ack) {

        let packetBuffer = data.packet

        try {
            if (packetBuffer == null) {
                throw new error.EventError("createUser", `missing required parameters: (packetBuffer: ${packetBuffer})`);
            }

            let packetObject = JSON.parse(packetBuffer.toString());
            let packetProps = ["userID", "username", "avatar", "creationDate"];

            if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw new error.EventError("createUser", `packet property(s) missing: (packetObject: ${packetObject})`);
            } else if (Object.values(packetObject).every(item => item !== null) == false) {
                throw new error.EventError("createUser", `packet property(s) null: (packetObject: ${packetObject})`);
            };

            try {
                await db.createUser(socket.id, packetObject.userID, packetObject.username, packetObject.avatar, packetObject.creationDate);

                logger.info(eventS("createUser", `userID: ${packetObject.userID}`, socket.id));
                ack(null);
            } catch (error) {
                logger.error(eventErrLog("createUser", error, `userID: ${packetObject.userID}`, socket.id));
                ack(false);
            };
        } catch (error) {
            logger.error(eventErrLog("createUser", error, undefined, socket.id));
            ack(false);
        };
    });

    // connectUser
    // Request operation
    // - Checks if user exists in database, if yes then sends null callback, otherwise sends failure to client to clear local storage
    socket.on('connectUser', async function (data, ack) {

        let userID = data.userID;

        try {
            if (userID == null) {
                throw EventErr("connectUser", "userID is null");
            };

            let userRecord = await db.fetchRecords(socket.id, null, "USERS", "userID", userID, "userID", undefined, undefined, 1);

            if (userRecord.length != 1) {
                throw EventErr("connectUser", "user does not exist");
            } else {
                connectUser(userID);
            };

            logger.info(eventS("connectUser", undefined, socket.id, userID));
            ack(null);

            await ef.sendUserOnline(socket.id, userID);

            await ef.emitPendingEvents(socket.id, userID, socket, 1000);
        } catch (error) {
            logger.error(eventErrLog("connectUser", error, undefined, socket.id, userID));
            ack(false);
        };
    });

    socket.on('disconnect', async (reason) => {

        let socketID = socket.id;
        let userID = socket.userdata.userID;

        try {
            if (socket.userdata.connected == false || userID == null) {
                throw EventErr("disconnect", "disconnected or socket.userdata.userID is null");
            };

            disconnectUser();

            try {
                await db.updateRecord(socketID, userID, "USERS", "userID", userID, undefined, undefined, "lastOnline", util.currDT);
            } catch (error) { };

            logger.info(eventS("disconnect", undefined, socketID, userID));

            await ef.sendUserDisconnect(socketID, userID);
        } catch (error) {
            logger.error(eventErrLog("disconnect", error, undefined, socketID, userID));
        };
    });

    // deleteUser
    // deletion operation
    // - Deletes user from database and sends null callback to client
    // - If successful, deleteUserTrace event is emitted to all RUIDs
    // - On receiving ack, if success it's logged, otherwise added to events table for another try later
    socket.on('deleteUser', async function (data, ack) {

        let userID = data.userID;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("deleteUser", "disconnected or socket.userdata.userID is null");
            };

            if (userID == null) {
                throw EventErr("deleteUser", "missing required parameters");
            } else if (userID != socket.userdata.userID) {
                throw EventErr("deleteUser", "userID does not match socket.userdata.userID");
            };

            let RUIDs = await this.db.fetchRUChannelsbyUserID(origUID, "userID");

            await ef.deleteUserdata(socket.socketID, socket.userdata.userID);

            disconnectUser();

            logger.info(eventS("deleteUser", `userID: ${userID}`, socket.socketID, socket.userdata.userID));
            ack(null);

            await ef.sendDeleteUserTrace(socket.socketID, userID, RUIDs);
            
        } catch (error) {
            logger.error(eventErrLog("deleteUser", error, `userID: ${userID}`, socket.socketID, socket.userdata.userID));
            ack(error.message);
        };
    });

    // ChannelDC Events
    // ===================

    // fetchRU
    //
    socket.on('fetchRU', async function (data, ack) {

        let userID = data;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("fetchRU", "disconnected or socket.userdata.userID is null");
            };

            if (userID == null) {
                throw EventErr("fetchRU", "missing required parameters");
            };

            let userdata = await db.fetchRecord(socket.id, socket.userdata.userID, "USERS", "userID", userID)

            logger.info(eventS("fetchRU", `userID: ${userID}`, socket.id, socket.userdata.userID));
            ack(null, userdata);
        } catch (error) {
            logger.error(eventErrLog("fetchRU", error, `userID: ${userID}`, socket.id, socket.userdata.userID));
            ack(error.message)
        };
    });

    // fetchRUs
    //
    socket.on('fetchRUs', async function (data, ack) {

        let username = data;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("fetchRUs", "disconnected or socket.userdata.userID is null");
            };

            if (username == null) {
                throw EventErr("fetchRUs", "missing required parameters");
            };

            let userPackets = await db.fetchUsersByUsername(socket.id, socket.userdata.userID, username, 15);

            logger.info(eventS("fetchRUs", `username: ${username}, resultCount: ${userPackets.length}`, socket.id, socket.userdata.userID));
            ack(null, userPackets);
        } catch (error) {
            logger.error(eventErrLog("fetchRUs", error, `username: ${username}`, socket.id, socket.userdata.userID));
            ack(error.message);
        }
    });

    // checkRUIDsOnline
    //
    socket.on("checkRUIDsOnline", async function (data, ack) {

        let RUIDs = data;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("checkRUIDsOnline", "disconnected or socket.userdata.userID is null");
            };

            if (RUIDs == null) {
                throw EventErr("checkRUIDsOnline", "missing required paramters");
            };

            let returnRUIDs = await ef.checkRUIDsOnline(socket.socketID, socket.userdata.userID, RUIDs);

            logger.info(eventS("checkRUIDsOnline", `RUIDCount: ${RUIDs.length}, returnRUIDCount: ${returnRUIDs.length}`, socket.socketID, socket.userdata.userID));
            ack(null, returnRUIDs);
        } catch (error) {
            logger.error(eventErrLog("checkRUIDsOnline", error, `RUIDCount: ${RUIDs.length}`, socket.socketID, socket.userdata.userID));
            ack(error.message);
        };
    });

    // checkCRs
    //
    socket.on('checkCRs', async function (data, ack) {

        let clientRequestIDs = data.requestIDs;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("checkCRs", "disconnected or socket.userdata.userID is null");
            };

            if (clientRequestIDs == null) {
                throw EventErr("checkCRs", `missing required paramters: (clientRequestIDs: ${clientRequestIDs})`);
            };

            await ef.checkCRs(socket.userdata.userID, socket, clientRequestIDs, ack);

            logger.info(eventS("checkCRs", `requestIDCount: ${clientRequestIDs.length}`, socket.socketID, socket.userdata.userID));
        } catch (error) {
            logger.error(eventErrLog("checkCRs", error, `requestIDCount: ${clientRequestIDs.length}`, socket.socketID, socket.userdata.userID));
            ack(error.message);
        };
    });

    // checkRUChannels
    //
    socket.on('checkRUChannels', async function (data, ack) {

        let channelIDs = data;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("checkRUChannels", "disconnected or socket.userdata.userID is null");
            };

            if (channelIDs == null) {
                throw EventErr("checkRUChannels", "missing required paramters");
            };

            let returnRUChannels = {};

            for (let i = 0; i < channelIDs.length; i++) {
                try {
                    let channel = await db.fetchRecord("RUChannels", "channelID", channelIDs[i], "userID", socket.userdata.userID, "userID", false);

                    if (channel == undefined) {
                        returnRUChannels[channelIDs[i]] = false;
                        throw EventErr("checkRUChannels.checkChannel", "channel not found");
                    };

                    let RUChannel = await db.fetchRUChannelsByChannelID(channelIDs[i], socket.userdata.userID);
                    let RU = await db.fetchRecord("USERS", "userID", RUChannel.userID, undefined, undefined, "userID", false);

                    if (RU == undefined) {
                        await db.deleteRecords("RUChannels", "channelID", channelIDs[i]);
                        returnRUChannels[channelIDs[i]] = false;
                        throw EventErr("checkRUChannels.checkChannel", "RU not found");
                    };
                } catch (error) {
                    util.handleeventErrLogailure("checkRUChannels.checkChannel", error, `channelID: ${channelIDs[i]}`, showLogs);
                };
            };

            util.handleEventSuccess("checkRUChannels", `userID: ${socket.userdata.userID}`, showLogs);
            ack(null, returnRUChannels);
        } catch (error) {
            util.handleeventErrLogailure("checkRUChannels", error, `userID: ${socket.userdata.userID}`, showLogs);
            ack(error.message);
        };
    });

    // checkMissingRUChannels
    //
    socket.on("checkMissingRUChannels", async function (data, ack) {

        let channelIDs = data;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("checkMissingRUChannels", "disconnected or socket.userdata.userID is null");
            };

            if (channelIDs == null) {
                throw EventErr("checkMissingRUChannels", "missing required paramters");
            };

            let serverRUChannels = await db.fetchRUChannelsbyUserID(socket.userdata.userID, "channelID");

            let returnRUChannels = {};
            for (let i = 0; i < serverRUChannels.length; i++) {
                try {
                    if (!channelIDs.includes(serverRUChannels[i])) {
                        let RU = await db.fetchRecord("USERS", "userID", serverRUChannels[i].userID, undefined, undefined, null, false);

                        if (RU == undefined) {
                            await db.deleteRecords("RUChannels", "channelID", serverRUChannels[i].channelID);
                            throw EventErr("checkMissingRUChannels.checkRU", "RU not found");
                        };

                        let jsonBuffer = Buffer.from(JSON.stringify({
                            creationDate: serverRUChannels[i].creationDate,
                            RU: RU
                        }));

                        returnRUChannels[serverRUChannels[i].channelID] = jsonBuffer
                    };
                } catch (error) {
                    util.handleeventErrLogailure("checkMissingRUChannels.checkRU", error, `RUID: ${data[i]}`, showLogs);
                };
            };

            util.handleEventSuccess("checkMissingRUChannels", `userID: ${socket.userdata.userID}`, showLogs);
            ack(null, returnRUChannels);
        } catch (error) {
            util.handleeventErrLogailure("checkMissingRUChannels", error, `userID: ${socket.userdata.userID}`, showLogs);
            ack(error.message);
        };
    });


    

    // sendCR
    // - A CR packet is sent, and an ack is pending to A to create CR objects in its database
    // - CR object is created in database and JSON packet for B is created
    // - CheckOnlineEmit is called to emit event immediately if user is online, otherwise it is stored in events database, and an ack is sent to A after one of these
    //   operations is completed
    // - As long as the event is added to the events database, a successful ack is sent back to A to create the objects, even if the emit times out
    socket.on('sendCR', async function (data, ack) {

        let recUID = data.userID;
        let packetBuffer = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("sendCR", "disconnected or socket.userdata.userID is null");
            };

            if (recUID == null || packetBuffer == null) {
                throw EventErr("sendCR", "missing required parameters");
            };

            let packetObject = await ef.sendCR(socket.socketID, socket.userdata.userID, recUID, packetBuffer, ack);

            try {
                await ef.receivedCR(origSocketID, origUID, recUID, packetObject);

                logger.info(eventS("sendCR", undefined, socket.socketID, socket.userdata.userID, undefined, recUID));
            } catch (error) {
                logger.error(eventErrLog("sendCR", error, `requestID: ${packetObject.requestID}`, socket.socketID, socket.userdata.userID, undefined, recUID));
            };
        } catch (error) {
            logger.error(eventErrLog("sendCR", error, undefined, socket.socketID, socket.userdata.userID, undefined, recUID));
            ack(error.message);
        };
    });

    // sendCRResult
    //
    socket.on('sendCRResult', async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("sendCRResult", "disconnected or socket.userdata.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("sendCRResult", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["requestID", "result", "channelID", "creationDate"];

            if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw EventErr("sendCRResult", "packet property(s) missing");
            } else if (Object.values(packetObject).every(item => item !== null) == false) {
                throw EventErr("sendCRResult", "packet property(s) null");
            };

            if (packetObject.result == true) {
                await db.deleteRecord("CRs", "requestID", packetObject.requestID);

                await db.createRUChannel(packetObject.channelID, socket.userdata.userID, packetObject.creationDate);
                await db.createRUChannel(packetObject.channelID, receivingUserID, packetObject.creationDate);

                ack(null);
                util.handleEventSuccess("sendCRResult", `receivingUserID: ${receivingUserID}`, showLogs);

                try {
                    await CheckOnlineEmit(socket.userdata.userID, receivingUserID, "receivedCRResult", packet, 1000, showLogs);
                } catch (error) {
                    await db.deleteRecords("RUChannels", "channelID", packetObject.channelID);
                };
            } else if (packetObject.result == false) {
                await db.deleteRecord("CRs", "requestID", packetObject.requestID);

                ack(null);
                util.handleEventSuccess("sendCRResult", `receivingUserID: ${receivingUserID}`, showLogs);

                await CheckOnlineEmit(socket.userdata.userID, receivingUserID, "receivedCRResult", packet, 1000, showLogs);
            };
        } catch (error) {
            util.handleeventErrLogailure("sendCRResult", error, `originUserID: ${socket.userdata.userID}, receivingUserID: ${receivingUserID}`, showLogs);
            ack(error.message);
        };
    });

    // sendCD
    //
    socket.on('sendCD', async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("sendCD", "disconnected or socket.userdata.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("sendCD", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["deletionID", "deletionDate", "type", "channelID"];

            if (Object.values(packetObject).every(item => item !== null) == false) {
                throw EventErr("sendCD", "packet property(s) null");
            } else if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw EventErr("sendCD", "packet property(s) missing");
            };

            if (packetObject.type == "clear") {
                await CheckOnlineEmit(socket.userdata.userID, receivingUserID, "receivedCD", packet, 1000, showLogs);

                ack(null);
            } else if (packetObject.type == "delete") {
                await db.deleteRecords("RUChannels", "channelID", packetObject.channelID);
                ack(null);

                await CheckOnlineEmit(socket.userdata.userID, receivingUserID, "receivedCD", packet, 1000, showLogs);
            };

            util.handleEventSuccess("sendCD", `originUserID: ${socket.userdata.userID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleeventErrLogailure("sendCD", error, `originUserID: ${socket.userdata.userID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // sendCDResult
    //
    socket.on('sendCDResult', async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("sendCDResult", "disconnected or socket.userdata.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("sendCDResult", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["deletionID", "userID", "date"];

            if (Object.values(packetObject).every(item => item !== null) == false) {
                throw EventErr("sendCDResult", "packet property(s) null");
            } else if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw EventErr("sendCDResult", "packet property(s) missing");
            };

            await CheckOnlineEmit(socket.userdata.userID, receivingUserID, "receivedCDResult", packet, 1000, showLogs)
            ack(null);
            util.handleEventSuccess("sendCDResult", `originUserID: ${socket.userdata.userID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleeventErrLogailure("sendCDResult", error, `originUserID: ${socket.userdata.userID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // resetChannels
    //
    socket.on("resetChannels", async function (data, ack) {

        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("resetChannels", "disconnected or socket.userdata.userID is null");
            };

            if (packet == null) {
                throw EventErr("resetChannels", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["channelID", "userID", "deletionID", "deletionDate"];

            for (let i = 0; i < packetObject.length; i++) {
                let deletionData = packetObject[i];

                if (packetProps.every(key => deletionData.hasOwnProperty(key)) == false) {
                    EventErr("resetChannels", "packet property(s) missing");
                } else if (Object.values(deletionData).every(item => item !== null) == false) {
                    EventErr("resetChannels", "packet property(s) null");
                };
            };

            for (let i = 0; i < packetObject.length; i++) {
                try {
                    let deletionData = packetObject[i];

                    let CDPacket = {
                        deletionID: deletionData.deletionID,
                        deletionDate: deletionData.deletionDate,
                        type: "clear",
                        channelID: deletionData.channelID
                    };

                    let jsonBuffer = Buffer.from(JSON.stringify(CDPacket));

                    await CheckOnlineEmit(socket.userdata.userID, deletionData.userID, "receivedCD", jsonBuffer, 1000, showLogs);

                    util.handleEventSuccess("resetChannels.receivedCD", `originUserID: ${socket.userdata.userID}, receivingUserID: ${deletionData.userID}`, showLogs);
                } catch {
                    util.handleeventErrLogailure("resetChannels.receivedCD", error, `originUserID: ${socket.userdata.userID}, receivingUserID: ${packetObject[i].userID}`, showLogs);
                };
            };

            ack(null);
            util.handleEventSuccess("resetChannels", `originUserID: ${socket.userdata.userID}`, showLogs);
        } catch (error) {
            util.handleeventErrLogailure("resetChannels", error, `originUserID: ${socket.userdata.userID}`, showLogs);
            ack(error.message);
        };
    });


    // MessageDC Events
    // ================

    // sendMessage
    //
    socket.on('sendMessage', async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("sendMessage", "disconnected or socket.userdata.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("sendMessage", "missing required parameters");
            };

            await CheckOnlineEmit(receivingUserID, "receivedMessage", packet, 1000, showLogs)

            ack(null);

            util.handleEventSuccess("sendMessage", `originUserID: ${socket.userdata.userID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleeventErrLogailure("sendMessage", error, `originUserID: ${socket.userdata.userID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // deliveredMessage
    //
    socket.on('deliveredMessage', async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("deliveredMessage", "disconnected or socket.userdata.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("deliveredMessage", "missing required parameters");
            };

            await CheckOnlineEmit(receivingUserID, "receivedDeliveredMessage", packet, 1000, showLogs)

            ack(null);

            util.handleEventSuccess("deliveredMessage", `originUserID: ${socket.userdata.userID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleeventErrLogailure("deliveredMessage", error, `originUserID: ${socket.userdata.userID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // deleteMessage
    //
    socket.on("deleteMessage", async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("deleteMessage", "disconnected or socket.userdata.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("deleteMessage", "missing required parameters");
            };
        } catch (error) {

        };
    });

    // deleteMessageResult
    //
    socket.on("deleteMessageResult", async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.userID == null) {
                throw EventErr("deleteMessageResult", "disconnected or socket.userdata.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("deleteMessageResult", "missing required parameters");
            };
        } catch (error) {

        };
    });
});


startServer();