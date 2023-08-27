const logger = require('./logger');

const {
    ReqParamsNull,
    SocketStatusErr,
    EmptyObj,
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
} = require('./error');

const {
    currDT,
    UUID,
    isNull,
    isNotNull,
    isEmpty,
    bufferToObject,
    objectToBuffer,
    cleanStackTrace,
    logObj,
    logDebug,
    logInfo,
    logWarn,
    logError,
    checkParams,
    checkObjReqProps,
    checkObjProps,
    checkSocketStatus,
} = require('./utilities');

class EventFuncs {

    constructor(io, db, connectedUsers) {
        this.io = io;
        this.db = db;
        this.connectedUsers = connectedUsers;
    }

    async fetchSocket(
        origSocketID = null,
        origUID = null,
        socketID,
    ) {
        try {
            checkParams({
                socketID: socketID
            }, ["socketID"]);

            let socket = await io.in(socketID).fetchSockets();

            if (socket.length == 0) {
                throw new FuncErr("socket not found");
            } else if (socket.length > 1) {
                throw new FuncErr("multiple sockets found");
            }

            this.logger.debug(funcS("eventFuncs.fetchSocket", `socketID: ${socketID}`, origSocketID, origUID));

            return socket[0];

        } catch (error) {
            this.logger.error(errLog(error, `socketID: ${socketID}`, origSocketID, origUID));
            throw error;
        }
    }

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
                checkParams({
                    recUID: recUID, 
                    recSocket: recSocket, 
                    eventName: eventName
                }, ["recUID", "recSocket", "eventName"]);

