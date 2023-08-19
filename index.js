const app = require('express')();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const util = require('./utilities');
const dbClass = require('./db');

// io.use((socket, next) => {
//     let token = socket.handshake.auth.token;

//     next();
// });

let showLogs = true;
let timeoutLength = 1000;

let db = new dbClass(showLogs);

db.connect();

let connectedUsers = {};

io.on('connection', (socket) => {

    util.handleEventSuccess("connection", `socketID: ${socket.id}`, showLogs);

    socket.userData = {
        socketID: socket.id,
        userID: null,
        connected: null
    };

    function EmitEvent(receivingSocket, eventName, packet, timeoutLength) {
        return new Promise((resolve, reject) => {
            try {
                if (receivingSocket == null || eventName == null || timeoutLength == null) {
                    throw util.funcErr("EmitEvent", "missing required parameters");
                } else {
                    receivingSocket.timeout(timeoutLength).emit(eventName, packet, async (err, response) => {
                        try {
                            if (err) {
                                throw util.funcErr("EmitEvent", err.message);
                            } else if (response != null) {
                                throw util.funcErr("EmitEvent", response);
                            } else {
                                util.handleFuncSuccess("EmitEvent", `eventName: ${eventName}`, showLogs);
                                resolve();
                            };
                        } catch (error) {
                            util.handleFuncFailure("EmitEvent", error, `eventName: ${eventName}`, showLogs);
                            reject(error);
                        };
                    });
                };
            } catch (error) {
                util.handleFuncFailure("EmitEvent", error, `eventName: ${eventName}`, showLogs);
                reject(error);
            };
        });
    };

    async function CheckOnlineEmit(originUserID, receivingUserID, eventName, packet = null, timeoutLength, showLogs = true) {
        try {
            if (originUserID == null || receivingUserID == null || eventName == null || timeoutLength == null) {
                throw util.funcErr("CheckOnlineEmit", "missing required parameters");
            } else {
                if (receivingUserID in connectedUsers) {
                    try {
                        let receivingSocketID = connectedUsers[receivingUserID].socketID;
                        let receivingSocket = await io.in(receivingSocketID).fetchSockets();

                        if (receivingSocket.length == 0) {
                            throw util.funcErr("CheckOnlineEmit", "receivingSocket not found");
                        } else if (receivingSocket.length > 1) {
                            throw util.funcErr("CheckOnlineEmit", "multiple receivingSockets found");
                        } else {
                            await EmitEvent(receivingSocket[0], eventName, packet, timeoutLength);

                            util.handleFuncSuccess("CheckOnlineEmit", `eventName: ${eventName}, receivingUserID: ${receivingUserID}`, showLogs);
                        };
                    } catch (error) {
                        if (error.message != `event: ${eventName}, info: operation has timed out`) {
                            throw error;
                        }

                        await db.createEvent(eventName, util.currDT, originUserID, receivingUserID, packet);

                        util.handleFuncSuccess("CheckOnlineEmit", `eventName: ${eventName}, receivingUserID: ${receivingUserID}`, showLogs);
                    };
                } else {
                    await db.createEvent(eventName, util.currDT, originUserID, receivingUserID, packet);

                    util.handleFuncSuccess("CheckOnlineEmit", `eventName: ${eventName}, receivingUserID: ${receivingUserID}`, showLogs);
                };
            };
        } catch (error) {
            util.handleFuncFailure("CheckOnlineEmit", error, `eventName: ${eventName}, receivingUserID: ${receivingUserID}`, showLogs);
            throw error;
        };
    };

    async function EmitPendingEvents(userID, receivingSocket, timeoutLength, showLogs = true) {
        try {
            if (userID == null || receivingSocket == null || timeoutLength == null) {
                throw util.funcErr("EmitPendingEvents", "missing required parameters");
            } else {

                let pendingEvents = await db.fetchRecords('EVENTS', 'receivingUserID', userID, ['eventID', 'eventName', 'packet'], 'datetime');

                for (let i = 0; i < pendingEvents.length; i++) {
                    let eventID = pendingEvents[i].eventID;
                    let eventName = pendingEvents[i].eventName;
                    let packet = pendingEvents[i].packet;

                    try {
                        await EmitEvent(receivingSocket, eventName, packet, timeoutLength);
                        await db.deleteRecord("EVENTS", "eventID", eventID);
                    } catch (error) {
                        if (error.message != `event: ${eventName}, info: operation has timed out`) {
                            await db.deleteRecord("EVENTS", "eventID", eventID);
                        };
                    };
                };

                await EmitEvent(socket, "receivedPendingEvents", null, 1000)

                util.handleFuncSuccess("EmitPendingEvents", `userID: ${userID}`, showLogs);
            }
        } catch (error) {
            util.handleFuncFailure("EmitPendingEvents", error, `userID: ${userID}`, showLogs);
            throw error;
        };
    };

    async function DeleteUserData(userID) {
        try {
            await db.deleteCRsByUserID(userID);

            await db.deleteRUChannelsByUserID(userID);

            await db.deleteRecords("EVENTS", "receivingUserID", userID);

            await db.deleteRecord("USERS", "userID", userID);

            util.handleFuncSuccess("DeleteUserData", `userID: ${userID}`, showLogs);
        } catch (error) {
            util.handleFuncFailure("DeleteUserData", error, `userID: ${userID}`, showLogs);
            throw error;
        }
    };

    function ConnectUser(userID) {
        socket.userData.userID = userID;
        socket.userData.connected = true;

        connectedUsers[userID] = {
            socketID: socket.id
        };
    };

    function DisconnectUser() {
        delete connectedUsers[socket.userData.userID];
        socket.userData.connected = false;
        socket.userData.userID = null;
    };

    // checkUsername
    // request operation
    socket.on('checkUsername', async function (data, ack) {

        let username = data;

        try {
            if (username == null || username == "") {
                throw util.eventErr("checkUsername", "username is missing");
            };

            let result = await db.fetchRecord("USERS", "username", username, undefined, undefined, "userID", false)

            if (result == undefined) {
                ack(null, true);
            } else {
                ack(null, false);
            };

            util.handleEventSuccess("checkUsername", `username: ${username}, result: ${result == undefined ? true : false}`, showLogs);
        } catch (error) {
            util.handleEventFailure("checkUsername", error, `username: ${username}`, showLogs);
            ack(error.message);
        }
    });

    // createUser
    // creation operation
    socket.on('createUser', async function (data, ack) {

        let packet = data.packet

        try {
            if (packet == null) {
                throw util.eventErr("createUser", "packet is null");
            }

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["userID", "username", "avatar", "creationDate"];

            if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw util.eventErr("createUser", "packet property(s) missing");
            } else if (Object.values(packetObject).every(item => item !== null) == false) {
                throw util.eventErr("createUser", "packet property(s) null");
            }

            try {
                await db.createUser(
                    packetObject.userID,
                    packetObject.username,
                    packetObject.avatar,
                    packetObject.creationDate
                );

                util.handleEventSuccess("createUser", `userID: ${packetObject.userID}`, showLogs);
                ack(null);
            } catch (error) {
                util.handleEventFailure("createUser", error, `userID: ${packetObject.userID}`, showLogs);
                ack(error.message);
            };
        } catch (error) {
            util.handleEventFailure("createUser", error, `socketID: ${socket.socketID}`, showLogs);
            ack(error.message);
        };
    });

    // connectUser
    // Request operation
    // - Checks if user exists in database, if yes then sends null callback, otherwise sends failure to client to clear local storage
    socket.on('connectUser', async function (data, ack) {

        let userID = data.userID;

        try {
            if (userID == null) {
                throw util.eventErr("connectUser", "userID is null");
            };

            let userRecord = await db.fetchRecords("USERS", "userID", userID, "userID", undefined, undefined, 1);

            if (userRecord.length != 1) {
                throw util.eventErr("connectUser", "user does not exist");
            } else {
                ConnectUser(userID);
            };

            util.handleEventSuccess("connectUser", `userID: ${userID}`, showLogs);
            ack(null);

            try {
                let RUIDs = await db.fetchRUChannelsbyUserID(userID, "userID");

                for (let i = 0; i < RUIDs.length; i++) {
                    try {
                        let RUID = RUIDs[i].userID;

                        if (RUID in connectedUsers) {
                            let receivingSocketID = connectedUsers[RUID].socketID;
                            io.to(receivingSocketID).emit('userOnline', userID);
                        };

                        util.handleEventSuccess("connectUser.userOnline", `RUID: ${RUID}`, showLogs);
                    } catch (error) {
                        util.handleEventFailure("connectUser.userOnline", error, `RUID: ${RUIDs[i].userID}`, showLogs);
                    };
                };
            } catch (error) {
                util.handleEventFailure("connectUser.userOnline", error, `userID: ${userID}`, showLogs);
            };

            try {
                await EmitPendingEvents(userID, socket, 1000, true);
            } catch (error) {

            };
        } catch (error) {
            util.handleEventFailure("connectUser", error, `socketID: ${socket.socketID}, userID: ${userID}`, showLogs);
            ack(error.message);
        };
    });

    socket.on('disconnect', async function () {

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("disconnect", "disconnected or socket.userData.userID is null");
            };

            DisconnectUser();

            await db.updateRecord("USERS", "userID", socket.userData.userID, undefined, undefined, "lastOnline", util.currDT);

            let RUChannels = await db.fetchRUChannelsbyUserID(socket.userData.userID);
            let RUIDs = RUChannels.map(channel => channel.userID);

            util.handleEventSuccess("disconnect", `userID: ${userID}`, showLogs);

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    if (RUIDs[i] in connectedUsers) {
                        let receivingSocketID = connectedUsers[RUIDs[i]].socketID;
                        io.to(receivingSocketID).emit("userDisconnected", socket.userData.userID);
                    };

                    util.handleEventSuccess("disconnect.userDisconnected", `RUID: ${RUIDs[i]}`, showLogs);
                } catch (error) {
                    util.handleEventFailure("disconnect.userDisconnected", error, `RUID: ${RUIDs[i]}`, showLogs);
                };
            };
        } catch (error) {
            util.handleEventFailure("disconnect", error, `socketID: ${socket.socketID}, userID: ${socket.userData.userID}`, showLogs);
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
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("deleteUser", "disconnected or socket.userData.userID is null");
            };

            if (userID == null) {
                throw util.eventErr("deleteUser", "missing required parameters");
            } else if (userID != socket.userData.userID) {
                throw util.eventErr("deleteUser", "userID does not match socket.userData.userID");
            };

            let RUChannelRecords = await db.fetchRUChannelsbyUserID(userID, "userID");
            let RUIDs = RUChannelRecords.map(channel => channel.userID);

            await DeleteUserData(userID);

            DisconnectUser();

            util.handleSuccess("deleteUser", `userID: ${userID}`, showLogs);
            ack(null);

            let eventName = "deleteUserTrace";
            let deletionPacket = { "userID": userID };
            let jsonBuffer = Buffer.from(JSON.stringify(deletionPacket))
            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await CheckOnlineEmit(userID, RUIDs[i], eventName, jsonBuffer, 1000);
                } catch {

                };
            };
        } catch (error) {
            util.handleEventFailure("deleteUser", error, `userID: ${userID}`, showLogs);
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
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("fetchRU", "disconnected or socket.userData.userID is null");
            };

            if (userID == null) {
                throw util.eventErr("fetchRU", "missing required parameters");
            };

            let user = await db.fetchRecord("USERS", "userID", userID)

            util.handleEventSuccess("fetchRU", `userID: ${userID}`, showLogs);
            ack(null, user);
        } catch (error) {
            util.handleEventFailure("fetchRU", error, `originUserID: ${socket.userData.userID}, userID: ${userID}`, showLogs);
            ack(error.message)
        };
    });

    // fetchRUs
    //
    socket.on('fetchRUs', async function (data, ack) {

        let username = data;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("fetchRUs", "disconnected or socket.userData.userID is null");
            };

            if (username == null) {
                throw util.eventErr("fetchRUs", "missing required parameters");
            };

            let userPackets = await db.fetchUsersByUsername(username);

            util.handleEventSuccess("fetchRUs", `username: ${username}, resultCount: ${userPackets.length}`, showLogs);
            ack(null, userPackets);
        } catch (error) {
            util.handleEventFailure("fetchRUs", error, `username: ${username}`, showLogs);
            ack(error.message);
        }
    });

    // checkCRs
    //
    socket.on('checkCRs', async function (data, ack) {

        let clientRequestIDs = data.requestIDs;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("checkCRs", "disconnected or socket.userData.userID is null");
            };

            if (clientRequestIDs == null) {
                throw util.eventErr("checkCRs", "missing required paramters");
            };

            let serverRequestIDs = await db.fetchCRsByUserID(socket.userData.userID, "requestID");

            let returnCRs = {};
            for (let i = 0; i < clientRequestIDs.length; i++) {
                if (!serverRequestIDs.includes(clientRequestIDs[i])) {
                    returnCRs[clientRequestIDs[i]] = false;
                }
            };

            for (let i = 0; i < serverRequestIDs.length; i++) {
                if (!clientRequestIDs.includes(serverRequestIDs[i])) {
                    try {
                        let CR = await db.fetchRecord("CRs", "requestID", serverRequestIDs[i]);

                        let packet = {
                            requestID: CR.requestID,
                            date: CR.requestDate
                        };

                        if (CR.originUserID != socket.userData.userID && CR.receivingUserID == socket.userData.userID) {
                            let RU = await db.fetchRecord("USERS", "userID", CR.originUserID);

                            let RUPacket = {
                                userID: RU.userID,
                                username: RU.username,
                                avatar: RU.avatar,
                                creationDate: RU.creationDate
                            };
                            packet.originUser = RUPacket;

                            returnCRs[serverRequestIDs[i]] = {
                                isOrigin: false,
                                packet: packet
                            };
                        } else if (CR.originUserID == socket.userData.userID && CR.receivingUserID != socket.userData.userID) {
                            let RU = await db.fetchRecord("USERS", "userID", CR.receivingUserID);

                            let RUPacket = {
                                userID: RU.userID,
                                username: RU.username,
                                avatar: RU.avatar,
                                creationDate: RU.creationDate
                            };
                            packet.originUser = RUPacket;

                            returnCRs[serverRequestIDs[i]] = {
                                isOrigin: true,
                                packet: packet
                            };
                        };
                    } catch (error) {
                        if (error.message == "db.fetchRecord - err: no results") {
                            try {
                                await db.deleteRecord("CRs", "requestID", serverRequestIDs[i])
                            } catch {

                            };
                        };
                    };
                };
            };

            ack(null, returnCRs);
            util.handleEventSuccess("checkCRs", `userID: ${socket.userData.userID}`, showLogs);
        } catch (error) {
            util.handleEventFailure("checkCRs", error, `userID: ${socket.userData.userID}`, showLogs);
            ack(error.message);
        };
    });

    // checkRUChannels
    //
    socket.on('checkRUChannels', async function (data, ack) {

        let channelIDs = data;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("checkRUChannels", "disconnected or socket.userData.userID is null");
            };

            if (channelIDs == null) {
                throw util.eventErr("checkRUChannels", "missing required paramters");
            };

            let returnRUChannels = {};

            for (let i = 0; i < channelIDs.length; i++) {
                try {
                    let channel = await db.fetchRecord("RUChannels", "channelID", channelIDs[i], "userID", socket.userData.userID, "userID", false);

                    if (channel == undefined) {
                        returnRUChannels[channelIDs[i]] = false;
                        throw util.eventErr("checkRUChannels.checkChannel", "channel not found");
                    };

                    let RUChannel = await db.fetchRUChannelsByChannelID(channelIDs[i], socket.userData.userID);
                    let RU = await db.fetchRecord("USERS", "userID", RUChannel.userID, undefined, undefined, "userID", false);

                    if (RU == undefined) {
                        await db.deleteRecords("RUChannels", "channelID", channelIDs[i]);
                        returnRUChannels[channelIDs[i]] = false;
                        throw util.eventErr("checkRUChannels.checkChannel", "RU not found");
                    };
                } catch (error) {
                    util.handleEventFailure("checkRUChannels.checkChannel", error, `channelID: ${channelIDs[i]}`, showLogs);
                };
            };

            util.handleEventSuccess("checkRUChannels", `userID: ${socket.userData.userID}`, showLogs);
            ack(null, returnRUChannels);
        } catch (error) {
            util.handleEventFailure("checkRUChannels", error, `userID: ${socket.userData.userID}`, showLogs);
            ack(error.message);
        };
    });

    // checkMissingRUChannels
    //
    socket.on("checkMissingRUChannels", async function (data, ack) {

        let channelIDs = data;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("checkMissingRUChannels", "disconnected or socket.userData.userID is null");
            };

            if (channelIDs == null) {
                throw util.eventErr("checkMissingRUChannels", "missing required paramters");
            };

            let serverRUChannels = await db.fetchRUChannelsbyUserID(socket.userData.userID, "channelID");

            let returnRUChannels = {};
            for (let i = 0; i < serverRUChannels.length; i++) {
                try {
                    if (!channelIDs.includes(serverRUChannels[i])) {
                        let RU = await db.fetchRecord("USERS", "userID", serverRUChannels[i].userID, undefined, undefined, null, false);

                        if (RU == undefined) {
                            await db.deleteRecords("RUChannels", "channelID", serverRUChannels[i].channelID);
                            throw util.eventErr("checkMissingRUChannels.checkRU", "RU not found");
                        };

                        returnRUChannels[serverRUChannels[i].channelID] = {
                            creationDate: serverRUChannels[i].creationDate,
                            RU: RU
                        };
                    };
                } catch (error) {
                    util.handleEventFailure("checkMissingRUChannels.checkRU", error, `RUID: ${data[i]}`, showLogs);
                };
            };

            util.handleEventSuccess("checkMissingRUChannels", `userID: ${socket.userData.userID}`, showLogs);
            ack(null, returnRUChannels);
        } catch (error) {
            util.handleEventFailure("checkMissingRUChannels", error, `userID: ${socket.userData.userID}`, showLogs);
            ack(error.message);
        };
    });

    // checkOnline
    //
    socket.on("checkOnline", async function (data, ack) {

        let userIDs = data;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("checkOnline", "disconnected or socket.userData.userID is null");
            };

            if (userIDs == null) {
                throw util.eventErr("checkOnline", "missing required paramters");
            };

            let returnUserIDs = {};

            for (let i = 0; i < userIDs.length; i++) {
                try {
                    if (userIDs[i] in connectedUsers) {
                        returnUserIDs[userIDs[i]] = true;
                    } else {
                        let RU = await db.fetchRecord("USERS", "userID", userIDs[i], undefined, undefined, "lastOnline");
                        returnUserIDs[userIDs[i]] = RU.lastOnline;
                    };
                } catch (error) {
                    util.handleEventFailure("checkOnline.userOnline", error, `userID: ${userIDs[i]}`, showLogs);
                };
            };

            util.handleEventSuccess("checkOnline", `userID: ${socket.userData.userID}`, showLogs);
            ack(null, returnUserIDs);
        } catch (error) {
            util.handleEventFailure("checkOnline", error, `userID: ${socket.userData.userID}`, showLogs);
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

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("sendCR", "disconnected or socket.userData.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw util.eventErr("sendCR", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["requestID", "date"];

            if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw util.eventErr("sendCR", "packet property(s) missing");
            } else if (Object.values(packetObject).every(item => item !== null) == false) {
                throw util.eventErr("sendCR", "packet property(s) null");
            };

            let originUser = await db.fetchRecord("USERS", "userID", socket.userData.userID);
            packetObject.originUser = originUser;

            let jsonBuffer = Buffer.from(JSON.stringify(packetObject));

            try {
                await db.createCR(packetObject.requestID, socket.userData.userID, receivingUserID, packetObject.date);

                ack(null);
                util.handleEventSuccess("sendCR", `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs);

                await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCR", jsonBuffer, 1000, showLogs);
            } catch (error) {
                util.handleEventFailure("sendCR", error, `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs);
                ack(error.message);

                try {
                    await db.deleteRecord("CRs", "requestID", packetObject.requestID);

                    util.handleSuccess("sendCR.deleteCR", `requestID: ${packetObject.requestID}`, showLogs);
                } catch (error) {
                    util.handleFailure("sendCR.deleteCR", error, `requestID: ${packetObject.requestID}`, showLogs);
                };
            };
        } catch (error) {
            util.handleEventFailure("sendCR", error, `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs);
            ack(error.message);
        };
    });

    // sendCRResult
    //
    socket.on('sendCRResult', async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("sendCRResult", "disconnected or socket.userData.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw util.eventErr("sendCRResult", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["requestID", "result", "channelID", "creationDate"];

            if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw util.eventErr("sendCRResult", "packet property(s) missing");
            } else if (Object.values(packetObject).every(item => item !== null) == false) {
                throw util.eventErr("sendCRResult", "packet property(s) null");
            };

            if (packetObject.result == true) {
                await db.deleteRecord("CRs", "requestID", packetObject.requestID);

                await db.createRUChannel(packetObject.channelID, socket.userData.userID, packetObject.creationDate);
                await db.createRUChannel(packetObject.channelID, receivingUserID, packetObject.creationDate);

                ack(null);
                util.handleEventSuccess("sendCRResult", `receivingUserID: ${receivingUserID}`, showLogs);

                await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCRResult", packet, 1000, showLogs);
            } else if (packetObject.result == false) {
                await db.deleteRecord("CRs", "requestID", packetObject.requestID);

                ack(null);
                util.handleEventSuccess("sendCRResult", `receivingUserID: ${receivingUserID}`, showLogs);

                await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCRResult", packet, 1000, showLogs);
            };
        } catch (error) {
            util.handleEventFailure("sendCRResult", error, `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs);
            ack(error.message);
        };
    });

    // sendCD
    //
    socket.on('sendCD', async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("sendCD", "disconnected or socket.userData.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw util.eventErr("sendCD", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["deletionID", "deletionDate", "type", "channelID"];

            if (Object.values(packetObject).every(item => item !== null) == false) {
                throw util.eventErr("sendCD", "packet property(s) null");
            } else if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw util.eventErr("sendCD", "packet property(s) missing");
            };

            if (packetObject.type == "clear") {
                await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCD", packet, 1000, showLogs);

                ack(null);
            } else if (packetObject.type == "delete") {
                await db.deleteRecords("RUChannels", "channelID", packetObject.channelID);
                ack(null);

                await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCD", packet, 1000, showLogs);
            };

            util.handleEventSuccess("sendCD", `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleEventFailure("sendCD", error, `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // sendCDResult
    //
    socket.on('sendCDResult', async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("sendCDResult", "disconnected or socket.userData.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw util.eventErr("sendCDResult", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["deletionID", "userID", "date"];

            if (Object.values(packetObject).every(item => item !== null) == false) {
                throw util.eventErr("sendCDResult", "packet property(s) null");
            } else if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw util.eventErr("sendCDResult", "packet property(s) missing");
            };

            await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCDResult", packet, 1000, showLogs)
            ack(null);
            util.handleEventSuccess("sendCDResult", `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleEventFailure("sendCDResult", error, `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // resetChannels
    //
    socket.on("resetChannels", async function (data, ack) {

        let packet = data.packet;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("resetChannels", "disconnected or socket.userData.userID is null");
            };

            if (packet == null) {
                throw util.eventErr("resetChannels", "missing required parameters");
            };

            let packetObject = JSON.parse(packet.toString());
            let packetProps = ["channelID", "userID", "deletionID", "deletionDate"];

            for (let i = 0; i < packetObject.length; i++) {
                let deletionData = packetObject[i];

                if (packetProps.every(key => deletionData.hasOwnProperty(key)) == false) {
                    util.eventErr("resetChannels", "packet property(s) missing");
                } else if (Object.values(deletionData).every(item => item !== null) == false) {
                    util.eventErr("resetChannels", "packet property(s) null");
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

                    await CheckOnlineEmit(socket.userData.userID, deletionData.userID, "receivedCD", jsonBuffer, 1000, showLogs);
                    
                    util.handleEventSuccess("resetChannels.receivedCD", `originUserID: ${socket.userData.userID}, receivingUserID: ${deletionData.userID}`, showLogs);
                } catch {
                    util.handleEventFailure("resetChannels.receivedCD", error, `originUserID: ${socket.userData.userID}, receivingUserID: ${packetObject[i].userID}`, showLogs);
                };
            };

            ack(null);
            util.handleEventSuccess("resetChannels", `originUserID: ${socket.userData.userID}`, showLogs);
        } catch (error) {
            util.handleEventFailure("resetChannels", error, `originUserID: ${socket.userData.userID}`, showLogs);
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
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("sendMessage", "disconnected or socket.userData.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw util.eventErr("sendMessage", "missing required parameters");
            };

            await CheckOnlineEmit(receivingUserID, "receivedMessage", packet, 1000, showLogs)

            ack(null);

            util.handleEventSuccess("sendMessage", `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleEventFailure("sendMessage", error, `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // deliveredMessage
    //
    socket.on('deliveredMessage', async function (data, ack) {
        
        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("deliveredMessage", "disconnected or socket.userData.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw util.eventErr("deliveredMessage", "missing required parameters");
            };

            await CheckOnlineEmit(receivingUserID, "receivedDeliveredMessage", packet, 1000, showLogs)

            ack(null);

            util.handleEventSuccess("deliveredMessage", `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleEventFailure("deliveredMessage", error, `originUserID: ${socket.userData.userID}, receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // deleteMessage
    //
    socket.on("deleteMessage", async function (data, ack) {

        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("deleteMessage", "disconnected or socket.userData.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw util.eventErr("deleteMessage", "missing required parameters");
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
            if (socket.userData.connected == false || socket.userData.userID == null) {
                throw util.eventErr("deleteMessageResult", "disconnected or socket.userData.userID is null");
            };

            if (receivingUserID == null || packet == null) {
                throw util.eventErr("deleteMessageResult", "missing required parameters");
            };
        } catch (error) {

        };
    });
});

server.listen(3000, () => {
    console.log("Server listening on localhost, port 3000");
});
