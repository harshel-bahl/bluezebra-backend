const app = require('express')();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const utilities = require('./utilities');

const db = require('./db');
db.connect();

let connectedUsers = {};

// io.use((socket, next) => {
//     let token = socket.handshake.auth.token;

//     next();
// });

io.on('connection', (socket) => {

    console.log(`SUCCESS: connection - ${socket.id} connected`);

    socket.userData = {
        userID: null,
        connected: null
    };

    socket.userData.connected = true;

    // checkUsername
    // request operation
    // - Checks if username is available
    // - If successful, emits null callback to client with result, else emits error callback to client
    socket.on('checkUsername', async function (data, callback) {
        try {
            let result = await db.checkUsername(data);

            console.log(`SUCCESS: checkUsername event - (username: ${data}, result: ${result})`);

            if (result == true) {
                callback(null, true);
            } else if (result == false) {
                callback(null, false);
            }
        } catch (error) {
            console.log(`FAILED: checkUsername event - (username: ${data}, error: ${error})`);
            callback(error.toString());
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

            console.log(`SUCCESS: createUser - (username: ${data.username})`);
            callback(null);
        } catch (error) {
            console.log(`FAILED: createUser - (username: ${data.username}, error: ${error})`);
            callback(error.toString());
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

            console.log(`SUCCESS: deleteUser - (userID: ${userID})`)
            callback(null);

            let eventName = "deleteUserTrace";
            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    if (RUIDs[i] in connectedUsers) {
                        let receivingSocketID = connectedUsers[RUIDs[i]].socketID;
                        let receivingSocket = await io.in(receivingSocketID).fetchSockets();

                        if (receivingSocket.length > 0) {
                            receivingSocket.emit(eventName, packet, async (ack) => {

                                if (ack == null) {
                                    console.log(`SUCCESS: deleteUser - ack success (eventName: ${eventName}, receivingUserID: ${RUIDs[i]})`);
                                } else {
                                    console.log(`FAILED: deleteUser - ack failed (eventName: ${eventName}, receivingUserID: ${RUIDs[i]})`);
                                    await db.addEvent(eventName, utilities.currDT, RUIDs[i], packet);
                                };
                            });
                        };
                    } else {
                        await db.addEvent(eventName, utilities.currDT, RUIDs[i], packet);
                    };
                } catch {
                    console.log(`FAILED: deleteUser - failed to emit/add event (eventName: ${eventName}, receivingUserID: ${RUIDs[i]}, error: ${error})`);
                };
            };
        } catch (error) {
            console.log(`FAILED: deleteUser - (userID: ${userID}, error: ${error})`);
            callback(error.toString());
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
                console.log(`SUCCESS: connectUser - (userID: ${data.userID})`);

                socket.userData.userID = userID;
                connectedUsers[userID] = {
                    socketID: socket.id
                };

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

            // ensure events are fetched in order of date 
            let pendingEvents = await db.fetchEventsByUserID(userID);

            for (let i = 0; i < pendingEvents.length; i++) {

                let eventID = pendingEvents[i].eventID;
                let eventName = pendingEvents[i].eventName;
                let packet = pendingEvents[i].packet;

                let timeoutDuration = 1000;
                const timeout = setTimeout(async () => {
                    console.log(`FAILED: connectUser - timeout on event (userID: ${userID}, eventID: ${eventID}, eventName: ${eventName})`);
                    await db.deleteEvent(pendingEvents[i].eventID);
                    // handle event failure based on type of event
                }, timeoutDuration);

                socket.emit(eventName, packet, async (ack) => {
                    clearTimeout(timeout);

                    if (ack == null) {
                        await db.deleteEvent(pendingEvents[i].eventID);
                    } else {
                        console.log(`FAILED: connectUser - failed ack (userID: ${userID}, eventID: ${eventID}, eventName: ${eventName})`);
                        await db.deleteEvent(pendingEvents[i].eventID);
                        // handle event failure based on type of event
                    };
                });
            }
        } catch (error) {
            console.log(`FAILED: connectUser - (userID: ${data.userID}, error: ${error})`);
            callback(error.toString());
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
            socket.userData.connected = false;

            await db.updateLastOnline(userID, lastOnline);

            for (let i = 0; i < RUIDs.length; i++) {
                if (RUIDs[i] in connectedUsers) {
                    let receivingSocketID = connectedUsers[RUIDs[i]].socketID;
                    io.to(receivingSocketID).emit("userDisconnected", { userID: lastOnline });
                }
            }
        } catch (error) {
            console.log(`FAILED: disconnectUser - (userID: ${userID}, error: ${error})`);
        };
    });


    // ChannelDC Events

    // fetchRU
    socket.on('fetchRU', async function (data, callback) {
        try {
            let user = await db.fetchUserByUserID(data);
            console.log(`SUCCESS: fetchRU - (userID: ${data})`);
            callback(null, user);
        } catch (error) {
            console.log(`FAILED: fetchRU - (userID: ${data}, error: ${error})`);
            callback(error)
        }
    });

    // fetchRUs
    socket.on('fetchRUs', async function (data, callback) {
        try {
            let users = await db.fetchUsersByUsername(data);
            console.log(`SUCCESS: fetchRUs - (username: ${data}, resultCount: ${users.length})`);
            callback(null, users);
        } catch (error) {
            console.log(`FAILED: fetchRUs - (username: ${data}, error: ${error})`);
            callback(error);
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
                    console.log(`FAILED: checkChannelUsers event - (userID: ${data[i]}, error: ${error})`);
                }
            };

            console.log(`SUCCESS: checkChannelUsers event - (userID: ${socket.userData.userID})`);

            callback(null, RUList);
        } catch (error) {
            console.log(`FAILED: checkChannelUsers event - (error: ${error})`);
        };
    });

    // sendCR
    // 
    // - If request sent immediately, 
    socket.on('sendCR', async function (data, ack1) {
        let userID = data.userID;
        let packet = data.packet;

        try {
            if (userID in connectedUsers) {
                let receivingSocketID = connectedUsers[userID].socketID;
                let receivingSocket = await io.in(receivingSocketID).fetchSockets();

                if (receivingSocket.length == 1) {
                    ack1(null);

                    receivingSocket[0].emit('receivedCR', packet, async function (ack2) {
                        if (ack2 == null) {
                            console.log(`SUCCESS: sendCR - (userID: ${userID})`);

                        } else {
                            console.log(`FAILED: sendCR - (userID: ${userID}, ${ack2})`);

                            // send receivedCRFailure event to client A
                        }
                    });
                } else {
                    throw new Error("Multiple sockets found for userID");
                };
            } else {
                await db.addEvent("receivedCR", utilities.currDT, userID, packet);
                ack1(null)
            };
        } catch (error) {
            console.log(`FAILED: sendCR - (userID: ${userID}, ${error})`);
            ack1(error.toString());
        };
    });

    // sendCRFailure
    // event handles the failure of local persistence in client A to ensure client B removes CR objects
    // remove sendCR event from events table if present 
    socket.on('sendCRFailure', async function (data, ack) {


    });

    socket.on('sendCRResult', function (data, ack) {
        let userID = data.userID;
        let packet = data.packet;

        if (userID in connectedUsers) {
            let receivingSocketID = connectedUsers[userID].socketID;
            io.to(receivingSocketID).emit('receivedCRResult', packet);
            ack(true);
        } else {

        };
    });

    socket.on('sendCD', function (data, callback) {
        let userID = data.userID;
        let packet = data.packet;

        if (connectedUsers[userID] != undefined) {
            let receivingSocketID = connectedUsers[userID].socketID;

            io.to(receivingSocketID).emit("receivedCD", packet);
            callback(true);
        };
    });


    // MessageDC Events
    socket.on('sendMessage', function (data, callback) {
        console.log(data.packet);
        console.log(data.packet.toString());
        console.log(JSON.parse(data.packet))
        // let receivingSocketID = connectedUsers[data.receivingUserID].socketID;
        // io.to(receivingSocketID).emit("receiveMessage", data);
        // callback(true)
    });

    socket.on("deliveredMessage", function (data) {

    });

    socket.on('disconnect', function () {
        console.log(`SUCCESS: disconnect - (userID: ${socket.userData.userID})`);
        delete connectedUsers[socket.userData.userID];
        socket.userData.connected = false;
    });
});

server.listen(3000, () => {
    console.log("Server listening on localhost, port 3000");
});
