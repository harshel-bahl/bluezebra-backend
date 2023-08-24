const util = require('./utilities');

class eventFuncs {

    constructor(io, db, logger, connectedUsers) {
        this.io = io;
        this.db = db;
        this.logger = logger;
        this.connectedUsers = connectedUsers;
    };

    async fetchSocket(
        origSocketID = null,
        origUID = null,
        socketID,
    ) {
        try {
            if (socketID == null) {
                throw util.funcErr("eventFuncs.fetchSocket", `missing required parameters: (socketID: ${socketID})`);
            };

            let socket = await io.in(socketID).fetchSockets();

            if (socket.length == 0) {
                throw util.funcErr("eventFuncs.fetchSocket", "socket not found");
            } else if (socket.length > 1) {
                throw util.funcErr("eventFuncs.fetchSocket", "multiple sockets found");
            };

            this.logger.debug(util.funcS("eventFuncs.fetchSocket", `socketID: ${socketID}`, origSocketID, origUID));
            return socket[0];

        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.fetchSocket", error, `socketID: ${socketID}`, origSocketID, origUID));
            throw error;
        };
    };

    emitEvent(
        origSocketID = null,
        origUID = null,
        recSocket,
        recUID,
        eventName,
        packetBuffer = null
    ) {
        return new Promise((resolve, reject) => {
            try {
                if (recUID == null || recSocket.id == null || recSocket == null || eventName == null) {
                    throw util.funcErr("eventFuncs.emitEvent", `missing required parameters: (recUID: ${recUID}, recSocketID: ${recSocket.id}, recSocket: ${recSocket}, eventName: ${eventName})`);
                };

                if (packetBuffer) {
                    recSocket.emit(eventName, packetBuffer);
                    this.logger.debug(util.funcS("eventFuncs.emitEvent", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
                    resolve();
                } else {
                    recSocket.emit(eventName);
                    this.logger.debug(util.funcS("eventFuncs.emitEvent", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
                    resolve();
                };
            } catch (error) {
                this.logger.error(util.funcF("eventFuncs.emitEvent", error, `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
                reject(error);
            };
        });
    };

    emitEventWithAck(
        origSocketID = null,
        origUID = null,
        recSocket,
        recUID,
        eventName,
        packetBuffer = null,
        timeoutLength
    ) {
        return new Promise((resolve, reject) => {
            try {
                if (recUID == null || recSocket.id == null || recSocket == null || eventName == null || timeoutLength == null) {
                    throw util.funcErr("eventFuncs.emitEventWithAck", `missing required parameters: (recUID: ${recUID}, recSocketID: ${recSocket.id}, recSocket: ${recSocket}, eventName: ${eventName}, timeoutLength: ${timeoutLength})`);
                };

                if (packetBuffer) {
                    recSocket.timeout(timeoutLength).emit(eventName, packetBuffer, async (err, response) => {
                        try {
                            if (err) {
                                throw util.funcErr("eventFuncs.emitEventWithAck", err.message);
                            } else if (response != null) {
                                throw util.funcErr("eventFuncs.emitEventWithAck", response);
                            };

                            this.logger.debug(util.funcS("eventFuncs.emitEventWithAck", `event: ${eventName}`, origSocketID, origUID, recSocketID, recUID));
                            resolve();

                        } catch (error) {
                            this.logger.warn(util.funcF("eventFuncs.emitEventWithAck", error, `event: ${eventName}`, origSocketID, origUID, recSocketID, recUID));
                            reject(error);
                        };
                    });
                } else {
                    recSocket.timeout(timeoutLength).emit(eventName, async (err, response) => {
                        try {
                            if (err) {
                                throw util.funcErr("eventFuncs.emitEventWithAck", err.message);
                            } else if (response != null) {
                                throw util.funcErr("eventFuncs.emitEventWithAck", response);
                            };

                            this.logger.debug(util.funcS("eventFuncs.emitEventWithAck", `event: ${eventName}`, origSocketID, origUID, recSocketID, recUID));
                            resolve();

                        } catch (error) {
                            this.logger.warn(util.funcF("eventFuncs.emitEventWithAck", error, `event: ${eventName}`, origSocketID, origUID, recSocketID, recUID));
                            reject(error);
                        };
                    });
                };
            } catch (error) {
                this.logger.error(util.funcF("eventFuncs.emitEventWithAck", error, `event: ${eventName}`, origSocketID, origUID, recSocketID, recUID));
                reject(error);
            };
        });
    };

    async emitEventOrStore(
        origSocketID = null,
        origUID = null,
        recSocket,
        recUID,
        eventName,
        packetBuffer = null
    ) {
        try {
            if (recUID == null || recSocket.id == null || recSocket == null || eventName == null) {
                throw util.funcErr("eventFuncs.emitEventOrStore", `missing required parameters: (recUID: ${recUID}, recSocketID: ${recSocket.id}, recSocket: ${recSocket}, eventName: ${eventName})`);
            };

            try {
                await this.emitEvent(origSocketID, origUID, recUID, recSocket, eventName, packetBuffer);

                this.logger.debug(util.funcS("eventFuncs.emitEventOrStore", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            } catch (error) {
                this.logger.warn(util.funcF("eventFuncs.emitEventOrStore", error, `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));

                await this.db.createEvent(origSocketID, eventName, util.currDT, origUID, recUID, packetBuffer);

                this.logger.debug(util.funcS("eventFuncs.emitEventOrStore", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            };
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.emitEventOrStore", error, `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            throw error;
        };
    };

    async emitEventWithAckOrStore(
        origSocketID = null,
        origUID = null,
        recSocket,
        recUID,
        eventName,
        packetBuffer = null, // expected to be binary buffer but supports various objects too
        timeoutLength
    ) {
        try {
            if (recUID == null || recSocket.id == null || recSocket == null || eventName == null || timeoutLength == null) {
                throw util.funcErr("eventFuncs.emitEventWithAckOrStore", `missing required parameters: (recUID: ${recUID}, recSocketID: ${recSocket.id}, recSocket: ${recSocket}, eventName: ${eventName}, timeoutLength: ${timeoutLength})`);
            };

            try {
                await this.emitEventWithAck(origSocketID, origUID, recUID, recSocket, eventName, packetBuffer, timeoutLength);

                this.logger.debug(util.funcS("eventFuncs.emitEventWithAckOrStore", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            } catch (error) {
                if (error.message != `event: ${eventName}, info: operation has timed out`) {
                    throw error;
                };

                this.logger.warn(util.funcF("eventFuncs.emitEventWithAckOrStore", error, `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));

                await this.db.createEvent(origSocketID, eventName, util.currDT, origUID, recUID, packetBuffer);

                this.logger.debug(util.funcS("eventFuncs.emitEventWithAckOrStore", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            }
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.emitEventWithAckOrStore", error, `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            throw error;
        };
    }

    // checkOnlineEmit
    // - emits event to recUID if user is online, otherwise does nothing
    async checkOnlineEmit(
        origSocketID = null,
        origUID = null,
        recUID,
        eventName,
        packetBuffer = null
    ) {
        try {
            if (recUID == null || eventName == null) {
                throw util.funcErr("eventFuncs.checkOnlineEmit", `missing required parameters: (recUID: ${recUID}, eventName: ${eventName})`);
            };

            if (recUID in this.connectedUsers) {
                let recSocketID = this.connectedUsers[recUID].socketID;

                let recSocket = await this.fetchSocket(origSocketID, origUID, recSocketID);

                await this.emitEvent(origSocketID, origUID, recSocket, recUID, eventName, packetBuffer);

                this.logger.debug(util.funcS("eventFuncs.checkOnlineEmit", `eventName: ${eventName}`, origSocketID, origUID, recSocketID, recUID));
            } else {
                this.logger.debug(util.funcS("eventFuncs.checkOnlineEmit", `eventName: ${eventName}`, origSocketID, origUID, undefined, recUID));
            };
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.checkOnlineEmit", error, `eventName: ${eventName}`, origSocketID, origUID, undefined, recUID));
            throw error;
        };
    };

    async checkOnlineEmitWithAckOrStore(
        origSocketID = null,
        origUID = null, // the origUID that intiated the event 
        recUID, // the recUID that the packet is being sent to
        eventName,
        packetBuffer = null,
        timeoutLength,
    ) {
        try {
            if (recUID == null || eventName == null || timeoutLength == null) {
                throw util.funcErr("eventFuncs.checkOnlineEmitWithAck", `missing required parameters: (recUID: ${recUID}, eventName: ${eventName}, timeoutLength: ${timeoutLength})`);
            };

            if (recUID in this.connectedUsers) {
                let recSocketID = this.connectedUsers[recUID].socketID;

                let recSocket = await this.fetchSocket(origSocketID, origUID, recSocketID);

                await this.emitEventWithAckOrStore(origSocketID, origUID, recSocket, recUID, eventName, packetBuffer, timeoutLength);

                this.logger.debug(util.funcS("eventFuncs.checkOnlineEmitWithAckOrStore", `eventName: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            } else {
                await this.db.createEvent(origSocketID, eventName, util.currDT, origUID, recUID, packetBuffer);

                this.logger.debug(util.funcS("eventFuncs.checkOnlineEmitWithAckOrStore", `eventName: ${eventName}`, origSocketID, origUID, undefined, recUID));
            };
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.checkOnlineEmitWithAckOrStore", error, `eventName: ${eventName}`, origSocketID, origUID, undefined, recUID));
            throw error;
        };
    };

    // - do a switch statement to handle specific events that need to be handled differently
    // - create large event packet to send all events to client and then the client response can determine how to handle each event
    async emitPendingEvents(
        origSocketID,
        origUID,
        recSocket,
        timeoutLength
    ) {
        try {
            if (recSocket == null || origUserID == null || timeoutLength == null) {
                throw util.funcErr("eventFuncs.emitPendingEvents", "missing required parameters");
            };

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

            await emitEvent(socket, "receivedPendingEvents", null, 1000)

            util.handleFuncSuccess("EmitPendingEvents", `userID: ${userID}`, showLogs);

        } catch (error) {
            util.handleFuncFailure("EmitPendingEvents", error, `userID: ${userID}`, showLogs);
        };
    };

    async deleteUserdata(
        origSocketID,
        userID
    ) {
        try {
            if (origSocketID == null || userID == null) {
                throw util.funcErr("eventFuncs.deleteUserdata", `missing required parameters: (origSocketID: ${origSocketID}, userID: ${userID})`);
            };

            await this.db.deleteCRsByUserID(userID);

            await this.db.deleteRUChannelsByUserID(userID);

            await this.db.deleteRecords("EVENTS", "receivingUserID", userID);

            await this.db.deleteRecord("USERS", "userID", userID);

            this.logger.debug(util.funcS("eventFuncs.deleteUserdata", `userID: ${userID}`, origSocketID, userID));
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.deleteUserdata", error, `userID: ${userID}`, origSocketID, userID));
            throw error;
        };
    };

    async sendDeleteUserTrace(
        origSocketID,
        userID,
        RUIDs
    ) {
        try {
            if (origSocketID == null || userID == null || RUIDs == null) {
                throw util.funcErr("eventFuncs.sendDeleteUserTrace", `missing required parameters: (origSocketID: ${origSocketID}, userID: ${userID}, RUIDs: ${RUIDs})`);
            };

            let packetObject = { "userID": userID };

            let packetBuffer = Buffer.from(JSON.stringify(packetObject));

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmitWithAckOrStore(origSocketID, userID, RUIDs[i].userID, "deleteUserTrace", packetBuffer, 1000);
                    await this.checkOnlineEmitWithAck(origSocketID, userID, RUIDs[i].userID, "deleteUserTrace", packetBuffer, 1000);
                } catch (error) { };
            }

            this.logger.debug(util.funcS("eventFuncs.sendDeleteUserTrace", `RUIDCount: ${RUIDs.length}`, origSocketID, userID));
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.sendDeleteUserTrace", error, `userID: ${userID}`, origSocketID, userID));
        };
    };

    async sendUserConnect(
        origSocketID,
        origUID
    ) {
        try {
            if (origSocketID == null || origUID == null) {
                throw util.funcErr("eventFuncs.sendUserConnect", `missing required parameters: (origSocketID: ${origSocketID}, origUID: ${origUID})`);
            };

            let RUIDs = await this.db.fetchRUChannelsbyUserID(origUID, "userID");

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmit(origSocketID, origUID, RUIDs[i].userID, "userConnect", origUID);
                } catch (error) { };
            };

            this.logger.debug(util.funcS("eventFuncs.sendUserConnect", `event: userConnect`, origSocketID, origUID));
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.sendUserConnect", error, undefined, origSocketID, origUID));
        };
    };

    async sendUserDisconnect(
        origSocketID,
        origUID
    ) {
        try {
            if (origSocketID == null || origUID == null) {
                throw util.funcErr("eventFuncs.sendUserDisconnect", `missing required parameters: (origSocketID: ${origSocketID}, origUID: ${origUID})`);
            };

            let RUIDs = await this.db.fetchRUChannelsbyUserID(origUID, "userID");

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmit(origSocketID, origUID, RUIDs[i].userID, "userDisconnect", origUID);
                } catch (error) { };
            };

            this.logger.debug(util.funcS("eventFuncs.sendUserDisconnect", `event: userDisconnect`, origSocketID, origUID));
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.sendUserDisconnect", error, undefined, origSocketID, origUID));
        };
    };

    async checkRUIDsOnline(
        origSocketID,
        origUID,
        RUIDs
    ) {
        try {
            if (origSocketID == null || origUID == null || RUIDs == null) {
                throw util.funcErr("eventFuncs.checkRUIDsOnline", `missing required parameters: (origSocketID: ${origSocketID}, origUID: ${origUID}, RUIDs: ${RUIDs})`);
            };

            let returnRUIDs = {};

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    if (RUIDs[i] in this.connectedUsers) {
                        returnRUIDs[RUIDs[i]] = true;
                    } else {
                        let RULastOnline = await this.db.fetchRecord("USERS", "userID", RUIDs[i], undefined, undefined, "lastOnline");

                        if (RULastOnline != null) {
                            returnRUIDs[RUIDs[i]] = RU.lastOnline;
                        };
                    };

                    this.logger.debug(util.funcS("eventFuncs.checkRUIDsOnline", `RUID: ${RUIDs[i]}`, origSocketID, origUID));
                } catch (error) {
                    this.logger.error(util.funcF("eventFuncs.checkRUIDsOnline", error, `RUID: ${RUIDs[i]}`, origSocketID, origUID));
                };
            };

            this.logger.debug(util.funcS("eventFuncs.checkRUIDsOnline", `RUIDCount: ${RUIDs.length}`, origSocketID, origUID));
            return returnRUIDs;
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.checkRUIDsOnline", error, `RUIDCount: ${RUIDs.length}`, origSocketID, origUID));
            throw error;
        };
    };

    async checkCRs(
        userID,
        recSocket,
        clientRequestIDs,
        ack
    ) {
        try {
            if (userID == null || recSocket == null || recSocket.id == null || clientRequestIDs == null || ack === null) {
                throw util.funcErr("eventFuncs.checkCRs", `missing required parameters: (userID: ${userID}, recSocketID: ${recSocket.id}, recSocket: ${recSocket}, clientRequestIDs: ${clientRequestIDs}, ack: ${ack})`);
            };

            let serverRequestIDObjects = await db.fetchCRsByUserID(userID, "requestID");
            let serverRequestIDs = serverRequestIDObjects.map(CR => CR.requestID);

            let returnCRs = {};
            for (let i = 0; i < clientRequestIDs.length; i++) {
                if (!serverRequestIDs.includes(clientRequestIDs[i])) {
                    returnCRs[clientRequestIDs[i]] = false;
                }
            };

            ack(null, returnCRs);

            await this.sendMissingCRs(userID, recSocket, clientRequestIDs);

            this.logger.debug(util.funcS("eventFuncs.checkCRs", `requestIDCount: ${clientRequestIDs.length}, returnCRCount: ${Object.keys(returnCRs).length}, missingCRs: ${missingCRs}`, recSocket.id, userID, recSocket.id, userID));
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.checkCRs", error, `requestIDCount: ${clientRequestIDs.length}`, recSocket.id, userID, recSocket.id, userID));
            throw error;
        };
    };

    async sendMissingCRs(
        userID,
        recSocket,
        clientRequestIDs,
    ) {
        try {
            if (userID == null || recSocket == null || recSocket.id == null || clientRequestIDs == null) {
                throw util.funcErr("eventFuncs.sendMissingCRs", `missing required parameters: (userID: ${userID}, recSocketID: ${recSocket.id}, recSocket: ${recSocket}, clientRequestIDs: ${clientRequestIDs})`);
            };

            let missingCRs = 0;
                for (let i = 0; i < serverRequestIDs.length; i++) {
                    if (!clientRequestIDs.includes(serverRequestIDs[i])) {
                        try {
                            let CR = await db.fetchRecord("CRs", "requestID", serverRequestIDs[i]);

                            let packetObject = {
                                requestID: CR.requestID,
                                date: CR.date
                            };

                            if (CR.originUserID == socket.userdata.userID && CR.receivingUserID != socket.userdata.userID) {
                                packetObject.isOrigin = true;

                                let RU = await db.fetchRecord("USERS", "userID", CR.receivingUserID);
                                packetObject.RU = RU;
                            } else {
                                packetObject.isOrigin = false;

                                let RU = await db.fetchRecord("USERS", "userID", CR.originUserID);
                                packetObject.RU = RU;
                            };

                            let packetBuffer = Buffer.from(JSON.stringify(packetObject));

                            await this.receivedCR(recSocket.id, userID, recSocket, userID, packetBuffer);

                            missingCRs++;
                            this.logger.debug(util.funcS("eventFuncs.sendMissingCRs", `missing request sent - requestID: ${packetObject.requestID}`, recSocket.id, userID, recSocket.id, userID));
                        } catch (error) {
                            this.logger.warn(util.funcF("eventFuncs.sendMissingCRs", error, `failed to send missing request - requestID: ${serverRequestIDs[i]}`, recSocket.id, userID, recSocket.id, userID));

                            if (error.message == "db.fetchRecord - err: no results") {
                                try {
                                    this.logger.warn(util.funcF("eventFuncs.sendMissingCRs", error, `failed to find RU - requestID: ${serverRequestIDs[i]}`, recSocket.id, userID, recSocket.id, userID));

                                    await db.deleteRecord("CRs", "requestID", serverRequestIDs[i])

                                    this.logger.debug(util.funcS("eventFuncs.sendMissingCRs", `deleted CR - requestID: ${serverRequestIDs[i]}`, recSocket.id, userID, recSocket.id, userID));
                                } catch {
                                    this.logger.error(util.funcF("eventFuncs.sendMissingCRs", error, `failed to delete CR - requestID: ${serverRequestIDs[i]}`, recSocket.id, userID, recSocket.id, userID));
                                };
                            };
                        };
                    };
                };

                this.logger.debug(util.funcS("eventFuncs.sendMissingCRs", `requestIDCount: ${clientRequestIDs.length}, missingCRs: ${missingCRs}`, recSocket.id, userID, recSocket.id, userID));
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.sendMissingCRs", error, `requestIDCount: ${clientRequestIDs.length}`, recSocket.id, userID, recSocket.id, userID));
        };
    };

    async checkRUChannels(
        userID,
        recSocket,
        clientChannelIDs,
        ack
    ) {

    }

    async sendCR(
        origSocketID,
        origUID,
        recUID,
        packetBuffer,
        ack
    ) {
        try {
            if (origUID == null || recUID == null || packetBuffer == null || ack == null) {
                throw util.funcErr("eventFuncs.sendCR", "missing required parameters");
            };

            let packetObject = JSON.parse(packetBuffer.toString());
            let packetProps = ["requestID", "date", "isOrigin"];

            if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw util.eventErr("eventFuncs.sendCR", "packet property(s) missing");
            } else if (Object.values(packetObject).every(item => item !== null) == false) {
                throw util.eventErr("eventFuncs.sendCR", "packet property(s) null");
            };

            await this.db.createCR(origSocketID, packetObject.requestID, origUID, recUID, packetObject.date);

            ack(null);
            this.logger.debug(util.funcS("eventFuncs.sendCR", `requestID: ${packetObject.requestID}`, origSocketID, origUID, undefined, recUID));

            return packetObject;
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.sendCR", error, undefined, origSocketID, origUID, undefined, recUID));
            throw error;
        };
    };

    async receivedCR(
        origSocketID,
        origUID,
        recSocket = null, // specify the socket if event is being emitted to the origUID
        recUID,
        packetObject
    ) {
        try {
            if (origUID == null || recSocket == null || recSocket.id == null || recUID == null || packetObject == null) {
                throw util.funcErr("eventFuncs.receivedCR", `missing required parameters: (origUID: ${origUID}, recSocketID: ${recSocket.id}, recSocket: ${recSocket}, recUID: ${recUID}, packetObject: ${packetObject})`);
            } else if (origSocketID == null || origUID == null || recUID == null || packetObject == null) {
                throw util.funcErr("eventFuncs.receivedCR", `missing required parameters: (origSocketID: ${origSocketID}, origUID: ${origUID}, recUID: ${recUID}, packetObject: ${packetObject})`);
            };

            let packetProps = ["requestID", "date", "isOrigin"];

            if (packetProps.every(key => packetObject.hasOwnProperty(key)) == false) {
                throw util.eventErr("eventFuncs.receivedCR", "packet property(s) missing");
            } else if (Object.values(packetObject).every(item => item !== null) == false) {
                throw util.eventErr("eventFuncs.receivedCR", "packet property(s) null");
            };

            let RU = await this.db.fetchRecord("USERS", "userID", origUID);
            packetObject.RU = RU;

            let packetBuffer = Buffer.from(JSON.stringify(packetObject));

            if (recSocket) {
                await this.emitEventWithAckOrStore(origSocketID, origUID, recSocket, recUID, "receivedCR", packetBuffer, 1000);
            } else {
                await this.checkOnlineEmitWithAck(origSocketID, origUID, recUID, undefined, "receivedCR", packetBuffer);
            };

            this.logger.debug(util.funcS("eventFuncs.receivedCR", `requestID: ${packetObject.requestID}`, origSocketID, origUID, undefined, recUID));
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.receivedCR", error, undefined, origSocketID, origUID, undefined, recUID));

            await this.receivedCRFailure(origSocketID, origUID, recUID, packetObject);

            throw error;
        };
    };

    async receivedCRFailure(
        origSocketID,
        origUID,
        recUID,
        packetObject
    ) {
        try {
            if (origUID == null || recUID == null || packetObject == null) {
                throw util.funcErr("eventFuncs.receivedCRFailure", "missing required parameters");
            };

            if (packetObject.requestID) {
                await this.db.deleteRecord("CRs", "requestID", packetObject.requestID);

                this.logger.debug(util.funcS("eventFuncs.receivedCRFailure", `requestID: ${packetObject.requestID}`, origSocketID, origUID, undefined, recUID));
            } else {
                throw util.funcErr("eventFuncs.receivedCRFailure", "requestID missing");
            };
        } catch (error) {
            this.logger.error(util.funcF("eventFuncs.receivedCRFailure", error, `requestID: ${packetObject.requestID}`, origSocketID, origUID, undefined, recUID));
        };
    };

    async sendCRResult(
        origUID,
        recUID,
        packetBuffer
    ) {
        try {

        } catch (error) {

        };
    };

    async receivedCRResult(

    ) {
        try {

        } catch (error) {

        };
    };

    async receivedCRResultFailure(

    ) {
        try {

        } catch (error) {

        };
    };

    async sendCD(
        origUID,
        recUID,
        packetBuffer,
        ack
    ) {
        try {

        } catch (error) {

        };
    };

    async receivedCD(

    ) {
        try {

        } catch (error) {

        };
    };

    async receivedCDFailure(
    ) {
        try {

        } catch (error) {

        };
    };

    async sendCDResult(
        origUID,
        recUID,
        packetBuffer,
        ack
    ) {
        try {

        } catch (error) {

        };
    };

    async receivedCDResult(
    ) {
        try {

        } catch (error) {

        };
    };

    async receivedCDResultFailure(
    ) {
        try {

        } catch (error) {

        };
    };

}


module.exports = eventFuncs;