                if (packetBuffer) {
                    recSocket.emit(eventName, packetBuffer);
                    this.logger.debug(funcS("eventFuncs.emitEvent", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
                    resolve();
                } else {
                    recSocket.emit(eventName);
                    this.logger.debug(funcS("eventFuncs.emitEvent", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
                    resolve();
                }
            } catch (error) {
                this.logger.error(errLog(error, `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
                reject(error);
            }
        })
    }

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
                checkParams({
                    recSocket: recSocket, 
                    socketID: recSocket.id, 
                    recUID: recUID, 
                    eventName: eventName, 
                    timeoutLength: timeoutLength
                }, ["recSocket", "socketID", "recUID", "eventName", "timeoutLength"]);

                if (packetBuffer) {
                    recSocket.timeout(timeoutLength).emit(eventName, packetBuffer, async (err, response) => {
                        try {
                            if (err) {
                                throw new FuncErr(err.message);
                            } else if (response[0] != null) {
                                throw new ClientResponseErr(response[0]);
                            }

                            this.logger.debug(funcS("eventFuncs.emitEventWithAck", `event: ${eventName}`, origSocketID, origUID, recSocketID, recUID));

                            if (response[1] != null) {
                                resolve(response[1]);
                            } else {
                                resolve();
                            }

                        } catch (error) {
                            this.logger.warn(errLog(error, `event: ${eventName}`, origSocketID, origUID, recSocketID, recUID));
                            reject(error);
                        }
                    })
                } else {
                    recSocket.timeout(timeoutLength).emit(eventName, async (err, response) => {
                        try {
                            if (err) {
                                throw new FuncErr(err.message);
                            } else if (response[0] != null) { 
                                throw new ClientResponseErr(response[0]);
                            }

                            this.logger.debug(funcS("eventFuncs.emitEventWithAck", `event: ${eventName}`, origSocketID, origUID, recSocketID, recUID));

                            if (response[1] != null) {
                                resolve(response[1]);
                            } else {
                                resolve();
                            }

                        } catch (error) {
                            this.logger.warn(errLog(error, `event: ${eventName}`, origSocketID, origUID, recSocketID, recUID));
                            reject(error);
                        }
                    })
                }
            } catch (error) {
                this.logger.error(errLog(error, `event: ${eventName}`, origSocketID, origUID, recSocketID, recUID));
                reject(error);
            }
        })
    }

    async emitEventOrStore(
        origSocketID = null,
        origUID = null,
        recSocket,
        recUID,
        eventName,
        packetBuffer = null
    ) {
        try {
            checkParams({
                recUID: recUID, 
                recSocket: recSocket, 
                recSocketID: recSocket.id, 
                eventName: eventName
            }, ["recUID", "recSocket", "recSocketID", "eventName"]);

            try {
                await this.emitEvent(origSocketID, origUID, recUID, recSocket, eventName, packetBuffer);

                this.logger.debug(funcS("eventFuncs.emitEventOrStore", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            } catch (error) {
                this.logger.warn(errLog(error, `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));

                await this.db.createEvent(origSocketID, eventName, currDT, origUID, recUID, packetBuffer);

                this.logger.debug(funcS("eventFuncs.emitEventOrStore", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            }
        } catch (error) {
            this.logger.error(errLog(error, `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            throw error;
        }
    }

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
            checkParams({
                recUID: recUID, 
                recSocket: recSocket, 
                recSocketID: recSocket.id, 
                eventName: eventName, 
                timeoutLength: timeoutLength
            }, ["recUID", "recSocket", "recSocketID", "eventName", "timeoutLength"]);

            try {
                await this.emitEventWithAck(origSocketID, origUID, recUID, recSocket, eventName, packetBuffer, timeoutLength);

                this.logger.debug(funcS("eventFuncs.emitEventWithAckOrStore", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            } catch (error) {
                // if (error.message != `event: ${eventName}, info: operation has timed out`) {
                //     throw error;
                // }

                this.logger.warn(errLog(error, `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));

                await this.db.createEvent(origSocketID, eventName, currDT, origUID, recUID, packetBuffer);

                this.logger.debug(funcS("eventFuncs.emitEventWithAckOrStore", `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            }
        } catch (error) {
            this.logger.error(errLog(error, `event: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            throw error;
        }
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
            checkParams({
                recUID: recUID, 
                eventName: eventName
            }, ["recUID", "eventName"]);

            if (recUID in this.connectedUsers) {
                let recSocketID = this.connectedUsers[recUID].socketID;

                let recSocket = await this.fetchSocket(origSocketID, origUID, recSocketID);

                await this.emitEvent(origSocketID, origUID, recSocket, recUID, eventName, packetBuffer);

                this.logger.debug(funcS("eventFuncs.checkOnlineEmit", `eventName: ${eventName}`, origSocketID, origUID, recSocketID, recUID));
            } else {
                this.logger.debug(funcS("eventFuncs.checkOnlineEmit", `eventName: ${eventName}`, origSocketID, origUID, undefined, recUID));
            }
        } catch (error) {
            this.logger.error(errLog(error, `eventName: ${eventName}`, origSocketID, origUID, undefined, recUID));
            throw error;
        }
    }

    async checkOnlineEmitWithAckOrStore(
        origSocketID = null,
        origUID = null, // the origUID that intiated the event 
        recUID, // the recUID that the packet is being sent to
        eventName,
        packetBuffer = null,
        timeoutLength,
    ) {
        try {
            checkParams({
                recUID: recUID, 
                eventName: eventName, 
                timeoutLength: timeoutLength
            }, ["recUID", "eventName", "timeoutLength"]);

            if (recUID in this.connectedUsers) {
                let recSocketID = this.connectedUsers[recUID].socketID;

                let recSocket = await this.fetchSocket(origSocketID, origUID, recSocketID);

                await this.emitEventWithAckOrStore(origSocketID, origUID, recSocket, recUID, eventName, packetBuffer, timeoutLength);

                this.logger.debug(funcS("eventFuncs.checkOnlineEmitWithAckOrStore", `eventName: ${eventName}`, origSocketID, origUID, recSocket.id, recUID));
            } else {
                await this.db.createEvent(origSocketID, eventName, currDT, origUID, recUID, packetBuffer);

                this.logger.debug(funcS("eventFuncs.checkOnlineEmitWithAckOrStore", `eventName: ${eventName}`, origSocketID, origUID, undefined, recUID));
            }
        } catch (error) {
            this.logger.error(errLog(error, `eventName: ${eventName}`, origSocketID, origUID, undefined, recUID));
            throw error;
        }
    }

    // - do a switch statement to handle specific events that need to be handled differently
    // - create large event packet to send all events to client and then the client response can determine how to handle each event
    async emitPendingEvents(
        userID,
        recSocket,
        timeoutLength = 2000,
        batchSize = 10,
    ) {
        try {
            checkParams({
                userID: userID, 
                recSocket: recSocket, 
                recSocketID: recSocket.id, 
                timeoutLength: timeoutLength, 
                batchSize: batchSize
            }, ["userID", "recSocket", "recSocketID", "timeoutLength", "batchSize"]);

            let pendingEvents = await this.db.fetchRecords(recSocket.id, userID, "EVENTS", "receivingUserID", userID, ["eventID", "eventName", "packet"], "datetime");

            let totalBatches = Math.ceil(pendingEvents.length / batchSize);

            for (let i = 0; i < totalBatches; i++) {

                if (recSocket.userdata.connected == false) {
                    throw new FuncErr(`socket disconnected`);
                }

                try {
                    let start = i * batchSize;
                    let end = start + batchSize;
                    let currentBatch = pendingEvents.slice(start, end);

                    let packetObject = currentBatch.reduce((acc, currEvent) => {
                        return acc[currEvent.eventID] = currEvent;
                    });

                    await this.emitEventBatch(userID, recSocket, packetObject, timeoutLength);

                    this.logger.debug(funcS("eventFuncs.emitPendingEvents", `batch: ${i}, eventCount: ${currentBatch.length}`, recSocket.id, userID, recSocket.id, userID));
                } catch (error) {
                    let batchIDs = pendingEvents.slice(i * batchSize, i * batchSize + batchSize).map(event => event.eventID);
                    this.logger.error(errLog(error, `emit event batch failed - batch: ${i}, eventIDs: ${batchIDs}`, recSocket.id, userID, recSocket.id, userID));
                }
            }

            await this.emitEvent(recSocket.id, userID, recSocket, userID, "receivedPendingEvents", null);

            this.logger.info(funcS("eventFuncs.emitPendingEvents", `eventCount: ${pendingEvents.length}, completedEvents: `, recSocket.id, userID, recSocket.id, userID));
        } catch (error) {
            this.logger.error(errLog(error, undefined, recSocket.id, userID, recSocket.id, userID));
        }
    }

    async emitEventBatch(
        userID,
        recSocket,
        packetObject,
        timeoutLength = 2000,
    ) {
        try {
            checkParams({
                userID: userID, 
                recSocket: recSocket, 
                recSocketID: recSocket.id, 
                packetObject: packetObject, 
                timeoutLength: timeoutLength
            }, ["userID", "recSocket", "recSocketID", "packetObject", "timeoutLength"]);

            let packetBuffer = Buffer.from(JSON.stringify(packetObject));

            let packetBuffer2;

            try {
                packetBuffer2 = await this.emitEventWithAck(recSocket.id, userID, recSocket, userID, "receivedPendingEvents", packetBuffer, timeoutLength);
            } catch (error) {
                if (error instanceof ClientResponseErr) {
                    this.logger.error(errLog(error, `client failed to handle event batch`, recSocket.id, userID, recSocket.id, userID));

                    await this.handleEventBatchIndiv(recSocket.id, userID, packetObject);
                } else {
                    throw error;
                }
            }

            let packetObject2 = JSON.parse(packetBuffer2.toString());

            Object.keys(packetObject2).forEach(async eventID => {
                try {
                    if (packetObject2[eventID] == true) {
                        this.db.deleteRecord(recSocket.id, userID, "EVENTS", "eventID", eventID);

                        this.logger.debug(funcS("eventFuncs.emitEventBatch", `completed emit - eventID: ${eventID}`, recSocket.id, userID, recSocket.id, userID));
                        completedEvents++;
                    } else if (packetObject2[eventID] == false) {
                        await this.handleEventFailure(recSocket.id, userID, packetObject2[eventID]);

                        this.db.deleteRecord(recSocket.id, userID, "EVENTS", "eventID", eventID);

                        this.logger.warn(funcS("eventFuncs.emitEventBatch", `handled failed clientResponse - eventID: ${eventID}`, recSocket.id, userID, recSocket.id, userID));
                    }
                } catch (error) {
                    this.logger.error(errLog(error, `failed to handle clientResponse - eventID: ${eventID}`, recSocket.id, userID, recSocket.id, userID));
                }
            });
        } catch (error) {
            this.error(errLog(error, undefined, recSocket.id, userID, recSocket.id, userID));
            throw error;
        }
    }

    async handleEventBatchIndiv(
        userID,
        recSocket,
        packetObject,
        timeoutLength = 2000
    ) {
        try {
            checkParams({
                userID: userID, 
                recSocket: recSocket, 
                recSocketID: recSocket.id, 
                packetObject: packetObject, 
                timeoutLength: timeoutLength
            }, ["userID", "recSocket", "recSocketID", "packetObject", "timeoutLength"]);

            for (let eventID in packetObject) {

                if (recSocket.userdata.connected == false) {
                    throw new FuncErr(`socket disconnected`);
                }

                try {
                    let event = packetObject[eventID];

                    switch (event.eventName) {
                        case "receivedCR":
                            let fetchedEvent = await this.db.fetchRecord("EVENTS", "eventID", event.eventID);

                            await this.receivedCR(undefined, fetchedEvent.origUID, recSocket, fetchedEvent.recUID, fetchedEvent.packet);
                            break;
                        default:
                            break;
                    }

                    this.logger.debug(funcS("eventFuncs.handleEventBatchIndiv", `eventID: ${eventID}, event: ${packetObject.eventID}`, recSocket.id, userID, recSocket.id, userID));
                } catch (error) {
                    this.logger.error(errLog(error, `eventID: ${eventID}, event: ${packetObject.eventID}`, recSocket.id, userID, recSocket.id, userID));
                }
            }
        } catch (error) {
            this.logger.error(errLog(error, `eventIDs: ${Object.keys(packetObject)}`, recSocket.id, userID, recSocket.id, userID));
            throw error;
        }
    }

    async handleEventFailure(
        origSocketID = null,
        origUID,
        packetObject
    ) {
        try {
            checkParams({
                origUID: origUID, 
                packetObject: packetObject
            }, ["origUID", "packetObject"]);

            checkPacketProps(packetObject, ["eventID", "eventName"]);

            switch (packetObject.eventName) {
                case "receivedCR":
                    let fetchedEvent = await this.db.fetchRecord("EVENTS", "eventID", packetObject.eventID);

                    await this.receivedCRFailure(undefined, fetchedEvent.origUID, fetchedEvent.recUID, packetObject);

                    break;
                default:
                    break;
            }

            this.logger.debug(funcS("eventFuncs.handleEventFailure", `event: ${packetObject.eventName}`, origSocketID, origUID, origSocketID, origUID));
        } catch (error) {
            this.logger.error(errLog(error, `event: ${packetObject.eventName}`, origSocketID, origUID, origSocketID, origUID));
        }
    }

    async deleteUserdata(
        origSocketID = null,
        userID
    ) {
        try {
            checkParams({
                userID: userID
            }, ["userID"]);

            await this.db.deleteCRsByUserID(userID);

            await this.db.deleteRUChannelsByUserID(userID);

            await this.db.deleteRecords("EVENTS", "receivingUserID", userID);

            await this.db.deleteRecord("USERS", "userID", userID);

            this.logger.debug(funcS("eventFuncs.deleteUserdata", `userID: ${userID}`, origSocketID, userID));
        } catch (error) {
            this.logger.error(errLog(error, `userID: ${userID}`, origSocketID, userID));
            throw error;
        };
    };

    async sendDeleteUserTrace(
        origSocketID = null,
        userID,
        RUIDs
    ) {
        try {
            checkParams({
                userID: userID, 
                RUIDs: RUIDs
            }, ["userID", "RUIDs"]);

            let packetObject = { "userID": userID };

            let packetBuffer = objectToBuffer(packetObject);

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmitWithAckOrStore(origSocketID, userID, RUIDs[i].userID, "deleteUserTrace", packetBuffer, 1000);

                    this.logger.debug(funcS("eventFuncs.sendDeleteUserTrace", origSocketID, userID, undefined, RUIDs[i].userID));
                } catch (error) {
                    this.logger.error(errLog(error, undefined, origSocketID, userID, undefined, RUIDs[i].userID));
                }
            }

            this.logger.debug(funcS("eventFuncs.sendDeleteUserTrace", `RUIDCount: ${RUIDs.length}`, origSocketID, userID));
        } catch (error) {
            this.logger.error(errLog(error, `userID: ${userID}`, origSocketID, userID));
        }
    }

    async sendUserConnect(
        origSocketID = null,
        origUID
    ) {
        try {
            checkParams({
                origUID: origUID
            }, ["origUID"]);

            let RUIDs = await this.db.fetchRUChannelsbyUserID(origUID, "userID");

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmit(origSocketID, origUID, RUIDs[i].userID, "userConnect", origUID);

                    this.logger.debug(funcS("eventFuncs.sendUserConnect", origSocketID, origUID, undefined, RUIDs[i].userID));
                } catch (error) {
                    this.logger.error(errLog(error, undefined, origSocketID, origUID, undefined, RUIDs[i].userID));
                }
            }

            this.logger.debug(funcS("eventFuncs.sendUserConnect", `event: userConnect`, origSocketID, origUID));
        } catch (error) {
            this.logger.error(errLog(error, undefined, origSocketID, origUID));
        }
    }

