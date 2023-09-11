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



// Socket Middleware
// =================
// - add token-based authentication to middleware

io.use((socket, next) => {

    socket.userdata = {
        socketID: socket.id,
        uID: null,
        connected: null,
        emittedPendingEvents: false
    };

    next()
});


// Socket Events
// =============


io.on('connection', (socket) => {

    logInfo(undefined, undefined, 'connection', undefined, undefined, socket.id, socket.userdata ? socket.userdata.uID : undefined);

    // connectUser
    // 
    socket.on('connectUser', async function (data, ack) {
        try {

            checkObjReqProps(data, ["uID", "password"]);

            let storedPassword;

            try {
                storedPassword = await db.fetchRecords(socket.id, undefined, "USERS", { "uID": data.uID }, "password", undefined, undefined, 1, undefined, true);
            } catch (error) {
                if (error instanceof EmptyDBResult) {
                    ack("user does not exist");
                    logError('failed to connect user', undefined, 'connectUser', error, `uID: ${data.uID}`, socket.id);
                    return;
                } else {
                    throw error;
                }
            }

            await auth.connectUser(socket, socket.id, data.uID, data.password, storedPassword.password);

            ack(null);

            logInfo('connected user', undefined, 'connectUser', undefined, undefined, socket.id, data.uID);

            await ef.sendUserConnect(socket.id, data.uID);

            await ef.emitPendingEvents(socket.id, data.uID, socket, socket.id, data.uID);
        } catch (error) {
            ack(false);
            logError('failed to connect user', undefined, 'connectUser', error, undefined, socket.id);
        }
    });

    socket.on('disconnect', async (reason) => {
        try {
            checkSocketStatus(socket);

            var socketID = socket.id;
            var uID = socket.userdata.uID;

            auth.disconnectUser(socket, socketID, uID)

            try {
                await db.updateRecords(socketID, uID, "USERS", { "uID": uID }, "lastOnline", util.currDT);
            } catch (error) { }

            logInfo('socket disconnect successfully', undefined, 'disconnect', undefined, `reason: ${reason}`, socketID, uID);

            await ef.sendUserDisconnect(socketID, uID, uID);
        } catch (error) {
            logError('failed to disconnect socket properly', undefined, 'disconnect', error, `reason: ${reason}`, socketID, uID);
        }
    });

    // checkUsername
    // 
    socket.on('checkUsername', async function (data, ack) {
        try {

            checkObjReqProps(data, ["username"]);

            let result = await db.fetchRecords(socket.id, undefined, "USERS", { "username": data.username }, "uID", undefined, undefined, 1);

            if (util.isNull(result)) {
                ack(null, true);
            } else {
                ack(null, false);
            };

            logInfo('checked username', undefined, 'checkUsername', undefined, `username: ${data.username}`, socket.id);
        } catch (error) {
            ack(false);
            logError('failed to check username', undefined, 'checkUsername', error, undefined, socket.id);
        }
    });

    // createUser
    // 
    socket.on('createUser', async function (data, ack) {
        try {

            checkObjReqProps(data, ["packet"]);

            var packetObject = bufferToObject(data.packet);

            checkObjReqProps(packetObject, ["uID", "username", "password", "publicKey", "avatar", "creationDate"]);

            let publicKeyBuffer = Buffer.from(packetObject.publicKey, 'utf8');

            let hashedPassword = await auth.hashPassword(socket.id, packetObject.uID, packetObject.password);

            await db.createUser(
                socket.id,
                packetObject.uID,
                packetObject.username,
                hashedPassword,
                publicKeyBuffer,
                packetObject.avatar,
                packetObject.creationDate
            );

            ack(null);
            logInfo('created user', undefined, 'createUser', undefined, undefined, socket.id, packetObject.uID);
        } catch (error) {
            ack(false);
            logError('failed to create user', undefined, 'createUser', error, undefined, socket.id);
        };
    });

    // deleteUser
    //
    socket.on('deleteUser', async function (data, ack) {
        try {
            checkSocketStatus(socket);

            checkObjReqProps(data, ["uID"]);

            if (data.uID != socket.userdata.uID) {
                throw new SocketStatusErr("data.uID does not match socket.userdata.uID");
            }

            await ef.deleteUserdata(socket.id, socket.userdata.uID, data.uID);

            await ef.sendDeleteUserTrace(socket.id, socket.userdata.uID, data.uID);

            auth.disconnectUser(socket, socket.id, data.UID);

            ack(null);
            logInfo('deleted user', undefined, 'deleteUser', undefined, undefined, socket.id, data.uID);
        } catch (error) {
            ack(false);
            logError("failed to delete user", undefined, "deleteUser", error, undefined, socket.id, socket.userdata.uID);
        }
    });

    // ChannelDC Events
    // ===================

    // fetchRU
    //
    socket.on('fetchRU', async function (data, ack) {
        try {

            checkSocketStatus(socket);

            checkObjReqProps(data, ["uID"]);

            let userdata = await db.fetchRecords(socket.id, socket.userdata.uID, "USERS", { "uID": data.uID }, undefined, undefined, undefined, undefined, true, true);

            ack(null, userdata);

            logInfo('fetched RU', undefined, 'fetchRU', undefined, `uID: ${data.uID}`, socket.id, socket.userdata.uID);
        } catch (error) {
            logError('failed to fetch RU', undefined, 'fetchRU', error, `uID: ${data.uID}`, socket.id, socket.userdata.uID);
            ack(false)
        };
    });

    // fetchRUs
    //
    socket.on('fetchRUsByUsername', async function (data, ack) {
        try {

            checkSocketStatus(socket);

            checkObjReqProps(data, ["username"]);

            let userPackets = await db.fetchUsersByUsername(socket.id, socket.userdata.uID, data.username, 15);

            ack(null, userPackets);

            logInfo('fetched RUs', undefined, 'fetchRUsByUsername', undefined, `username: ${data.username}`, socket.id, socket.userdata.uID);
        } catch (error) {
            logError('failed to fetch RUs', undefined, 'fetchRUsByUsername', error, `username: ${data.username}`, socket.id, socket.userdata.uID);
            ack(false);
        }
    });

    // checkRUIDsOnline
    //
    socket.on("checkRUIDsOnline", async function (data, ack) {
        try {

            checkSocketStatus(socket);

            checkObjReqProps(data, ["RUIDs"]);

            let returnRUIDs = await ef.checkRUIDsOnline(socket.id, socket.userdata.uID, RUIDs);

            ack(null, returnRUIDs);

            logInfo('checked RUIDs online', undefined, 'checkRUIDsOnline', undefined, `RUIDCount: ${RUIDs.length}, returnRUIDCount: ${returnRUIDs.length}`, socket.id, socket.userdata.uID);
        } catch (error) {
            logError('failed to check RUIDs online', undefined, 'checkRUIDsOnline', error, `RUIDCount: ${RUIDs.length}`, socket.id, socket.userdata.uID);
            ack(false);
        };
    });

    // checkCRs
    //
    socket.on('checkCRs', async function (data, ack) {
        try {

            checkSocketStatus(socket);

            checkObjReqProps(data, ["requestIDs"]);

            await ef.checkDeletedCRs(socket.id, socket.userdata.uID, socket, socket.id, socket.userdata.uID, data.requestIDs, ack);

            await ef.sendMissingCRs(socket.id, socket.userdata.uID, socket, socket.id, socket.userdata.uID, data.requestIDs);

            logInfo("successfully checked CRs", undefined, "checkCRs", undefined, `requestIDCount: ${data.requestIDs.length}`, socket.id, socket.userdata.uID);
        } catch (error) {
            logError("failed to check CRs", undefined, "checkCRs", error, undefined, socket.id, socket.userdata.uID);
            ack();
        };
    });

    // checkRUChannels
    //
    socket.on('checkRUChannels', async function (data, ack) {

        let channelIDs = data;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("checkRUChannels", "disconnected or socket.userdata.uID is null");
            };

            if (channelIDs == null) {
                throw EventErr("checkRUChannels", "missing required paramters");
            };

            let returnRUChannels = {};

            for (let i = 0; i < channelIDs.length; i++) {
                try {
                    let channel = await db.fetchRecord("RUChannels", "channelID", channelIDs[i], "uID", socket.userdata.uID, "uID", false);

                    if (channel == undefined) {
                        returnRUChannels[channelIDs[i]] = false;
                        throw EventErr("checkRUChannels.checkChannel", "channel not found");
                    };

                    let RUChannel = await db.fetchRUChannelsByChannelID(channelIDs[i], socket.userdata.uID);
                    let RU = await db.fetchRecord("USERS", "uID", RUChannel.uID, undefined, undefined, "uID", false);

                    if (RU == undefined) {
                        await db.deleteRecords("RUChannels", "channelID", channelIDs[i]);
                        returnRUChannels[channelIDs[i]] = false;
                        throw EventErr("checkRUChannels.checkChannel", "RU not found");
                    };
                } catch (error) {
                    util.handleeventErrLogailure("checkRUChannels.checkChannel", error, `channelID: ${channelIDs[i]}`, showLogs);
                };
            };

            util.handleEventSuccess("checkRUChannels", `uID: ${socket.userdata.uID}`, showLogs);
            ack(null, returnRUChannels);
        } catch (error) {
            util.handleeventErrLogailure("checkRUChannels", error, `uID: ${socket.userdata.uID}`, showLogs);
            ack(error.message);
        };
    });

    // checkMissingRUChannels
    //
    socket.on("checkMissingRUChannels", async function (data, ack) {

        let channelIDs = data;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("checkMissingRUChannels", "disconnected or socket.userdata.uID is null");
            };

            if (channelIDs == null) {
                throw EventErr("checkMissingRUChannels", "missing required paramters");
            };

            let serverRUChannels = await db.fetchRUChannelsbyUserID(socket.userdata.uID, "channelID");

            let returnRUChannels = {};
            for (let i = 0; i < serverRUChannels.length; i++) {
                try {
                    if (!channelIDs.includes(serverRUChannels[i])) {
                        let RU = await db.fetchRecord("USERS", "uID", serverRUChannels[i].uID, undefined, undefined, null, false);

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

            util.handleEventSuccess("checkMissingRUChannels", `uID: ${socket.userdata.uID}`, showLogs);
            ack(null, returnRUChannels);
        } catch (error) {
            util.handleeventErrLogailure("checkMissingRUChannels", error, `uID: ${socket.userdata.uID}`, showLogs);
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

        let recUID = data.uID;
        let packetBuffer = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("sendCR", "disconnected or socket.userdata.uID is null");
            };

            if (recUID == null || packetBuffer == null) {
                throw EventErr("sendCR", "missing required parameters");
            };

            let packetObject = await ef.sendCR(socket.id, socket.userdata.uID, recUID, packetBuffer, ack);

            try {
                await ef.receivedCR(origSocketID, origUID, recUID, packetObject);

                logger.info(eventS("sendCR", undefined, socket.id, socket.userdata.uID, undefined, recUID));
            } catch (error) {
                logger.error(eventErrLog("sendCR", error, `requestID: ${packetObject.requestID}`, socket.id, socket.userdata.uID, undefined, recUID));
            };
        } catch (error) {
            logger.error(eventErrLog("sendCR", error, undefined, socket.id, socket.userdata.uID, undefined, recUID));
            ack(error.message);
        };
    });

    // sendCRResult
    //
    socket.on('sendCRResult', async function (data, ack) {

        let receivingUserID = data.uID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("sendCRResult", "disconnected or socket.userdata.uID is null");
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

                await db.createRUChannel(packetObject.channelID, socket.userdata.uID, packetObject.creationDate);
                await db.createRUChannel(packetObject.channelID, receivingUserID, packetObject.creationDate);

                ack(null);
                util.handleEventSuccess("sendCRResult", `receivingUserID: ${receivingUserID}`, showLogs);

                try {
                    await CheckOnlineEmit(socket.userdata.uID, receivingUserID, "receivedCRResult", packet, 1000, showLogs);
                } catch (error) {
                    await db.deleteRecords("RUChannels", "channelID", packetObject.channelID);
                };
            } else if (packetObject.result == false) {
                await db.deleteRecord("CRs", "requestID", packetObject.requestID);

                ack(null);
                util.handleEventSuccess("sendCRResult", `receivingUserID: ${receivingUserID}`, showLogs);

                await CheckOnlineEmit(socket.userdata.uID, receivingUserID, "receivedCRResult", packet, 1000, showLogs);
            };
        } catch (error) {
            util.handleeventErrLogailure("sendCRResult", error, `originUserID: ${socket.userdata.uID}, receivingUserID: ${receivingUserID}`, showLogs);
            ack(error.message);
        };
    });

    // sendCD
    //
    socket.on('sendCD', async function (data, ack) {

        let receivingUserID = data.uID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("sendCD", "disconnected or socket.userdata.uID is null");
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
                await CheckOnlineEmit(socket.userdata.uID, receivingUserID, "receivedCD", packet, 1000, showLogs);

                ack(null);
            } else if (packetObject.type == "delete") {
                await db.deleteRecords("RUChannels", "channelID", packetObject.channelID);
                ack(null);

                await CheckOnlineEmit(socket.userdata.uID, receivingUserID, "receivedCD", packet, 1000, showLogs);
            };

            util.handleEventSuccess("sendCD", `originUserID: ${socket.userdata.uID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleeventErrLogailure("sendCD", error, `originUserID: ${socket.userdata.uID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // sendCDResult
    //
    socket.on('sendCDResult', async function (data, ack) {

        let receivingUserID = data.uID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("sendCDResult", "disconnected or socket.userdata.uID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("sendCDResult", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["deletionID", "uID", "date"];

            if (Object.values(packetObject).every(item => item !== null) == false) {
                throw EventErr("sendCDResult", "packet property(s) null");
            } else if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw EventErr("sendCDResult", "packet property(s) missing");
            };

            await CheckOnlineEmit(socket.userdata.uID, receivingUserID, "receivedCDResult", packet, 1000, showLogs)
            ack(null);
            util.handleEventSuccess("sendCDResult", `originUserID: ${socket.userdata.uID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleeventErrLogailure("sendCDResult", error, `originUserID: ${socket.userdata.uID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // resetChannels
    //
    socket.on("resetChannels", async function (data, ack) {

        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("resetChannels", "disconnected or socket.userdata.uID is null");
            };

            if (packet == null) {
                throw EventErr("resetChannels", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["channelID", "uID", "deletionID", "deletionDate"];

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

                    await CheckOnlineEmit(socket.userdata.uID, deletionData.uID, "receivedCD", jsonBuffer, 1000, showLogs);

                    util.handleEventSuccess("resetChannels.receivedCD", `originUserID: ${socket.userdata.uID}, receivingUserID: ${deletionData.uID}`, showLogs);
                } catch {
                    util.handleeventErrLogailure("resetChannels.receivedCD", error, `originUserID: ${socket.userdata.uID}, receivingUserID: ${packetObject[i].uID}`, showLogs);
                };
            };

            ack(null);
            util.handleEventSuccess("resetChannels", `originUserID: ${socket.userdata.uID}`, showLogs);
        } catch (error) {
            util.handleeventErrLogailure("resetChannels", error, `originUserID: ${socket.userdata.uID}`, showLogs);
            ack(error.message);
        };
    });


    // MessageDC Events
    // ================

    // sendMessage
    //
    socket.on('sendMessage', async function (data, ack) {

        let receivingUserID = data.uID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("sendMessage", "disconnected or socket.userdata.uID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("sendMessage", "missing required parameters");
            };

            await CheckOnlineEmit(receivingUserID, "receivedMessage", packet, 1000, showLogs)

            ack(null);

            util.handleEventSuccess("sendMessage", `originUserID: ${socket.userdata.uID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleeventErrLogailure("sendMessage", error, `originUserID: ${socket.userdata.uID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // deliveredMessage
    //
    socket.on('deliveredMessage', async function (data, ack) {

        let receivingUserID = data.uID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("deliveredMessage", "disconnected or socket.userdata.uID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("deliveredMessage", "missing required parameters");
            };

            await CheckOnlineEmit(receivingUserID, "receivedDeliveredMessage", packet, 1000, showLogs)

            ack(null);

            util.handleEventSuccess("deliveredMessage", `originUserID: ${socket.userdata.uID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleeventErrLogailure("deliveredMessage", error, `originUserID: ${socket.userdata.uID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // deleteMessage
    //
    socket.on("deleteMessage", async function (data, ack) {

        let receivingUserID = data.uID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("deleteMessage", "disconnected or socket.userdata.uID is null");
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

        let receivingUserID = data.uID;
        let packet = data.packet;

        try {
            if (socket.userdata.connected == false || socket.userdata.uID == null) {
                throw EventErr("deleteMessageResult", "disconnected or socket.userdata.uID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw EventErr("deleteMessageResult", "missing required parameters");
            };
        } catch (error) {

        };
    });
});