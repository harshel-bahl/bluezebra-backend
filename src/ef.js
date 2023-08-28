const { io } = require('./server');
const db = require('./db');
const auth = require('./auth');

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
    FuncErr,
    ClientResponseErr,
    EmitErr,
    ...errors
} = require('./error');

const {
    currDT,
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

class EF {

    async fetchSocket(
        socketID = null,
        UID = null,
        querySocketID,
    ) {
        try {
            checkParams({
                querySocketID: querySocketID
            }, ["querySocketID"]);

            let sockets = await io.in(querySocketID).fetchSockets();

            if (sockets.length == 0) {
                throw new SocketStatusErr("socket not found");
            } else if (sockets.length > 1) {
                throw new SocketStatusErr("multiple sockets found");
            }

            logDebug("fetched socket", "EF.fetchSocket", undefined, undefined, `querySocketID: ${querySocketID}`, socketID, UID);

            return sockets[0];

        } catch (error) {
            logDebug("failed to fetch socket", "EF.fetchSocket", undefined, error, `querySocketID: ${querySocketID}`, socketID, UID);
            throw error;
        }
    }

    emitEvent(
        socketID = null,
        UID = null,
        recSocket,
        recSocketID,
        recUID,
        eventName,
        packetBuffer = null
    ) {
        return new Promise((resolve, reject) => {
            try {
                checkParams({
                    recSocket: recSocket,
                    recSocketID: recSocketID,
                    recUID: recUID,
                    eventName: eventName
                }, ["recSocket", "recSocketID", "recUID", "eventName"]);

                if (packetBuffer) {

                    recSocket.emit(eventName, packetBuffer);

                    logDebug("emitted event", "EF.emitEvent", undefined, undefined, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
                    resolve();
                } else {

                    recSocket.emit(eventName);

                    logDebug("emitted event", "EF.emitEvent", undefined, undefined, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
                    resolve();
                }
            } catch (error) {
                logDebug("failed to emit event", "EF.emitEvent", undefined, error, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
                reject(error);
            }
        })
    }

    emitEventWithAck(
        socketID = null,
        UID = null,
        recSocket,
        recSocketID,
        recUID,
        eventName,
        packetBuffer = null,
        timeoutLength
    ) {
        return new Promise((resolve, reject) => {
            try {
                checkParams({
                    recSocket: recSocket,
                    recSocketID: recSocketID,
                    recUID: recUID,
                    eventName: eventName,
                    timeoutLength: timeoutLength
                }, ["recSocket", "recSocketID", "recUID", "eventName", "timeoutLength"]);

                if (packetBuffer) {
                    recSocket.timeout(timeoutLength).emit(eventName, packetBuffer, async (err, response) => {
                        try {
                            if (err) {
                                throw new EmitErr(err.message);
                            } else if (response[0] != null) {
                                throw new ClientResponseErr(response[0]);
                            }

                            logDebug("emitted event with ack", "EF.emitEventWithAck", undefined, undefined, `event: ${eventName}`, socketID, UID, recSocketID, recUID);

                            if (response[1] != null) {
                                resolve(response[1]);
                            } else {
                                resolve();
                            }

                        } catch (error) {
                            logDebug("failed to emit event with ack", "EF.emitEventWithAck", undefined, error, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
                            reject(error);
                        }
                    })
                } else {
                    recSocket.timeout(timeoutLength).emit(eventName, async (err, response) => {
                        try {
                            if (err) {
                                throw new EmitErr(err.message);
                            } else if (response[0] != null) {
                                throw new ClientResponseErr(response[0]);
                            }

                            logDebug("emitted event with ack", "EF.emitEventWithAck", undefined, undefined, `event: ${eventName}`, socketID, UID, recSocketID, recUID);

                            if (response[1] != null) {
                                resolve(response[1]);
                            } else {
                                resolve();
                            }

                        } catch (error) {
                            logDebug("failed to emit event with ack", "EF.emitEventWithAck", undefined, error, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
                            reject(error);
                        }
                    })
                }
            } catch (error) {
                logDebug("failed to emit event with ack", "EF.emitEventWithAck", undefined, error, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
                reject(error);
            }
        })
    }

    async emitEventOrStore(
        socketID = null,
        UID = null,
        origUID,
        recSocket,
        recSocketID,
        recUID,
        eventName,
        packetBuffer = null
    ) {
        try {
            checkParams({
                origUID: origUID,
                recSocket: recSocket,
                recSocketID: recSocketID,
                recUID: recUID,
                eventName: eventName
            }, ["origUID", "recSocket", "recSocketID", "recUID", "eventName"]);

            try {
                await this.emitEvent(socketID, UID, recSocket, recSocketID, recUID, eventName, packetBuffer);

                logDebug("emitted event", "EF.emitEventOrStore", undefined, undefined, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
            } catch (error) {
                logWarn("failed to emit event", "EF.emitEventOrStore", undefined, error, `event: ${eventName}`, socketID, UID, recSocketID, recUID);

                await db.createEvent(socketID, UID, eventName, currDT, origUID, recUID, packetBuffer);

                logDebug("stored event", "EF.emitEventOrStore", undefined, undefined, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
            }
        } catch (error) {
            logDebug("failed to emit event", "EF.emitEventOrStore", undefined, error, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
            throw error;
        }
    }

    async emitEventWithAckOrStore(
        socketID = null,
        UID = null,
        origUID,
        recSocket,
        recSocketID,
        recUID,
        eventName,
        packetBuffer = null, // expected to be binary buffer but supports various objects too
        timeoutLength
    ) {
        try {
            checkParams({
                origUID: origUID,
                recSocket: recSocket,
                recSocketID: recSocketID,
                recUID: recUID,
                eventName: eventName,
                timeoutLength: timeoutLength
            }, ["origUID", "recSocket", "recSocketID", "recUID", "eventName", "timeoutLength"]);

            try {
                await this.emitEventWithAck(socketID, UID, recSocket, recSocketID, recUID, eventName, packetBuffer, timeoutLength);

                logDebug("emitted event with ack", "EF.emitEventWithAckOrStore", undefined, undefined, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
            } catch (error) {

                if (error instanceof ClientResponseErr) {
                    throw error;
                }

                logWarn("failed to emit event with ack", "EF.emitEventWithAckOrStore", undefined, error, `event: ${eventName}`, socketID, UID, recSocketID, recUID);

                await db.createEvent(socketID, UID, eventName, currDT, origUID, recUID, packetBuffer);

                logDebug("stored event", "EF.emitEventWithAckOrStore", undefined, undefined, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
            }
        } catch (error) {
            logDebug("failed to emit event with ack", "EF.emitEventWithAckOrStore", undefined, error, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
            throw error;
        }
    }

    // checkOnlineEmit
    // 
    async checkOnlineEmit(
        socketID = null,
        UID = null,
        recUID,
        eventName,
        packetBuffer = null
    ) {
        try {
            checkParams({
                recUID: recUID,
                eventName: eventName
            }, ["recUID", "eventName"]);

            if (recUID in auth.connectedUsers) {
                let recSocketID = auth.connectedUsers[recUID].socketID;

                let recSocket = await this.fetchSocket(socketID, UID, recSocketID);

                await this.emitEvent(socketID, UID, recSocket, recSocketID, recUID, eventName, packetBuffer);

                logDebug("emitted event", "EF.checkOnlineEmit", undefined, undefined, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
            } else {
                logDebug("user not online", "EF.checkOnlineEmit", undefined, undefined, `event: ${eventName}`, socketID, UID, undefined, recUID);
            }
        } catch (error) {
            logDebug("failed to emit event", "EF.checkOnlineEmit", undefined, error, `event: ${eventName}`, socketID, UID, undefined, recUID);
            throw error;
        }
    }

    async checkOnlineEmitWithAckOrStore(
        socketID = null,
        UID = null,
        origUID,
        recUID,
        eventName,
        packetBuffer = null,
        timeoutLength,
    ) {
        try {
            checkParams({
                origUID: origUID,
                recUID: recUID,
                eventName: eventName,
                timeoutLength: timeoutLength
            }, ["origUID", "recUID", "eventName", "timeoutLength"]);

            if (recUID in auth.connectedUsers) {
                let recSocketID = auth.connectedUsers[recUID].socketID;

                let recSocket = await this.fetchSocket(socketID, UID, recSocketID);

                await this.emitEventWithAckOrStore(socketID, UID, origUID, recSocket, recSocketID, recUID, eventName, packetBuffer, timeoutLength);

                logDebug("emitted event with ack", "EF.checkOnlineEmitWithAckOrStore", undefined, undefined, `event: ${eventName}`, socketID, UID, recSocketID, recUID);
            } else {
                await db.createEvent(socketID, UID, eventName, currDT, origUID, recUID, packetBuffer);

                logDebug("stored event", "EF.checkOnlineEmitWithAckOrStore", undefined, undefined, `event: ${eventName}`, socketID, UID, undefined, recUID);
            }
        } catch (error) {
            logDebug("failed to emit event with ack", "EF.checkOnlineEmitWithAckOrStore", undefined, error, `event: ${eventName}`, socketID, UID, undefined, recUID);
            throw error;
        }
    }
    /////
    async emitPendingEvents(
        socketID = null,
        UID = null,
        recSocket,
        recSocketID,
        recUID,
        timeoutLength = 2000,
        batchSize = 10,
    ) {
        try {
            checkParams({
                recSocket: recSocket,
                recSocketID: recSocketID,
                recUID: recUID,
                timeoutLength: timeoutLength,
                batchSize: batchSize
            }, ["recSocket", "recSocketID", "recUID", "timeoutLength", "batchSize"]);

            let pendingEvents = await db.fetchRecords(socketID, UID, "EVENTS", { "recUID": recUID }, ["eventID", "eventName", "packet"], "datetime");

            let totalBatches = Math.ceil(pendingEvents.length / batchSize);

            for (let i = 0; i < totalBatches; i++) {

                checkSocketStatus(recSocket);

                try {
                    let start = i * batchSize;
                    let end = start + batchSize;
                    let currentBatch = pendingEvents.slice(start, end);

                    let packetObject = currentBatch.reduce((acc, currEvent) => {
                        return acc[currEvent.eventID] = currEvent;
                    });

                    await this.emitEventBatch(socketID, UID, recSocket, recSocketID, recUID, packetObject, timeoutLength);

                    logDebug("emitted event batch", "EF.emitPendingEvents", undefined, undefined, `batch: ${i}, eventCount: ${currentBatch.length}`, socketID, UID, recSocketID, recUID);
                } catch (error) {
                    let batchIDs = pendingEvents.slice(i * batchSize, i * batchSize + batchSize).map(event => event.eventID);
                    logWarn("failed to emit event batch", "EF.emitPendingEvents", undefined, error, `batch: ${i}, eventIDs: ${batchIDs}`, socketID, UID, recSocketID, recUID);
                }
            }

            await this.emitEvent(socketID, UID, recSocket, recSocketID, recUID, "receivedPendingEvents", null);

            logInfo("emitted pending events", "EF.emitPendingEvents", undefined, undefined, `eventCount: ${pendingEvents.length}`, socketID, UID, recSocketID, recUID);
        } catch (error) {
            if (error instanceof SocketStatusErr) {
                logWarn("failed to emit pending events", "EF.emitPendingEvents", undefined, error, undefined, socketID, UID, recSocketID, recUID);
            } else {
                logError("failed to emit pending events", "EF.emitPendingEvents", undefined, error, undefined, socketID, UID, recSocketID, recUID);
            }
        }
    }
    /////
    async emitEventBatch(
        socketID = null,
        UID = null,
        recSocket,
        recSocketID,
        recUID,
        packetObject,
        timeoutLength = 2000,
    ) {
        try {
            checkParams({
                recSocket: recSocket,
                recSocketID: recSocketID,
                recUID: recUID,
                packetObject: packetObject,
                timeoutLength: timeoutLength
            }, ["recSocket", "recSocketID", "recUID", "packetObject", "timeoutLength"]);

            let packetBuffer = objectToBuffer(packetObject);

            let packetBuffer2;

            try {
                packetBuffer2 = await this.emitEventWithAck(socketID, UID, recSocket, recSocketID, recUID, "receivedPendingEvents", packetBuffer, timeoutLength);
            } catch (error) {
                if (error instanceof ClientResponseErr) {
                    logError("failed event batch", "EF.emitEventBatch", undefined, error, undefined, socketID, UID, recSocketID, recUID);

                    await this.handleEventBatchIndiv(socketID, UID, recSocket, recSocketID, recUID, packetObject);

                    return;
                } else {
                    throw error;
                }
            }

            let packetObject2 = bufferToObject(packetBuffer2);

            Object.keys(packetObject2).forEach(async eventID => {
                try {
                    if (packetObject2[eventID] == true) {
                        await db.deleteRecords(socketID, UID, "EVENTS", {"eventID": eventID}, true);

                        logDebug("completed event emit", "EF.emitEventBatch", undefined, undefined, `eventID: ${eventID}`, socketID, UID, recSocketID, recUID);
                        completedEvents++;
                    } else if (packetObject2[eventID] == false) {
                        await this.handleEventFailure(socketID, UID, packetObject2[eventID]);

                        await db.deleteRecords(socketID, UID, "EVENTS", {"eventID": eventID}, true);

                        logWarn("handled failed clientResponse", "EF.emitEventBatch", undefined, undefined, `eventID: ${eventID}`, socketID, UID, recSocketID, recUID, packetObject2[eventID]);
                    }
                } catch (error) {
                    logError("failed to handle event emit", "EF.emitEventBatch", undefined, error, `eventID: ${eventID}`, socketID, UID, recSocketID, recUID);
                }
            });
        } catch (error) {
            logError("failed event batch", "EF.emitEventBatch", undefined, error, undefined, socketID, UID, recSocketID, recUID, packetObject);

            throw error;
        }
    }
    ////
    async handleEventBatchIndiv(
        socketID = null,
        UID = null,
        recSocket,
        recSocketID,
        recUID,
        packetObject,
        timeoutLength = 2000
    ) {
        try {
            checkParams({
                recSocket: recSocket,
                recSocketID: recSocketID,
                recUID: recUID,
                packetObject: packetObject,
                timeoutLength: timeoutLength
            }, ["recSocket", "recSocketID", "recUID", "packetObject", "timeoutLength"]);

            for (let eventID in packetObject) {

                checkSocketStatus(recSocket);

                try {
                    let event = packetObject[eventID];

                    checkObjReqProps(event, ["eventID", "eventName"]);

                    switch (event.eventName) {
                        case "receivedCR":
                            let fetchedEvent = await db.fetchRecords(socketID, UID, "EVENTS", {"eventID": event.eventID}, true);

                            checkObjReqProps(fetchedEvent, ["eventID", "eventName", "datetime", "origUID", "recUID", "packet"]);

                            await this.receivedCR(socketID, UID, fetchEvent.origUID, recSocket, recSocketID, recUID, fetchedEvent.packet);
                            break;
                        default:
                            break;
                    }

                    logDebug("completed event", "EF.handleEventBatchIndiv", undefined, undefined, `eventID: ${eventID}, event: ${event.eventName}`, socketID, UID, recSocketID, recUID);
                } catch (error) {
                    logError("failed to emit event", "EF.handleEventBatchIndiv", undefined, error, `eventID: ${eventID}, event: ${event.eventName}`, socketID, UID, recSocketID, recUID, packetObject[eventID]);
                }
            }
        } catch (error) {
            if (error instanceof SocketStatusErr) {
                logWarn("failed to emit event", "EF.handleEventBatchIndiv", undefined, error, undefined, socketID, UID, recSocketID, recUID, packetObject[eventID]);
            } else {
                logError("failed to emit event", "EF.handleEventBatchIndiv", undefined, error, undefined, socketID, UID, recSocketID, recUID, packetObject[eventID]);
            }

            throw error;
        }
    }
    ////
    async handleEventFailure(
        socketID,
        UID, 
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
        socketID = null,
        UID = null,
        queryUID
    ) {
        try {
            checkParams({
                queryUID: queryUID
            }, ["queryUID"]);

            await db.deleteCRsByUserID(socketID, UID, queryUID);

            await db.deleteRUChannelsByUserID(socketID, UID, queryUID);

            await db.deleteRecords(socketID, UID, "EVENTS", {"recUID": queryUID});

            await db.deleteRecords(socketID, UID, "USERS", {"UID": queryUID});

            logDebug("deleted userdata", "EF.deleteUserdata", undefined, undefined, `UID: ${queryUID}`, socketID, UID);
        } catch (error) {
            logError("failed to delete userdata", "EF.deleteUserdata", undefined, error, `UID: ${queryUID}`, socketID, UID);
            throw error;
        };
    };
    
    async sendDeleteUserTrace(
        socketID = null,
        UID = null,
        queryUID
    ) {
        try {
            checkParams({
                queryUID: queryUID
            }, ["queryUID"]);

            let RUIDs = await db.fetchRecRUChannelsbyUserID(socketID, UID, data.UID, "UID");

            let packetObject = { "queryUID": queryUID };

            let packetBuffer = objectToBuffer(packetObject);

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmitWithAckOrStore(socketID, UID, queryUID, RUIDs[i].UID, "deleteUserTrace", packetBuffer, 1000);

                    logDebug("emitted delete user trace", "EF.sendDeleteUserTrace", undefined, undefined, `event: deleteUserTrace`, socketID, UID, undefined, RUIDs[i].UID);
                } catch (error) {
                    logError("failed to emit delete user trace", "EF.sendDeleteUserTrace", undefined, error, `event: deleteUserTrace`, socketID, UID, undefined, RUIDs[i].UID);
                }
            }

            logDebug("emitted delete user trace events", "EF.sendDeleteUserTrace", undefined, undefined, `event: deleteUserTrace`, socketID, UID);
        } catch (error) {
            logError("failed to emit delete user trace events", "EF.sendDeleteUserTrace", undefined, error, `event: deleteUserTrace`, socketID, UID);
        }
    }

    async sendUserConnect(
        socketID = null,
        UID = null,
        queryUID
    ) {
        try {
            checkParams({
                queryUID: queryUID
            }, ["queryUID"]);

            let RUIDs = await db.fetchRecRUChannelsbyUserID(socketID, UID, queryUID, "UID");

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmit(socketID, UID, RUIDs[i].UID, "userConnect", queryUID);

                    logDebug("emitted user connect", "EF.sendUserConnect", undefined, undefined, `event: userConnect`, socketID, UID, undefined, RUIDs[i].UID);
                } catch (error) {
                    logError("failed to emit user connect", "EF.sendUserConnect", undefined, error, `event: userConnect`, socketID, UID, undefined, RUIDs[i].UID);
                }
            }

            logInfo("emitted user connect events", "EF.sendUserConnect", undefined, undefined, `event: userConnect`, socketID, UID);
        } catch (error) {
            logError("failed to emit user connect events", "EF.sendUserConnect", undefined, error, `event: userConnect`, socketID, UID);
        }
    }

    async sendUserDisconnect(
        socketID = null,
        UID = null,
        queryUID
    ) {
        try {
            checkParams({
                queryUID: queryUID
            }, ["queryUID"]);

            let RUIDs = await db.fetchRecRUChannelsbyUserID(socketID, UID, queryUID, "UID");

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmit(socketID, UID, RUIDs[i].userID, "userDisconnect", queryUID);

                    logDebug("emitted user disconnect", "EF.sendUserDisconnect", undefined, undefined, `event: userDisconnect`, socketID, UID, undefined, RUIDs[i].userID);
                } catch (error) {
                    logError("failed to emit user disconnect", "EF.sendUserDisconnect", undefined, error, `event: userDisconnect`, socketID, UID, undefined, RUIDs[i].userID);
                }
            }

            logInfo("emitted user disconnect events", "EF.sendUserDisconnect", undefined, undefined, `event: userDisconnect`, socketID, UID);
        } catch (error) {
            logError("failed to emit user disconnect events", "EF.sendUserDisconnect", undefined, error, `event: userDisconnect`, socketID, UID);
        }
    }
    
    async checkRUIDsOnline(
        socketID = null,
        UID = null,
        RUIDs
    ) {
        try {
            checkParams({
                RUIDs: RUIDs
            }, ["RUIDs"]);

            let returnRUIDs = {};

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    if (RUIDs[i] in auth.connectedUsers) {
                        returnRUIDs[RUIDs[i]] = true;
                    } else {
                        let RULastOnline = await db.fetchRecords(socketID, UID, "USERS", {"UID": RUIDs[i]}, "lastOnline", undefined, undefined, undefined, true, true);

                        returnRUIDs[RUIDs[i]] = RULastOnline.lastOnline;
                    }

                    logDebug("checked RUID online", "EF.checkRUIDsOnline", undefined, undefined, `RUID: ${RUIDs[i]}`, socketID, UID);
                } catch (error) {
                    logError("failed to check RUID online", "EF.checkRUIDsOnline", undefined, error, `RUID: ${RUIDs[i]}`, socketID, UID);
                }
            }

            logDebug("checked RUIDs online", "EF.checkRUIDsOnline", undefined, undefined, `RUIDCount: ${returnRUIDs.length}`, socketID, UID);

            return returnRUIDs;
        } catch (error) {
            logError("failed to check RUIDs online", "EF.checkRUIDsOnline", undefined, error, `RUIDCount: ${RUIDs.length}`, socketID, UID);
            throw error;
        }
    }
    ////
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
////
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
////
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
/////
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
/////
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
////
    async receivedCR(
        socketID = null,
        UID = null,
        origUID,
        recSocket = null, 
        recSocketID = null,
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
////
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
///
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


module.exports = new EF();

