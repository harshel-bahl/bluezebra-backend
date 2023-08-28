const { io } = require('./server');
const auth = require('./auth');
const db = require('./db');
const ef = require('./ef');
const config = require('./config');
const logger = require('./logger');

const {
    SocketStatusErr,
    MissingObjProps,
    ObjPropsNull,
    ParseJSONErr,
    JSONBufferErr,
    DBErr,
    EmptyDBResult,
    MultipleDBResults,
    EventErr,
    FuncErr,
    ClientResponseErr,
    ...errors
} = require('./error');

const {
    bufferToObject,
    objectToBuffer,
    logDebug,
    logInfo,
    logWarn,
    logError,
    checkParams,
    checkObjReqProps,
    checkObjProps,
    checkSocketStatus,
    ...util
} = require('./utilities');


// Socket Events
// =============

io.on('connection', (socket) => {

    logInfo('socket connection', undefined, 'connection', undefined, undefined, socket.id);

    socket.userdata = {
        socketID: socket.id,
        UID: null,
        connected: null,
        emittedPendingEvents: false
    };

    // checkUsername
    // request operation
    socket.on('checkUsername', async function (data, ack) {
        try {
            checkObjReqProps(data, ["username"]);

            let result = await db.fetchRecords(socket.id, null, "USERS", "username", data.username, undefined, undefined, 1, false, true);

            if (util.isNull(result)) {
                ack(null, true);
            } else {
                ack(null, false);
            };

            logInfo('checked username', undefined, 'checkUsername', undefined, undefined, socket.id);
        } catch (error) {
            logError('failed to check username', undefined, 'checkUsername', error, `username: ${data.username}`, socket.id);
            ack(false);
        }
    });

    // createUser
    // creation operation
    socket.on('createUser', async function (data, ack) {
        try {
            checkObjReqProps(data, ["packet"]);

            var packetObject = bufferToObject(data.packet);

            checkObjReqProps(packetObject, ["UID", "username", "avatar", "creationDate"]);

            try {
                await db.createUser(socket.id, packetObject.UID, packetObject.username, packetObject.avatar, packetObject.creationDate);

                logInfo('created user', undefined, 'createUser', undefined, undefined, socket.id, packetObject.UID);
                ack(null);
            } catch (error) {
                logError('failed to create user', undefined, 'createUser', error, `UID: ${packetObject.UID}`, socket.id);
                ack(false);
            };
        } catch (error) {
            logError('failed to create user', undefined, 'createUser', error, `UID: ${packetObject.UID}`, socket.id);
            ack(false);
        };
    });

    // connectUser
    // Request operation
    // - Checks if user exists in database, if yes then sends null callback, otherwise sends failure to client to clear local storage
    socket.on('connectUser', async function (data, ack) {
        try {
            checkObjReqProps(data, ["UID"]);

            try {
                let userRecord = await db.fetchRecords(socket.id, data.UID, "USERS", {"UID": data.UID}, "UID", undefined, undefined, 1, true);
            } catch (error) {
                logError('failed to connect user', undefined, 'connectUser', error, `UID: ${data.UID}`, socket.id);

                if (error instanceof EmptyDBResult) {
                    ack("user does not exist");
                    throw error;
                } else {
                    throw error;
                }
            }

            auth.connectUser(socket.id, data.UID);

            logInfo('connected user', undefined, 'connectUser', undefined, undefined, socket.id, data.UID);
            ack(null);

            await ef.sendUserConnect(socket.id, userID);

            await ef.emitPendingEvents(socket.id, data.UID, socket, socket.id, data.UID);
        } catch (error) {
            logError('failed to connect user', undefined, 'connectUser', error, `UID: ${data.UID}`, socket.id);
            ack(false);
        }
    });

    socket.on('disconnect', async (reason) => {
        try {
            checkSocketStatus(socket);

            var socketID = socket.id;
            var UID = socket.userdata.UID;

            auth.disconnectUser(socketID, UID);

            try {
                await db.updateRecords(socketID, UID, "USERS", {"UID": UID}, "lastOnline", util.currDT);
            } catch (error) { }

            logInfo('socket disconnect successfully', undefined, 'disconnect', undefined, `reason: ${reason}`, socketID, UID);

            await ef.sendUserDisconnect(socketID, UID, UID);
        } catch (error) {
            logError('failed to disconnect socket properly', undefined, 'disconnect', error, `reason: ${reason}`, socketID, UID);
        }
    });

    // deleteUser
    //
    socket.on('deleteUser', async function (data, ack) {
        try {
            checkSocketStatus(socket);

            checkObjReqProps(data, ["UID"]);

            if (data.UID != socket.userdata.UID) {
                throw new SocketStatusErr("data.UID does not match socket.userdata.UID");
            }

            await ef.sendDeleteUserTrace(socket.id, data.UID, data.UID);

            await ef.deleteUserdata(socket.id, socket.userdata.UID, data.UID);

            auth.disconnectUser(socket.id, data.UID);

            logInfo('deleted user', undefined, 'deleteUser', undefined, `UID: ${data.UID}`, socket.id, data.UID);
            ack(null);
        } catch (error) {
            logger.error(eventErrLog("deleteUser", error, `userID: ${userID}`, socket.id, socket.userdata.userID));
            ack(false);
        }
    });

    // ChannelDC Events
    // ===================

    // fetchRU
    //
    socket.on('fetchRU', async function (data, ack) {
        try {

            checkSocketStatus(socket);

            checkObjReqProps(data, ["UID"]);
            
            let userdata = await db.fetchRecords(socket.id, socket.userdata.UID, "USERS", {"UID": data.UID}, undefined, undefined, undefined, undefined, true, true);

            logInfo('fetched RU', undefined, 'fetchRU', undefined, `UID: ${data.UID}`, socket.id, socket.userdata.UID);
            ack(null, userdata);
        } catch (error) {
            logError('failed to fetch RU', undefined, 'fetchRU', error, `UID: ${data.UID}`, socket.id, socket.userdata.UID);
            ack(false)
        };
    });

    // fetchRUs
    //
    socket.on('fetchRUsByUsername', async function (data, ack) {
        try {

            checkSocketStatus(socket);

            checkObjReqProps(data, ["username"]);

            let userPackets = await db.fetchUsersByUsername(socket.id, socket.userdata.UID, data.username, 15);

            logInfo('fetched RUs', undefined, 'fetchRUsByUsername', undefined, `username: ${data.username}`, socket.id, socket.userdata.UID);
            ack(null, userPackets);
        } catch (error) {
            logError('failed to fetch RUs', undefined, 'fetchRUsByUsername', error, `username: ${data.username}`, socket.id, socket.userdata.UID);
            ack(false);
        }
    });

    // checkRUIDsOnline
    //
    socket.on("checkRUIDsOnline", async function (data, ack) {
        try {

            checkSocketStatus(socket);

            checkObjReqProps(data, ["RUIDs"]);

            let returnRUIDs = await ef.checkRUIDsOnline(socket.id, socket.userdata.UID, RUIDs);

            logInfo('checked RUIDs online', undefined, 'checkRUIDsOnline', undefined, `RUIDCount: ${RUIDs.length}, returnRUIDCount: ${returnRUIDs.length}`, socket.id, socket.userdata.UID);
            ack(null, returnRUIDs);
        } catch (error) {
            logError('failed to check RUIDs online', undefined, 'checkRUIDsOnline', error, `RUIDCount: ${RUIDs.length}`, socket.id, socket.userdata.UID);
            ack(false);
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

            logger.info(eventS("checkCRs", `requestIDCount: ${clientRequestIDs.length}`, socket.id, socket.userdata.userID));
        } catch (error) {
            logger.error(eventErrLog("checkCRs", error, `requestIDCount: ${clientRequestIDs.length}`, socket.id, socket.userdata.userID));
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

            let packetObject = await ef.sendCR(socket.id, socket.userdata.userID, recUID, packetBuffer, ack);

            try {
                await ef.receivedCR(origSocketID, origUID, recUID, packetObject);

                logger.info(eventS("sendCR", undefined, socket.id, socket.userdata.userID, undefined, recUID));
            } catch (error) {
                logger.error(eventErrLog("sendCR", error, `requestID: ${packetObject.requestID}`, socket.id, socket.userdata.userID, undefined, recUID));
            };
        } catch (error) {
            logger.error(eventErrLog("sendCR", error, undefined, socket.id, socket.userdata.userID, undefined, recUID));
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