const app = require('express')();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const util = require('./utilities');
const db = require('./db');

db.connect();

let connectedUsers = {};

// io.use((socket, next) => {
//     let token = socket.handshake.auth.token;

//     next();
// });

let showLogs = true;

io.on('connection', (socket) => {

    util.handleSuccess("connectionSocket", `socketID: ${socket.id}`, showLogs);

    socket.userData = {
        userID: null,
        socketID: socket.id,
        connected: null
    };

    async function EmitEvent(receivingSocket, eventName, packet, timeoutLength) {
        return new Promise((resolve, reject) => {
            receivingSocket.timeout(timeoutLength).emit(eventName, packet, async (err, response) => {
                if (err) {
                    reject(new Error(`EmitEvent - ${err.message}`));
                } else if (response != null) {
                    reject(new Error(`EmitEvent - clientResponse: ${response}`));
                } else {
                    resolve();
                };
            });
        });
    };

    async function CheckOnlineEmit(originUserID, receivingUserID, eventName, packet, timeoutLength, showLogs = true) {
        if (receivingUserID in connectedUsers) {
            try {
                let receivingSocketID = connectedUsers[receivingUserID].socketID;
                let receivingSocket = await io.in(receivingSocketID).fetchSockets();

                await EmitEvent(receivingSocket[0], eventName, packet, timeoutLength);

                util.handleSuccess("CheckOnlineEmit", `receivingUserID: ${receivingUserID}, eventName: ${eventName}`, showLogs);
            } catch (error) {
                util.handleFailure("CheckOnlineEmit", error, `receivingUserID: ${receivingUserID}, eventName: ${eventName}`, showLogs);

                if (error.message != "EmitEvent - operation has timed out") {
                    throw error;
                }

                if (originUserID) {
                    await db.createEvent(eventName, util.currDT, originUserID, receivingUserID, packet);
                } else {
                    throw new Error("origin userID not found");
                };
            };
        } else {
            if (originUserID) {
                await db.createEvent(eventName, util.currDT, originUserID, receivingUserID, packet);
            } else {
                throw new Error("origin userID not found");
            };
        };
    };

    async function EmitPendingEvents(userID, receivingSocket, timeoutLength, showLogs = true) {

        let pendingEvents = await db.fetchRecords('EVENTS', 'receivingUserID', userID, ['eventID', 'eventName', 'packet'], 'datetime');

        for (let i = 0; i < pendingEvents.length; i++) {
            let eventID = pendingEvents[i].eventID;
            let eventName = pendingEvents[i].eventName;
            let packet = pendingEvents[i].packet;

            try {
                await EmitEvent(receivingSocket, eventName, packet, timeoutLength);
                await db.deleteRecord("EVENTS", "eventID", eventID);
                util.handleSuccess("EmitPendingEvents", `userID: ${userID}, eventID: ${eventID}, eventName: ${eventName}`, showLogs)
            } catch (error) {
                util.handleFailure("EmitPendingEvents", error.message, `userID: ${userID}, eventID: ${eventID}, eventName: ${eventName}`, showLogs)

                if (error.message != "EmitEvent - operation has timed out") {
                    await db.deleteRecord("EVENTS", "eventID", eventID);
                }
            }
        };
    };

    async function DeleteUserData(userID) {
        try {
            await db.deleteRecord("USERS", "userID", userID);

            await db.deleteCRsByUserID(userID);

            await db.deleteRUChannelsByUserID(userID);

            await db.deleteRecords("EVENTS", "receivingUserID", userID);

            util.handleSuccess("DeleteUserData", `userID: ${userID}`, showLogs);
        } catch (error) {
            util.handleFailure("DeleteUserData", error, `userID: ${userID}`, showLogs);
            throw error;
        };
    };

    // checkUsername
    // request operation
    // - Checks if username is available
    // - If successful, emits null callback to client with result, else emits error callback to client
    socket.on('checkUsername', async function (data, callback) {
        try {
            let result = await db.fetchRecords("USERS", "username", data, "userID", undefined, undefined, 1)

            if (result.length == 0) {
                callback(null, true);
            } else if (result.length != 0) {
                callback(null, false);
            };

            util.handleSuccess("checkUsername", `username: ${data}, result: ${result.length == 0 ? true : false}`, showLogs);
        } catch (error) {
            util.handleFailure("checkUsername", error, `username: ${data}`, showLogs);
            callback(error.message);
        }
    });

    // createUser
    // creation operations
    // - Checks if username is available and creates user in database
    // - If successful, emits null callback to client, else emits error callback to client
    socket.on('createUser', async function (data, callback) {

        data = JSON.parse(data.packet.toString());

        try {
            if (Object.values(data).every(item => item !== null) == false) {
                throw new Error("packet property(s) null");
            } else if (["userID", "username", "avatar", "creationDate"].every(key => data.hasOwnProperty(key)) == false) {
                throw new Error("packet property(s) missing");
            } else {
                await db.createUser(
                    data.userID,
                    data.username,
                    data.avatar,
                    data.creationDate
                );

                util.handleSuccess("createUser", `username: ${data.username}`, showLogs);
                callback(null);
            };
        } catch (error) {
            util.handleFailure("createUser", error, `userID: ${data.userID}`, showLogs);
            callback(error.message);
        };
    });

    // deleteUser
    // deletion operation
    // - Deletes user from database and sends null callback to client
    // - If successful, deleteUserTrace event is emitted to all RUIDs
    // - On receiving ack, if success it's logged, otherwise added to events table for another try later
    socket.on('deleteUser', async function (data, callback) {

        let userID = data.userID;

        try {
            let RUChannels = await db.fetchRUChannelsbyUserID(userID);
            let RUIDs = RUChannels.map(channel => channel.userID);

            await DeleteUserData(userID);
            socket.userData.connected = false;

            util.handleSuccess("deleteUser", `userID: ${userID}`, showLogs);
            callback(null);

            let eventName = "deleteUserTrace";
            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    let packet = Buffer.from(JSON.stringify(userID))
                    await CheckOnlineEmit(RUIDs[i], eventName, packet, 1000);
                    util.handleSuccess("deleteUser", `deleteUserTrace emitted to userID: ${RUIDs[i]}`, showLogs);
                } catch {
                    util.handleFailure("deleteUser", error, `userID: ${RUIDs[i]}`, showLogs);
                };
            };
        } catch (error) {
            util.handleFailure("deleteUser", error, `userID: ${userID}`, showLogs);
            callback(error.message);
        };
    });

    // connectUser
    // Request operation
    // - Checks if user exists in database, if yes then sends null callback, otherwise sends failure to client to clear local storage
    socket.on('connectUser', async function (data, callback) {

        let userID = data.userID;

        try {
            let userRecord = await db.fetchRecords("USERS", "userID", userID, "userID", undefined, undefined, 1)

            if (userRecord.length != 0) {
                socket.userData.userID = userID;
                socket.userData.connected = true;

                connectedUsers[userID] = {
                    socketID: socket.id
                };
               
                util.handleSuccess("connectUser", `userID: ${userID}`, showLogs);

                callback(null);
            } else {
                throw new Error("user does not exist");
            };

            let RUIDs = await db.fetchRUChannelsbyUserID(userID, "userID");

            for (let i = 0; i < RUIDs.length; i++) {
                if (RUIDs[i] in connectedUsers) {
                    let receivingSocketID = connectedUsers[RUIDs[i]].socketID;
                    io.to(receivingSocketID).emit('userOnline', data.userID);
                };
            };

            try {
                await EmitPendingEvents(userID, socket, 1000, true);

                await EmitEvent(socket, "receivedPendingEvents", null, 1000)
            } catch (error) {
                util.handleFailure("connectUser", error, `userID: ${userID}`, showLogs);
            }
        } catch (error) {
            util.handleFailure("connectUser", error, `userID: ${userID}`, showLogs);
            callback(error.message);
        };
    });

    // disconnectUser
    // Request operation
    // - Updates socket userdata and lastOnline in database, then emits userDisconnected event to all RUIDs
    socket.on('disconnectUser', async function (data) {
        let userID = data.userID;

        try {
            socket.userData.connected = false;

            
            await db.updateRecord("USERS", "userID", userID, undefined, undefined, "lastOnline", util.currDT);
        
            util.handleSuccess("disconnectUser", `userID: ${userID}`, showLogs);

            let RUChannels = await db.fetchRUChannelsbyUserID(userID);
            let RUIDs = RUChannels.map(channel => channel.userID);

            for (let i = 0; i < RUIDs.length; i++) {
                if (RUIDs[i] in connectedUsers) {
                    let receivingSocketID = connectedUsers[RUIDs[i]].socketID;
                    io.to(receivingSocketID).emit("userDisconnected", { userID: lastOnline });
                }
            }
        } catch (error) {
            util.handleFailure("disconnectUser", error, `userID: ${userID}`, showLogs);
        };
    });

    socket.on('disconnect', function () {
        util.handleSuccess("disconnectSocket", `userID: ${socket.userData.userID}`, showLogs);
        delete connectedUsers[socket.userData.userID];
        socket.userData.userID = null;
    });

    // ChannelDC Events

    // fetchRU
    socket.on('fetchRU', async function (data, callback) {
        try {
            let user = await db.fetchRecord("USERS", "userID", data)

            util.handleSuccess("fetchRU", `userID: ${data}`, showLogs);

            callback(null, user);
        } catch (error) {
            util.handleFailure("fetchRU", error, `userID: ${data}`, showLogs);

            callback(error.message)
        }
    });

    // fetchRUs
    socket.on('fetchRUs', async function (data, callback) {
        try {
            let userPackets = await db.fetchUsersByUsername(data);

            util.handleSuccess("fetchRUs", `username: ${data}, resultCount: ${userPackets.length}`, showLogs);

            callback(null, userPackets);
        } catch (error) {
            util.handleFailure("fetchRUs", error, `username: ${data}`, showLogs);

            callback(error.message);
        }
    });

    // checkChannelUsers
    socket.on('checkChannelUsers', async function (data, callback) {

        try {
            let RUList = {};
            for (let i = 0; i < data.length; i++) {
                try {
                    let userRecord = await db.fetchRecords("USERS", "userID", data[i], "userID", undefined, undefined, 1)

                    if (userRecord.length == 0) {
                        RUList[data[i]] = false;
                    } else if (data[i] in connectedUsers) {
                        RUList[data[i]] = "online";
                    } else {
                        RUList[data[i]] = await db.fetchRecord("USERS", "userID", data[i], undefined, undefined, "lastOnline")
                    };
                } catch (error) {
                    util.handleFailure("checkChannelUsers", error, `userID: ${data[i]}`, showLogs);
                }
            };

            util.handleSuccess("checkChannelUsers", `userID: ${socket.userData.userID}`, showLogs);

            callback(null, RUList);
        } catch (error) {
            util.handleFailure("checkChannelUsers", error, ``, showLogs);
        };
    });

    // ChannelDC CR Events
    // ===================

    // sendCR
    // - A CR packet is sent, and an ack is pending to A to create CR objects in its database
    // - CR object is created in database and JSON packet for B is created
    // - CheckOnlineEmit is called to emit event immediately if user is online, otherwise it is stored in events database, and an ack is sent to A after one of these
    //   operations is completed
    // - As long as the event is added to the events database, a successful ack is sent back to A to create the objects, even if the emit times out
    socket.on('sendCR', async function (data, ack) {
        let receivingUserID = data.userID;

        try {
            let packet = JSON.parse(data.packet.toString());

            try {
                if (socket.userData.userID == null) {
                    throw new Error("originUserID is null");
                } else if (receivingUserID == null) {
                    throw new Error("receivingUserID is null");
                } else {
                    let originUser = await db.fetchRecord("USERS", "userID", socket.userData.userID);
                    packet.originUser = originUser;

                    await db.createCR(packet.requestID, socket.userData.userID, receivingUserID, packet.date);

                    let JSONBuffer = Buffer.from(JSON.stringify(packet));
                    await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCR", JSONBuffer, 1000, showLogs);

                    ack(null);
                    util.handleSuccess("sendCR", `receivingUserID: ${receivingUserID}`, showLogs);
                };
            } catch (error) {
                util.handleFailure("sendCR", error, `receivingUserID: ${receivingUserID}`, showLogs)
                await db.deleteRecord("CRs", "requestID", packet.requestID);
                ack(error.message);
            }
        } catch (error) {
            util.handleFailure("sendCR", error, `receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });


    socket.on('sendCRResult', async function (data, ack) {
        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            let packetObject = JSON.parse(packet.toString());

            if (socket.userData.userID == null) {
                throw new Error("originUserID not found");
            } else if (receivingUserID == null) {
                throw new Error("receivingUserID not found");
            } else if (Object.values(packetObject).every(item => item !== null) == false) {
                throw new Error("packet property(s) null");
            } else if (["requestID", "result", "channelID", "creationDate"].every(key => packetObject.hasOwnProperty(key)) == false) {
                throw new Error("packet property(s) missing");
            } else {
                try {
                    if (packetObject.result == true) {
                        await db.deleteRecord("CRs", "requestID", packetObject.requestID);

                        await db.createRUChannel(packetObject.channelID, socket.userData.userID, packetObject.creationDate);
                        await db.createRUChannel(packetObject.channelID, receivingUserID, packetObject.creationDate);

                        await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCRResult", packet, 1000, showLogs);

                        ack(null);
                        util.handleSuccess("sendCRResult", `receivingUserID: ${receivingUserID}`, showLogs);
                    } else if (packetObject.result == false) {
                        await db.deleteRecord("CRs", "requestID", packetObject.requestID);

                        await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCRResult", packet, 1000, showLogs);

                        ack(null);
                        util.handleSuccess("sendCRResult", `receivingUserID: ${receivingUserID}`, showLogs);
                    };
                } catch (error) {
                    util.handleFailure("sendCRResult", error, `receivingUserID: ${receivingUserID}`, showLogs)
                    ack(error.message);
                };
            };
        } catch (error) {
            util.handleFailure("sendCRResult", error, `receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // ChannelDC CD Events
    // ===================

    // sendCD
    //
    socket.on('sendCD', async function (data, ack) {
        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            let packetObject = JSON.parse(packet.toString());
            let packageProps = ["deletionID", "deletionDate", "type", "channelID"];

            if (socket.userData.userID == null) {
                throw new Error("originUserID not found");
            } else if (receivingUserID == null) {
                throw new Error("receivingUserID not found");
            } else if (Object.values(packetObject).every(item => item !== null) == false) {
                throw new Error("packet property(s) null");
            } else if (packageProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw new Error("packet property(s) missing");
            } else {
                try {
                    if (packetObject.type == "clear") {

                        await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCD", packet, 1000, showLogs);

                        ack(null);
                        util.handleSuccess("sendCD", `receivingUserID: ${receivingUserID}`, showLogs);

                    } else if (packetObject.type == "delete") {
                        await db.deleteRecords("RUChannels", "channelID", packetObject.channelID);

                        await CheckOnlineEmit(socket.userData.userID, receivingUserID, "receivedCD", packet, 1000, showLogs);

                        ack(null);
                        util.handleSuccess("sendCD", `receivingUserID: ${receivingUserID}`, showLogs);
                    };
                } catch (error) {
                    util.handleFailure("sendCD", error, `receivingUserID: ${receivingUserID}`, showLogs)
                    ack(error.message);
                };
            };
        } catch (error) {
            util.handleFailure("sendCD", error, `receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    socket.on('sendCDResult', async function (data, ack) {
        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            await CheckOnlineEmit(receivingUserID, "receivedCDResult", packet, 1000, showLogs)
            ack(null);
            util.handleSuccess("sendCDResult", `receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleFailure("sendCDResult", error, `receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });


    // MessageDC Events

    socket.on('sendMessage', async function (data, callback) {
        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            await CheckOnlineEmit(receivingUserID, "receivedMessage", packet, 1000, showLogs)
            ack(null);
            util.handleSuccess("sendMessage", `receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleFailure("sendMessage", error, `receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    socket.on('deliveredMessage', async function (data, callback) {
        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            await CheckOnlineEmit(receivingUserID, "receivedDeliveredMessage", packet, 1000, showLogs)
            ack(null);
            util.handleSuccess("deliveredMessage", `receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleFailure("deliveredMessage", error, `receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });
});

server.listen(3000, () => {
    console.log("Server listening on localhost, port 3000");
});
