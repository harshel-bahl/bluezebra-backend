const app = require('express')();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const util = require('./utilities');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const { time } = require('console');
db.connect();

let connectedUsers = {};

// io.use((socket, next) => {
//     let token = socket.handshake.auth.token;

//     next();
// });

let showLogs = true;

io.on('connection', (socket) => {

    util.handleSuccess("connection", `socketID: ${socket.id}`, showLogs);

    socket.userData = {
        userID: null,
        socketID: socket.id,
        connected: null
    };

    async function EmitEvent(receivingSocket, eventName, packet, timeoutLength, showLogs = true) {
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

    async function CheckOnlineEmit(receivingUserID, eventName, packet, timeoutLength, showLogs = true) {
        if (receivingUserID in connectedUsers) {
            try {
                let receivingSocketID = connectedUsers[receivingUserID].socketID;
                let receivingSocket = await io.in(receivingSocketID).fetchSockets();

                await EmitEvent(receivingSocket, eventName, packet, timeoutLength);

                util.handleSuccess("CheckOnlineEmit", `receivingUserID: ${receivingUserID}, eventName: ${eventName}`, showLogs);
            } catch (error) {
                util.handleFailure("CheckOnlineEmit", error, `receivingUserID: ${receivingUserID}, eventName: ${eventName}`, showLogs);

                if (socket.userData.userID) {
                    await db.addEvent(eventName, util.currDT, originUserID, receivingUserID, packet);
                } else {
                    throw new Error("origin userID not found");
                };

                throw error
            };
        } else {
            if (socket.userData.userID) {
                await db.addEvent(eventName, util.currDT, originUserID, receivingUserID, packet);
            } else {
                throw new Error("origin userID not found");
            };
        };
    };

    async function EmitPendingEvents(userID, receivingSocket, timeoutLength, showLogs = true) {

        let pendingEvents = await db.fetchEventsByUserID(userID);

        for (let i = 0; i < pendingEvents.length; i++) {
            let eventID = pendingEvents[i].eventID;
            let eventName = pendingEvents[i].eventName;
            let packet = pendingEvents[i].packet;

            try {
                await EmitEvent(receivingSocket, eventName, packet, timeoutLength, showLogs);
                await db.deleteEvent(eventID);
                util.handleSuccess("EmitPendingEvents", `userID: ${userID}, eventID: ${eventID}, eventName: ${eventName}`, showLogs)
            } catch (error) {
                util.handleFailure("EmitPendingEvents", error.toString(), `userID: ${userID}, eventID: ${eventID}, eventName: ${eventName}`, showLogs)
                
                if (error.message != "EmitEvent - operation has timed out") {
                    await db.deleteEvent(eventID);
                }
            }
        };
    };

    // checkUsername
    // request operation
    // - Checks if username is available
    // - If successful, emits null callback to client with result, else emits error callback to client
    socket.on('checkUsername', async function (data, callback) {
        try {
            let result = await db.checkUsername(data);

            util.handleSuccess("checkUsername", `username: ${data}, result: ${result}`, showLogs);

            if (result == true) {
                callback(null, true);
            } else if (result == false) {
                callback(null, false);
            }
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
            await db.checkUsername(data.username)

            await db.createUser(
                data.userID,
                data.username,
                data.avatar,
                data.creationDate
            );

            util.handleSuccess("createUser", `username: ${data.username}`, showLogs);
            callback(null);
        } catch (error) {
            util.handleFailure("createUser", error, `username: ${data.username}`, showLogs);
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
        let RUIDs = data.RUIDs;
        let packet = data.packet;

        try {
            await db.deleteUser(userID);
            socket.userData.connected = false;

            util.handleSuccess("deleteUser", `userID: ${userID}`, showLogs);
            callback(null);

            let eventName = "deleteUserTrace";
            for (let i = 0; i < RUIDs.length; i++) {
                try {
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
        let RUIDs = data.RUIDs;

        try {
            if (await db.checkUserID(userID) == true) {

                socket.userData.userID = userID;
                socket.userData.connected = true;

                connectedUsers[userID] = {
                    socketID: socket.id
                };

                util.handleSuccess("connectUser", `userID: ${data.userID}`, showLogs);

                callback(null);
            } else {
                throw new Error("user does not exist");
            };

            for (let i = 0; i < RUIDs.length; i++) {
                if (RUIDs[i] in connectedUsers) {
                    let receivingSocketID = connectedUsers[RUIDs[i]].socketID;
                    io.to(receivingSocketID).emit('userOnline', data.userID);
                };
            };

            await EmitPendingEvents(userID, socket, 1000, true)
        } catch (error) {
            util.handleFailure("connectUser", error, `userID: ${data.userID}`, showLogs)
            callback(error.message);
        };
    });

    // disconnectUser
    // Request operation
    // - Updates socket userdata and lastOnline in database, then emits userDisconnected event to all RUIDs
    socket.on('disconnectUser', async function (data) {
        let userID = data.userID;
        let lastOnline = data.lastOnline;
        let RUIDs = data.RUIDs;

        try {
            socket.userData.userID = null;
            socket.userData.connected = false;

            await db.updateLastOnline(userID, lastOnline);

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
        console.log(`SUCCESS: disconnect - (userID: ${socket.userData.userID})`);
        delete connectedUsers[socket.userData.userID];
        socket.userData.connected = false;
    });

    // ChannelDC Events

    // fetchRU
    socket.on('fetchRU', async function (data, callback) {
        try {
            let user = await db.fetchUserByUserID(data);

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

            util.handleSuccess("fetchRUs", `username: ${data}, resultCount: ${users.length}`, showLogs);

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
                    if (await db.checkUserID(data[i]) == false) {
                        RUList[data[i]] = false;
                    } else if (data[i] in connectedUsers) {
                        RUList[data[i]] = "online";
                    } else {
                        RUList[data[i]] = await db.fetchUserLastOnline(data[i])
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
    // Principle is that the clients manage as much of the events and event failures as possible, as they are required to stay in sync with each other. For example,
    // if A sends CR to B, and it fails or times out on B, B will emit a sendCRFailure event to A, the failure ack from B won't do anything since it's better to
    // ensure that a sendCRFailure event is emitted to A in case the failure ack from B is lost or server shuts down and loses track of prior running processes. 
    // The server acts as much like a piping system as possible.

    // sendCR
    // - A JSON packet is sent with the CR:
    // If user is online:
    //     - The CR is sent immediately if user online and an ack is sent back to A
    //     - If ack from B is successful nothing happens
    //     - If ack from B presents failure, nothing happens since B will emit a sendCRFailure event to A
    //     - If ack from B is timeout, nothing happens and the event will be retried on next startup of B
    // If user is offline:
    //     - A receivedCR event is stored in events database to be sent to B and an ack is sent back to A
    socket.on('sendCR', async function (data, ack) {
        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            await CheckOnlineEmit(receivingUserID, "receivedCR", packet, 1000, showLogs)
            ack(null);
            util.handleSuccess("sendCR", `receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleFailure("sendCR", error, `receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // sendCRFailure
    // event handles the failure of local persistence in client A to ensure client B removes CR objects
    // remove sendCR event from events table if present 
    socket.on('sendCRFailure', async function (data, ack) {
        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            await CheckOnlineEmit(receivingUserID, "receivedCRFailure", packet, 1000, showLogs)
            ack(null);
            util.handleSuccess("sendCRFailure", `receivingUserID: ${receivingUserID}`, showLogs);
        } catch {
            util.handleFailure("sendCRFailure", error, `receivingUserID: ${receivingUserID}`, showLogs);
            ack(error.message);
        };
    });

    socket.on('sendCRResult', async function (data, ack) {
        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            await CheckOnlineEmit(receivingUserID, "receivedCRResult", packet, 1000, showLogs)
            ack(null);
            util.handleSuccess("sendCRResult", `receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleFailure("sendCRResult", error, `receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    // ChannelDC CD Events

    socket.on('sendCD', async function (data, callback) {
        let receivingUserID = data.userID;
        let packet = data.packet;

        try {
            await CheckOnlineEmit(receivingUserID, "receivedCD", packet, 1000, showLogs)
            ack(null);
            util.handleSuccess("sendCD", `receivingUserID: ${receivingUserID}`, showLogs);
        } catch (error) {
            util.handleFailure("sendCD", error, `receivingUserID: ${receivingUserID}`, showLogs)
            ack(error.message);
        };
    });

    socket.on('sendCDResult', async function (data, callback) {
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
