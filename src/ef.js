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
        uID = null,
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

            logDebug("fetched socket", "EF.fetchSocket", undefined, undefined, `querySocketID: ${querySocketID}`, socketID, uID);

            return sockets[0];

        } catch (error) {
            logDebug("failed to fetch socket", "EF.fetchSocket", undefined, error, `querySocketID: ${querySocketID}`, socketID, uID);
            throw error;
        }
    }

    emitEvent(
        socketID = null,
        uID = null,
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

                    logDebug("emitted event", "EF.emitEvent", undefined, undefined, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
                    resolve();
                } else {

                    recSocket.emit(eventName);

                    logDebug("emitted event", "EF.emitEvent", undefined, undefined, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
                    resolve();
                }
            } catch (error) {
                logDebug("failed to emit event", "EF.emitEvent", undefined, error, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
                reject(error);
            }
        })
    }

    emitEventWithAck(
        socketID = null,
        uID = null,
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

                            logDebug("emitted event with ack", "EF.emitEventWithAck", undefined, undefined, `event: ${eventName}`, socketID, uID, recSocketID, recUID);

                            if (response[1] != null) {
                                resolve(response[1]);
                            } else {
                                resolve();
                            }

                        } catch (error) {
                            logDebug("failed to emit event with ack", "EF.emitEventWithAck", undefined, error, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
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

                            logDebug("emitted event with ack", "EF.emitEventWithAck", undefined, undefined, `event: ${eventName}`, socketID, uID, recSocketID, recUID);

                            if (response[1] != null) {
                                resolve(response[1]);
                            } else {
                                resolve();
                            }

                        } catch (error) {
                            logDebug("failed to emit event with ack", "EF.emitEventWithAck", undefined, error, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
                            reject(error);
                        }
                    })
                }
            } catch (error) {
                logDebug("failed to emit event with ack", "EF.emitEventWithAck", undefined, error, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
                reject(error);
            }
        })
    }

    async emitEventOrStore(
        socketID = null,
        uID = null,
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
                await this.emitEvent(socketID, uID, recSocket, recSocketID, recUID, eventName, packetBuffer);

                logDebug("emitted event", "EF.emitEventOrStore", undefined, undefined, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
            } catch (error) {
                logWarn("failed to emit event", "EF.emitEventOrStore", undefined, error, `event: ${eventName}`, socketID, uID, recSocketID, recUID);

                await db.createEvent(socketID, uID, eventName, currDT, origUID, recUID, packetBuffer);

                logDebug("stored event", "EF.emitEventOrStore", undefined, undefined, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
            }
        } catch (error) {
            logDebug("failed to emit event", "EF.emitEventOrStore", undefined, error, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
            throw error;
        }
    }

    async emitEventWithAckOrStore(
        socketID = null,
        uID = null,
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
                await this.emitEventWithAck(socketID, uID, recSocket, recSocketID, recUID, eventName, packetBuffer, timeoutLength);

                logDebug("emitted event with ack", "EF.emitEventWithAckOrStore", undefined, undefined, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
            } catch (error) {

                if (error instanceof ClientResponseErr) {
                    throw error;
                }

                logWarn("failed to emit event with ack", "EF.emitEventWithAckOrStore", undefined, error, `event: ${eventName}`, socketID, uID, recSocketID, recUID);

                await db.createEvent(socketID, uID, eventName, currDT, origUID, recUID, packetBuffer);

                logDebug("stored event", "EF.emitEventWithAckOrStore", undefined, undefined, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
            }
        } catch (error) {
            logDebug("failed to emit event with ack", "EF.emitEventWithAckOrStore", undefined, error, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
            throw error;
        }
    }

    // checkOnlineEmit
    // 
    async checkOnlineEmit(
        socketID = null,
        uID = null,
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

                let recSocket = await this.fetchSocket(socketID, uID, recSocketID);

                await this.emitEvent(socketID, uID, recSocket, recSocketID, recUID, eventName, packetBuffer);

                logDebug("emitted event", "EF.checkOnlineEmit", undefined, undefined, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
            } else {
                logDebug("user not online", "EF.checkOnlineEmit", undefined, undefined, `event: ${eventName}`, socketID, uID, undefined, recUID);
            }
        } catch (error) {
            logDebug("failed to emit event", "EF.checkOnlineEmit", undefined, error, `event: ${eventName}`, socketID, uID, undefined, recUID);
            throw error;
        }
    }

    async checkOnlineEmitWithAckOrStore(
        socketID = null,
        uID = null,
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

                let recSocket = await this.fetchSocket(socketID, uID, recSocketID);

                await this.emitEventWithAckOrStore(socketID, uID, origUID, recSocket, recSocketID, recUID, eventName, packetBuffer, timeoutLength);

                logDebug("emitted event with ack", "EF.checkOnlineEmitWithAckOrStore", undefined, undefined, `event: ${eventName}`, socketID, uID, recSocketID, recUID);
            } else {
                await db.createEvent(socketID, uID, eventName, currDT, origUID, recUID, packetBuffer);

                logDebug("stored event", "EF.checkOnlineEmitWithAckOrStore", undefined, undefined, `event: ${eventName}`, socketID, uID, undefined, recUID);
            }
        } catch (error) {
            logDebug("failed to emit event with ack", "EF.checkOnlineEmitWithAckOrStore", undefined, error, `event: ${eventName}`, socketID, uID, undefined, recUID);
            throw error;
        }
    }
    /////
    async emitPendingEvents(
        socketID = null,
        uID = null,
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

            let pendingEvents = await db.fetchRecords(socketID, uID, "EVENTS", { "recUID": recUID }, ["eventID", "eventName", "packet"], "datetime");

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

                    await this.emitEventBatch(socketID, uID, recSocket, recSocketID, recUID, packetObject, timeoutLength);

                    logDebug("emitted event batch", "EF.emitPendingEvents", undefined, undefined, `batch: ${i}, eventCount: ${currentBatch.length}`, socketID, uID, recSocketID, recUID);
                } catch (error) {
                    let batchIDs = pendingEvents.slice(i * batchSize, i * batchSize + batchSize).map(event => event.eventID);
                    logWarn("failed to emit event batch", "EF.emitPendingEvents", undefined, error, `batch: ${i}, eventIDs: ${batchIDs}`, socketID, uID, recSocketID, recUID);
                }
            }

            await this.emitEvent(socketID, uID, recSocket, recSocketID, recUID, "receivedPendingEvents", null);

            logInfo("emitted pending events", "EF.emitPendingEvents", undefined, undefined, `eventCount: ${pendingEvents.length}`, socketID, uID, recSocketID, recUID);
        } catch (error) {
            if (error instanceof SocketStatusErr) {
                logWarn("failed to emit pending events", "EF.emitPendingEvents", undefined, error, undefined, socketID, uID, recSocketID, recUID);
            } else {
                logError("failed to emit pending events", "EF.emitPendingEvents", undefined, error, undefined, socketID, uID, recSocketID, recUID);
            }
        }
    }
    /////
    async emitEventBatch(
        socketID = null,
        uID = null,
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
                packetBuffer2 = await this.emitEventWithAck(socketID, uID, recSocket, recSocketID, recUID, "receivedPendingEvents", packetBuffer, timeoutLength);
            } catch (error) {
                if (error instanceof ClientResponseErr) {
                    logError("failed event batch", "EF.emitEventBatch", undefined, error, undefined, socketID, uID, recSocketID, recUID);

                    await this.handleEventBatchIndiv(socketID, uID, recSocket, recSocketID, recUID, packetObject);

                    return;
                } else {
                    throw error;
                }
            }

            let packetObject2 = bufferToObject(packetBuffer2);

            Object.keys(packetObject2).forEach(async eventID => {
                try {
                    if (packetObject2[eventID] == true) {
                        await db.deleteRecords(socketID, uID, "EVENTS", { "eventID": eventID }, true);

                        logDebug("completed event emit", "EF.emitEventBatch", undefined, undefined, `eventID: ${eventID}`, socketID, uID, recSocketID, recUID);
                        completedEvents++;
                    } else if (packetObject2[eventID] == false) {
                        await this.handleEventFailure(socketID, uID, packetObject2[eventID]);

                        await db.deleteRecords(socketID, uID, "EVENTS", { "eventID": eventID }, true);

                        logWarn("handled failed clientResponse", "EF.emitEventBatch", undefined, undefined, `eventID: ${eventID}`, socketID, uID, recSocketID, recUID, packetObject2[eventID]);
                    }
                } catch (error) {
                    logError("failed to handle event emit", "EF.emitEventBatch", undefined, error, `eventID: ${eventID}`, socketID, uID, recSocketID, recUID);
                }
            });
        } catch (error) {
            logError("failed event batch", "EF.emitEventBatch", undefined, error, undefined, socketID, uID, recSocketID, recUID, packetObject);

            throw error;
        }
    }
    ////
    async handleEventBatchIndiv(
        socketID = null,
        uID = null,
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
                            let fetchedEvent = await db.fetchRecords(socketID, uID, "EVENTS", { "eventID": event.eventID }, true);

                            checkObjReqProps(fetchedEvent, ["eventID", "eventName", "datetime", "origUID", "recUID", "packet"]);

                            await this.receivedCR(socketID, uID, fetchEvent.origUID, recSocket, recSocketID, recUID, fetchedEvent.packet);
                            break;
                        default:
                            break;
                    }

                    logDebug("completed event", "EF.handleEventBatchIndiv", undefined, undefined, `eventID: ${eventID}, event: ${event.eventName}`, socketID, uID, recSocketID, recUID);
                } catch (error) {
                    logError("failed to emit event", "EF.handleEventBatchIndiv", undefined, error, `eventID: ${eventID}, event: ${event.eventName}`, socketID, uID, recSocketID, recUID, packetObject[eventID]);
                }
            }
        } catch (error) {
            if (error instanceof SocketStatusErr) {
                logWarn("failed to emit event", "EF.handleEventBatchIndiv", undefined, error, undefined, socketID, uID, recSocketID, recUID, packetObject[eventID]);
            } else {
                logError("failed to emit event", "EF.handleEventBatchIndiv", undefined, error, undefined, socketID, uID, recSocketID, recUID, packetObject[eventID]);
            }

            throw error;
        }
    }
    ////
    async handleEventFailure(
        socketID,
        uID,
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
        uID = null,
        queryUID
    ) {
        try {
            checkParams({
                queryUID: queryUID
            }, ["queryUID"]);

            await db.deleteCRsByUserID(socketID, uID, queryUID);

            await db.deleteRecords(socketID, uID, "RUChannels", { "uID1": queryUID, "uID2": queryUID }, "OR");

            await db.deleteRecords(socketID, uID, "EVENTS", { "recUID": queryUID });

            await db.deleteRecords(socketID, uID, "USERS", { "uID": queryUID });

            logDebug("deleted userdata", "EF.deleteUserdata", undefined, undefined, `uID: ${queryUID}`, socketID, uID);
        } catch (error) {
            logError("failed to delete userdata", "EF.deleteUserdata", undefined, error, `uID: ${queryUID}`, socketID, uID);
            throw error;
        };
    };

    async sendDeleteUserTrace(
        socketID = null,
        uID = null,
        queryUID
    ) {
        try {
            checkParams({
                queryUID: queryUID
            }, ["queryUID"]);

            let channelObjs = await db.fetchRecords(socketID, uID, "RUChannels", { "UID1": queryUID, "UID2": queryUID }, undefined, undefined, undefined, undefined, "OR");

            let RUIDs = channelObjs
                .filter(channelObj => {
                    return (channelObj.UID1 == queryUID) || (channelObj.UID2 == queryUID);
                })
                .map(channelObj => {
                    if (channelObj.UID1 == queryUID && channelObj.UID2 != queryUID) {
                        return channelObj.UID2;
                    } else if (channelObj.UID1 != queryUID && channelObj.UID2 == queryUID) {
                        return channelObj.UID1;
                    }
                });

            let packetBuffer = objectToBuffer({ "queryUID": queryUID });

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmitWithAckOrStore(socketID, uID, queryUID, RUIDs[i], "deleteUserTrace", packetBuffer, 1000);

                    logDebug("emitted delete user trace", "EF.sendDeleteUserTrace", undefined, undefined, `event: deleteUserTrace`, socketID, uID, undefined, RUIDs[i]);
                } catch (error) {
                    logError("failed to emit delete user trace", "EF.sendDeleteUserTrace", undefined, error, `event: deleteUserTrace`, socketID, uID, undefined, RUIDs[i]);
                }
            }

            logDebug("emitted delete user trace events", "EF.sendDeleteUserTrace", undefined, undefined, `event: deleteUserTrace`, socketID, uID);
        } catch (error) {
            logError("failed to emit delete user trace events", "EF.sendDeleteUserTrace", undefined, error, `event: deleteUserTrace`, socketID, uID);
        }
    }

    async sendUserConnect(
        socketID = null,
        uID = null,
        queryUID
    ) {
        try {
            checkParams({
                queryUID: queryUID
            }, ["queryUID"]);

            let channelObjs = await db.fetchRecords(socketID, uID, "RUChannels", { "UID1": queryUID, "UID2": queryUID }, undefined, undefined, undefined, undefined, "OR");

            let RUIDs = channelObjs
                .filter(channelObj => {
                    return (channelObj.UID1 == queryUID) || (channelObj.UID2 == queryUID);
                })
                .map(channelObj => {
                    if (channelObj.UID1 == queryUID && channelObj.UID2 != queryUID) {
                        return channelObj.UID2;
                    } else if (channelObj.UID1 != queryUID && channelObj.UID2 == queryUID) {
                        return channelObj.UID1;
                    }
                });

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmit(socketID, uID, RUIDs[i], "userConnect", queryUID);

                    logDebug("emitted user connect", "EF.sendUserConnect", undefined, undefined, `event: userConnect`, socketID, uID, undefined, RUIDs[i]);
                } catch (error) {
                    logError("failed to emit user connect", "EF.sendUserConnect", undefined, error, `event: userConnect`, socketID, uID, undefined, RUIDs[i]);
                }
            }

            logInfo("emitted user connect events", "EF.sendUserConnect", undefined, undefined, `event: userConnect`, socketID, uID);
        } catch (error) {
            logError("failed to emit user connect events", "EF.sendUserConnect", undefined, error, `event: userConnect`, socketID, uID);
        }
    }

    async sendUserDisconnect(
        socketID = null,
        uID = null,
        queryUID
    ) {
        try {
            checkParams({
                queryUID: queryUID
            }, ["queryUID"]);

            let channelObjs = await db.fetchRecords(socketID, uID, "RUChannels", { "UID1": queryUID, "UID2": queryUID }, undefined, undefined, undefined, undefined, "OR");

            let RUIDs = channelObjs
                .filter(channelObj => {
                    return (channelObj.UID1 == queryUID) || (channelObj.UID2 == queryUID);
                })
                .map(channelObj => {
                    if (channelObj.UID1 == queryUID && channelObj.UID2 != queryUID) {
                        return channelObj.UID2;
                    } else if (channelObj.UID1 != queryUID && channelObj.UID2 == queryUID) {
                        return channelObj.UID1;
                    }
                });

            for (let i = 0; i < RUIDs.length; i++) {
                try {
                    await this.checkOnlineEmit(socketID, uID, RUIDs[i], "userDisconnect", queryUID);

                    logDebug("emitted user disconnect", "EF.sendUserDisconnect", undefined, undefined, `event: userDisconnect`, socketID, uID, undefined, RUIDs[i]);
                } catch (error) {
                    logError("failed to emit user disconnect", "EF.sendUserDisconnect", undefined, error, `event: userDisconnect`, socketID, uID, undefined, RUIDs[i]);
                }
            }

            logInfo("emitted user disconnect events", "EF.sendUserDisconnect", undefined, undefined, `event: userDisconnect`, socketID, uID);
        } catch (error) {
            logError("failed to emit user disconnect events", "EF.sendUserDisconnect", undefined, error, `event: userDisconnect`, socketID, uID);
        }
    }

    async checkRUIDsOnline(
        socketID = null,
        uID = null,
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
                        let RULastOnline = await db.fetchRecords(socketID, uID, "USERS", { "uID": RUIDs[i] }, "lastOnline", undefined, undefined, undefined, true, true);

                        returnRUIDs[RUIDs[i]] = RULastOnline.lastOnline;
                    }

                    logDebug("checked RUID online", "EF.checkRUIDsOnline", undefined, undefined, `RUID: ${RUIDs[i]}`, socketID, uID);
                } catch (error) {
                    logError("failed to check RUID online", "EF.checkRUIDsOnline", undefined, error, `RUID: ${RUIDs[i]}`, socketID, uID);
                }
            }

            logDebug("checked RUIDs online", "EF.checkRUIDsOnline", undefined, undefined, `RUIDCount: ${returnRUIDs.length}`, socketID, uID);

            return returnRUIDs;
        } catch (error) {
            logError("failed to check RUIDs online", "EF.checkRUIDsOnline", undefined, error, `RUIDCount: ${RUIDs.length}`, socketID, uID);
            throw error;
        }
    }
    
    async checkDeletedCRs(
        socketID = null,
        uID = null,
        recSocket,
        recSocketID,
        recUID,
        clientRequestIDs,
        ack
    ) {
        try {
            checkParams({
                recSocket: recSocket,
                recSocketID: recSocketID,
                recUID: recUID,
                clientRequestIDs: clientRequestIDs,
                ack: ack
            }, ["recSocket", "recSocketID", "recUID", "clientRequestIDs", "ack"]);

            let CRObjects = await db.fetchCRsByUserID(socketID, uID, recUID, "requestID");
            let serverRequestIDs = CRObjects.map(CR => CR.requestID);

            let returnCRs = {};
            for (let i = 0; i < clientRequestIDs.length; i++) {
                if (!serverRequestIDs.includes(clientRequestIDs[i])) {
                    returnCRs[clientRequestIDs[i]] = false;
                }
            }

            ack(null, returnCRs);

            logDebug("checked deleted CRs", "EF.checkDeletedCRs", undefined, undefined, `requestIDCount: ${clientRequestIDs.length}, returnCRCount: ${Object.keys(returnCRs).length}`, socketID, uID, recSocketID, recUID);
        } catch (error) {
            logError("failed to check deleted CRs", "EF.checkDeletedCRs", undefined, error, undefined, socketID, uID, recSocketID, recUID);
            throw error;
        }
    }
    ////
    async sendMissingCRs(
        socketID = null,
        uID = null,
        recSocket,
        recSocketID,
        recUID,
        clientRequestIDs,
    ) {
        try {
            checkParams({
                recSocket: recSocket,
                recSocketID: recSocketID,
                recUID: recUID,
                clientRequestIDs: clientRequestIDs
            }, ["recSocket", "recSocketID", "recUID", "clientRequestIDs"]);

            let missingCRCount = 0;
            for (let i = 0; i < serverRequestIDs.length; i++) {
                if (!clientRequestIDs.includes(serverRequestIDs[i])) {
                    try {
                        let CR = await db.fetchRecords(socketID, uID, "CRs", { "requestID": serverRequestIDs[i] }, undefined, undefined, undefined, undefined, true, true);

                        let packetObject = {
                            requestID: CR.requestID,
                            date: CR.date
                        };

                        try {
                            if (CR.origUID == recUID && CR.recUID != recUID) {
                                packetObject.isOrigin = true;

                                let RU = await db.fetchRecords(socketID, uID, "USERS", { "uID": CR.recUID }, undefined, undefined, undefined, undefined, true, true);
                                packetObject.RU = RU;
                            } else {
                                packetObject.isOrigin = false;

                                let RU = await db.fetchRecords(socketID, uID, "USERS", { "uID": CR.origUID }, undefined, undefined, undefined, undefined, true, true);
                                packetObject.RU = RU;
                            }
                        } catch (error) {
                            if (error instanceof EmptyDBResult) {
                                try {
                                    logWarn("failed to find RU", "EF.sendMissingCRs", undefined, error, `requestID: ${serverRequestIDs[i]}`, socketID, uID, recSocketID, recUID);

                                    await db.deleteRecords(socketID, uID, "CRs", { "requestID": serverRequestIDs[i] });

                                    logInfo("deleted CR", "EF.sendMissingCRs", undefined, undefined, `requestID: ${serverRequestIDs[i]}`, socketID, uID, recSocketID, recUID);
                                } catch (error) {
                                    logError("failed to delete CR", "EF.sendMissingCRs", undefined, error, `requestID: ${serverRequestIDs[i]}`, socketID, uID, recSocketID, recUID);
                                }
                            }
                        }

                        let packetBuffer = objectToBuffer(packetObject);

                        await this.receivedCR(socketID, uID, undefined, recSocket, recSocketID, recUID, packetBuffer);

                        missingCRCount++;

                        logDebug("sent missing CR", "EF.sendMissingCRs", undefined, undefined, `requestID: ${serverRequestIDs[i]}`, socketID, uID, recSocketID, recUID);
                    } catch (error) {
                        logWarn("failed to send missing CR", "EF.sendMissingCRs", undefined, error, `requestID: ${serverRequestIDs[i]}`, socketID, uID, recSocketID, recUID);
                    }
                }
            }

            logDebug("sent missing CRs", "EF.sendMissingCRs", undefined, undefined, `requestIDCount: ${clientRequestIDs.length}, missingCRCount: ${missingCRCount}`, socketID, uID, recSocketID, recUID);
        } catch (error) {
            logError("failed to send missing CRs", "EF.sendMissingCRs", undefined, error, undefined, socketID, uID, recSocketID, recUID);
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
        socketID = null,
        uID = null,
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

    // receivedCR
    //
    async receivedCR(
        socketID = null,
        uID = null,
        origUID = null,
        recSocket = null,
        recSocketID = null,
        recUID,
        packetBuffer
    ) {
        try {
            if (recSocket) {
                checkParams({
                    recSocket: recSocket,
                    recSocketID: recSocketID,
                    recUID: recUID,
                    packetBuffer: packetBuffer
                }, ["recSocket", "recSocketID", "recUID", "packetBuffer"]);
            } else {
                checkParams({
                    origUID: origUID,
                    recUID: recUID,
                    packetBuffer: packetBuffer
                }, ["origUID", "recUID", "packetBuffer"]);
            }

            let packetObject = bufferToObject(packetBuffer);

            checkObjReqProps(packetObject, ["requestID", "date", "isOrigin", "RU"]);

            if (recSocket) {
                await this.emitEventWithAck(socketID, uID, recSocket, recSocketID, recUID, "receivedCR", packetBuffer, 1000);
            } else {
                await this.checkOnlineEmitWithAckOrStore(socketID, uID, origUID, recUID, "receivedCR", packetBuffer, 1000);
            }

            logDebug("emitted receivedCR", "EF.receivedCR", undefined, undefined, `requestID: ${packetObject.requestID}`, socketID, uID, recSocketID, recUID);
        } catch (error) {
            logError("failed to emit receivedCR", "EF.receivedCR", undefined, error, undefined, socketID, uID, recSocketID, recUID);

            if (error instanceof ClientResponseErr) {
                await this.receivedCRFailure(origSocketID, origUID, recUID, packetObject);
            }

            throw error;
        }
    }
    ////
    async receivedCRFailure(
        socketID = null,
        uID = null,
        packetObject
    ) {
        try {
            checkParams({
                packetObject: packetObject
            }, ["packetObject"]);

            checkObjReqProps(packetObject, ["requestID"]);

            await db.deleteRecords(socketID, uID, "CRs", { "requestID": packetObject.requestID }, undefined, true);

            logDebug("successfully handled receivedCRFailure", "EF.receivedCRFailure", undefined, undefined, `requestID: ${packetObject.requestID}`, socketID, uID);
        } catch (error) {
            logError("failed to handle receivedCRFailure", "EF.receivedCRFailure", undefined, error, undefined, socketID, uID);
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