    async sendUserDisconnect(
        origSocketID = null,
        origUID
    ) {
        try {
            checkParams({
                origUID: origUID
            }, ["origUID"]);

            let RUIDs = await this.db.fetchRUChannelsbyUserID(origUID, "userID");

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmit(origSocketID, origUID, RUIDs[i].userID, "userDisconnect", origUID);

                    this.logger.debug(funcS("eventFuncs.sendUserDisconnect", origSocketID, origUID, undefined, RUIDs[i].userID));
                } catch (error) {
                    this.logger.error(errLog(error, undefined, origSocketID, origUID, undefined, RUIDs[i].userID));
                }
            }

            this.logger.debug(funcS("eventFuncs.sendUserDisconnect", `event: userDisconnect`, origSocketID, origUID));
        } catch (error) {
            this.logger.error(errLog(error, undefined, origSocketID, origUID));
        }
    }

    async checkRUIDsOnline(
        origSocketID = null,
        origUID = null,
        RUIDs
    ) {
        try {
            checkParams({
                RUIDs: RUIDs
            }, ["RUIDs"]);

            let returnRUIDs = {};

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    if (RUIDs[i] in this.connectedUsers) {
                        returnRUIDs[RUIDs[i]] = true;
                    } else {
                        let RULastOnline = await this.db.fetchRecord("USERS", "userID", RUIDs[i], undefined, undefined, "lastOnline");

                        if (RULastOnline != null) {
                            returnRUIDs[RUIDs[i]] = RU.lastOnline;
                        }
                    }

                    this.logger.debug(funcS("eventFuncs.checkRUIDsOnline", `RUID: ${RUIDs[i]}`, origSocketID, origUID));
                } catch (error) {
                    this.logger.error(errLog(error, `RUID: ${RUIDs[i]}`, origSocketID, origUID));
                }
            }

            this.logger.debug(funcS("eventFuncs.checkRUIDsOnline", `RUIDCount: ${RUIDs.length}`, origSocketID, origUID));
            return returnRUIDs;
        } catch (error) {
            this.logger.error(errLog(error, `RUIDCount: ${RUIDs.length}`, origSocketID, origUID));
            throw error;
        }
    }

    async checkCRs(
        userID,
        recSocket,
        clientRequestIDs,
        ack
    ) {
        try {
            checkParams({
                userID: userID, 
                recSocket: recSocket, 
                recSocketID: recSocket.id, 
                clientRequestIDs: clientRequestIDs, 
                ack: ack
            }, ["userID", "recSocket", "recSocketID", "clientRequestIDs", "ack"]);

            let serverRequestIDObjects = await this.db.fetchCRsByUserID(recSocket.id, userID, userID, "requestID");
            let serverRequestIDs = serverRequestIDObjects.map(CR => CR.requestID);

            let returnCRs = {};
            for (let i = 0; i < clientRequestIDs.length; i++) {
                if (!serverRequestIDs.includes(clientRequestIDs[i])) {
                    returnCRs[clientRequestIDs[i]] = false;
                }
            }

            ack(null, returnCRs);

            await this.sendMissingCRs(userID, recSocket, clientRequestIDs);

            this.logger.debug(funcS("eventFuncs.checkCRs", `requestIDCount: ${clientRequestIDs.length}, returnCRCount: ${Object.keys(returnCRs).length}`, recSocket.id, userID, recSocket.id, userID));
        } catch (error) {
            this.logger.error(errLog(error, `requestIDCount: ${clientRequestIDs.length}`, recSocket.id, userID, recSocket.id, userID));
            throw error;
        }
    }

    async sendMissingCRs(
        userID,
        recSocket,
        clientRequestIDs,
    ) {
        try {
            checkParams({
                userID: userID, 
                recSocket: recSocket, 
                recSocketID: recSocket.id, 
                clientRequestIDs: clientRequestIDs
            }, ["userID", "recSocket", "recSocketID", "clientRequestIDs"]);

            let missingCRCount = 0;
            for (let i = 0; i < serverRequestIDs.length; i++) {
                if (!clientRequestIDs.includes(serverRequestIDs[i])) {
                    try {
                        let CR = await this.db.fetchRecord(recSocket.id, userID, "CRs", "requestID", serverRequestIDs[i]);

                        let packetObject = {
                            requestID: CR.requestID,
                            date: CR.date
                        };

                        if (CR.originUserID == socket.userdata.userID && CR.receivingUserID != socket.userdata.userID) {
                            packetObject.isOrigin = true;

                            let RU = await db.fetchRecord(recSocket.id, userID, "USERS", "userID", CR.receivingUserID);
                            packetObject.RU = RU;
                        } else {
                            packetObject.isOrigin = false;

                            let RU = await db.fetchRecord(recSocket.id, userID, "USERS", "userID", CR.originUserID);
                            packetObject.RU = RU;
                        }

                        let packetBuffer = Buffer.from(JSON.stringify(packetObject));

                        await this.receivedCR(recSocket.id, userID, recSocket, userID, packetBuffer);

                        missingCRCount++;
                        this.logger.debug(funcS("eventFuncs.sendMissingCRs", `missing request sent - requestID: ${packetObject.requestID}`, recSocket.id, userID, recSocket.id, userID));
                    } catch (error) {
                        this.logger.warn(errLog(error, `failed to send missing request - requestID: ${serverRequestIDs[i]}`, recSocket.id, userID, recSocket.id, userID));

                        if (error.message == "db.fetchRecord - err: no results") {
                            try {
                                this.logger.warn(errLog(error, `failed to find RU - requestID: ${serverRequestIDs[i]}`, recSocket.id, userID, recSocket.id, userID));

                                await this.db.deleteRecord("CRs", "requestID", serverRequestIDs[i]);

                                this.logger.debug(funcS("eventFuncs.sendMissingCRs", `deleted CR - requestID: ${serverRequestIDs[i]}`, recSocket.id, userID, recSocket.id, userID));
                            } catch {
                                this.logger.error(errLog(error, `failed to delete CR - requestID: ${serverRequestIDs[i]}`, recSocket.id, userID, recSocket.id, userID));
                            }
                        }
                    }
                }
            }

            this.logger.debug(funcS("eventFuncs.sendMissingCRs", `requestIDCount: ${clientRequestIDs.length}, missingCRCount: ${missingCRCount}`, recSocket.id, userID, recSocket.id, userID));
        } catch (error) {
            this.logger.error(errLog(error, `requestIDCount: ${clientRequestIDs.length}`, recSocket.id, userID, recSocket.id, userID));
        }
    }

    async checkRUChannels(
        userID,
        recSocket,
        clientChannelIDs,
        ack
    ) {
        try {
            checkParams({
                userID: userID, 
                recSocket: recSocket, 
                recSocketID: recSocket.id, 
                clientChannelIDs: clientChannelIDs, 
                ack: ack
            }, ["userID", "recSocket", "recSocketID", "clientChannelIDs", "ack"]);

            let serverChannelIDObjects = await this.db.fetchRUChannelsbyUserID(recSocket.id, userID, userID, "channelID");
            let serverChannelIDs = serverChannelIDObjects.map(channel => channel.channelID);

            let returnRUChannels = {};
            for (let i = 0; i < clientChannelIDs.length; i++) {
                if (!serverChannelIDs.includes(clientChannelIDs[i])) {
                    returnRUChannels[clientChannelIDs[i]] = false;
                }
            }

            ack(null, returnRUChannels);

            await this.sendMissingRUChannels(userID, recSocket, clientChannelIDs, serverChannelIDs);

            this.logger.info(funcS("eventFuncs.checkRUChannels", `channelIDCount: ${clientChannelIDs.length}, returnRUChannelCount: ${Object.keys(returnRUChannels).length}`, recSocket.id, userID, recSocket.id, userID));
        } catch (error) {
            this.logger.error(errLog(error, `channelIDCount: ${clientChannelIDs.length}`, recSocket.id, userID, recSocket.id, userID));
            throw error;
        }
    }

    async sendMissingRUChannels(
        userID,
        recSocket,
        clientChannelIDs,
        serverChannelIDs
    ) {
        try {
            checkParams({
                userID: userID, 
                recSocket: recSocket, 
                recSocketID: recSocket.id, 
                clientChannelIDs: clientChannelIDs, 
                serverChannelIDs: serverChannelIDs
            }, ["userID", "recSocket", "recSocketID", "clientChannelIDs", "serverChannelIDs"]);

            let missingRUChannels = 0;
            for (let i = 0; i < serverChannelIDs.length; i++) {
                if (!clientChannelIDs.includes(serverRequestIDs[i])) {
                    try {
                        let RUChannel = await this.db.fetchRUChannelsByChannelID(recSocket.id, userID, serverChannelIDs[i], userID);

                        let RU;

                        try {
                            RU = await this.db.fetchRecord("USERS", "userID", RUChannel.userID);
                        } catch (error) {
                            if (error instanceof EmptyDBResult) {
                                try {
                                    await this.db.deleteRecord("RUChannels", "channelID", serverChannelIDs[i]);

                                    this.logger.debug(funcS("eventFuncs.sendMissingRUChannels", `deleted RUChannel - channelID: ${serverChannelIDs[i]}`, recSocket.id, userID, recSocket.id, userID));
                                } catch {
                                    this.logger.error(errLog(error, `failed to delete RUChannel - channelID: ${serverChannelIDs[i]}`, recSocket.id, userID, recSocket.id, userID));
                                }
                            }

                            throw error;
                        }

                        let packetObject = {
                            RUChannel: RUChannel,
                            RU: RU
                        }

                        await this.receivedRUChannel(recSocket.id, userID, recSocket, userID, packetObject);

                        missingRUChannels++;
                    } catch (error) {
                        this.logger.error(errLog(error, `failed to send missing RUChannel - channelID: ${serverChannelIDs[i]}`, recSocket.id, userID, recSocket.id, userID));
                    }
                }
            }

            this.logger.info(funcS("eventFuncs.sendMissingRUChannels", `channelIDCount: ${clientChannelIDs.length}, missingRUChannelCount: ${missingRUChannels}`, recSocket.id, userID, recSocket.id, userID));
        } catch (error) {
            this.logger.error(errLog(error, `channelIDCount: ${clientChannelIDs.length}`, recSocket.id, userID, recSocket.id, userID));
        }
    }

    async sendCR(
        origSocketID = null,
        origUID = null,
        recUID,
        packetBuffer,
        ack
    ) {
        try {
            checkParams({
                recUID: recUID, 
                packetBuffer: packetBuffer,
                ack: ack
            }, ["recUID", "packetBuffer", "ack"]);

            let packetObject = bufferToObject(packetBuffer);

            checkPacketProps(packetObject, ["requestID", "date", "isOrigin"]);

            await this.db.createCR(origSocketID, packetObject.requestID, origUID, recUID, packetObject.date);

            ack(null);
            this.logger.debug(funcS("eventFuncs.sendCR", `requestID: ${packetObject.requestID}`, origSocketID, origUID, undefined, recUID));

            return packetObject;
        } catch (error) {
            this.logger.error(errLog(error, undefined, origSocketID, origUID, undefined, recUID));
            throw error;
        }
    }

    async receivedCR(
        origSocketID = null,
        origUID = null,
        recSocket = null, // specify the socket if event is being emitted to the origUID
        recUID,
        packetObject
    ) {
        try {
            checkParams({
                recUID: recUID, 
                packetObject: packetObject
            }, ["recUID", "packetObject"]);

            checkPacketProps(packetObject, ["requestID", "date", "isOrigin"]);

            let RU = await this.db.fetchRecord("USERS", "userID", origUID);
            packetObject.RU = RU;

            let packetBuffer = bufferToObject(packetBuffer);

            if (recSocket) {
                await this.emitEventWithAckOrStore(origSocketID, origUID, recSocket, recUID, "receivedCR", packetBuffer, 1000);
            } else {
                await this.checkOnlineEmitWithAck(origSocketID, origUID, recUID, undefined, "receivedCR", packetBuffer);
            }

            this.logger.debug(funcS("eventFuncs.receivedCR", `requestID: ${packetObject.requestID}`, origSocketID, origUID, undefined, recUID));
        } catch (error) {
            this.logger.error(errLog(error, undefined, origSocketID, origUID, undefined, recUID));

            await this.receivedCRFailure(origSocketID, origUID, recUID, packetObject);

            throw error;
        }
    }   

    async receivedCRFailure(
        origSocketID = null,
        origUID = null,
        recUID,
        packetObject
    ) {
        try {
            checkParams({
                recUID: recUID, 
                packetObject: packetObject
            }, ["recUID", "packetObject"]);

            checkPacketProps(packetObject, ["requestID"]);

            await this.db.deleteRecord("CRs", "requestID", packetObject.requestID);

            this.logger.debug(funcS("eventFuncs.receivedCRFailure", `requestID: ${packetObject.requestID}`, origSocketID, origUID, undefined, recUID));
        } catch (error) {
            this.logger.error(errLog(error, `requestID: ${packetObject.requestID}`, origSocketID, origUID, undefined, recUID));
        }
    }

    async sendCRResult(
        origUID,
        recUID,
        packetBuffer
    ) {
        try {

        } catch (error) {

        };
    };

    async receivedRUChannel(
        origSocketID = null,
        origUID = null,
        recSocket,
        recUID,
        packetObject
    ) {
        try {
            checkParams({
                recSocket: recSocket, 
                recSocketID: recSocket.id,
                recUID: recUID, 
                packetObject: packetObject
            }, ["recSocket", "recSocketID", "recUID", "packetObject"]);

            let packetBuffer = objectToBuffer(packetObject);

            await this.emitEventWithAckOrStore(origSocketID, origUID, recSocket, recUID, "receivedRUChannel", packetBuffer, 1000);

            this.logger.debug(funcS("eventFuncs.receivedRUChannel", `channelID: ${packetObject.channelID}`, origSocketID, origUID, recSocket.id, recUID));
        } catch (error) {
            this.logger.error(errLog(error, `channelID: ${packetObject.channelID}`, origSocketID, origUID, recSocket.id, recUID));
            throw error;
        }
    }

    async receivedRUChannelFailure(

    ) {

    }

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

