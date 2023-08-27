const mysql = require('mysql');
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
const { log } = require('winston');


class Database {

  constructor() {

    this.con = mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "Smashers1!",
      database: "bluezebra",
      // socketPath: "/var/run/mysqld/mysqld.sock"
    });

    this.connected = false;
  };

  connectDB() {
    this.con.connect((err) => {
      try {
        if (err) {
          throw new DBErr(err.message);
        }

        logInfo("connected to MySQL DB", "db.connectDB");

        this.connected = true;

        this.createTables();
      } catch (error) {
        logError("failed to connect to MySQL DB", "db.connectDB", undefined, error);

        this.connected = false;
      }
    });
  }

  // Table Creation Functions
  // ========================

  createTables() {

    var table1 = `CREATE TABLE IF NOT EXISTS USERS (
      UID VARCHAR(255) NOT NULL CHECK (UID <> ''),
      username VARCHAR(255) NOT NULL CHECK (username <> ''), 
      avatar VARCHAR(50) NOT NULL CHECK (username <> ''),
      creationDate DATETIME NOT NULL, 
      lastOnline DATETIME,
      PRIMARY KEY (UID),
      UNIQUE (username)
    );`;

    var table2 = `CREATE TABLE IF NOT EXISTS CRs (
      requestID VARCHAR(255) NOT NULL CHECK (requestID <> ''),
      origUID VARCHAR(255) NOT NULL CHECK (origUID <> ''),
      recUID VARCHAR(255) NOT NULL CHECK (recUID <> ''),
      requestDate DATETIME NOT NULL,
      PRIMARY KEY (requestID, origUID)
    );`;

    var table3 = `CREATE TABLE IF NOT EXISTS RUChannels (
      channelID VARCHAR(255) NOT NULL CHECK (channelID <> ''),
      UID VARCHAR(255) NOT NULL CHECK (UID <> ''),
      creationDate DATETIME NOT NULL,
      PRIMARY KEY (channelID, UID)
    );`;

    var table4 = `CREATE TABLE IF NOT EXISTS EVENTS (
      eventID INT AUTO_INCREMENT,
      eventName VARCHAR(255) NOT NULL,
      datetime DATETIME(3) NOT NULL,
      origUID VARCHAR(255) NOT NULL CHECK (origUID <> ''),
      recUID VARCHAR(255) NOT NULL CHECK (recUID <> ''),
      packet BLOB
      PRIMARY KEY (eventID, origUID)
    );`;

    this.con.query(table1, (err, result) => {
      try {
        if (err) {
          throw new DBErr(err.message);
        }

        logInfo("created 'users' table if not present", "db.createTables");
      } catch (error) {
        logError("failed to create 'users' table", "db.createTables", undefined, error);
      }
    });

    this.con.query(table2, (err, result) => {
      try {
        if (err) {
          throw new DBErr(err.message);
        }

        logInfo("created 'CRs' table if not present", "db.createTables");
      } catch (error) {
        logError("failed to create 'CRs' table", "db.createTables", undefined, error);
      }
    });

    this.con.query(table3, (err, result) => {
      try {
        if (err) {
          throw new DBErr(err.message);
        }

        logInfo("created 'RUChannels' table if not present", "db.createTables");
      } catch (error) {
        logError("failed to create 'RUChannels' table", "db.createTables", undefined, error);
      }
    });

    this.con.query(table4, (err, result) => {
      try {
        if (err) {
          throw new DBErr(err.message);
        }

        logInfo("created 'events' table if not present", "db.createTables");
      } catch (error) {
        logError("failed to create 'events' table", "db.createTables", undefined, error);
      }
    });
  };


  // General Record Functions
  // =======================

  // fetchRecords
  // predProps should be primary keys to ensure that only one record is fetched
  fetchRecords(
    socketID = null,
    UID = null,
    table,
    predObj, // { pred1: value1, pred2: value2, ... }
    cols = null,
    sortColumn = null,
    sortOrder = "DESC",
    limit = null,
    errorOnEmpty = false,
    errorOnMultiple = false
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          table: table,
          predObj: predObj
        }, ["table", "predObj"]);

        checkObjProps(predObj);

        let selectCols;
        if (Array.isArray(cols)) {
          selectCols = cols.join(', ');
        } else if (typeof cols === 'string') {
          selectCols = cols;
        } else {
          selectCols = '*';
        }

        const predKeys = Object.keys(predObj);
        let whereClauses = predKeys.map(key => '?? = ?').join(' AND ');

        let values = [table];
        for (let i = 0; i < predKeys.length; i++) {
          values.push(predKeys[i]);
          values.push(predObj[predKeys[i]]);
        }

        if (sortColumn !== null) {
          values.push(sortColumn);
        };

        if (limit !== null) {
          values.push(limit);
        };

        let query = `
            SELECT ${selectCols}
            FROM ??
            WHERE ${whereClauses}
            ${sortColumn != null ? `ORDER BY ?? ${sortOrder}` : ""}
            ${limit != null ? `LIMIT ?` : ""}
          `;

        this.con.query(query, values, (err, result, fields) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else if (result.length == 0 && errorOnEmpty) {
              throw new EmptyDBResult(`no records found`);
            } else if (result.length > 1 && errorOnMultiple) {
              throw new MultipleDBResults('multiple records found');
            }
            logDebug(`fetched records`, "db.fetchRecords", undefined, undefined, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
            resolve(result);

          } catch (error) {
            logDebug(`failed to fetch records`, "db.fetchRecords", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to fetch records`, "db.fetchRecords", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
        reject(error);
      };
    });
  };

  // updateRecords
  // predProps should be primary keys to ensure that only one record is updated
  updateRecords(
    socketID = null,
    UID = null,
    table,
    predObj, // { pred1: value1, pred2: value2, ... }
    updateProp,
    updateValue
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          table: table,
          predObj: predObj,
          updateProp: updateProp,
          updateValue: updateValue
        }, ["table", "predObj", "updateProp", "updateValue"]);

        checkObjProps(predObj);

        const predKeys = Object.keys(predObj);
        let whereClauses = predKeys.map(key => '?? = ?').join(' AND ');

        let values = [
          table,
          updateProp,
          updateValue,
        ];

        for (let i = 0; i < predKeys.length; i++) {
          values.push(predKeys[i]);
          values.push(predObj[predKeys[i]]);
        }

        let query = `
            UPDATE ??
            SET ?? = ?
            WHERE ${whereClauses}
          `;

        this.con.query(query, values, (err, result, fields) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else if (result.affectedRows == 0) {
              throw new EmptyDBResult(`no record found`);
            } else if (result.affectedRows > 0 && result.changedRows == 0) {
              throw new DBErr(`no changes made to record`);
            }

            logDebug(`updated record`, "db.updateRecords", undefined, undefined, `table: ${table}, predObj: ${JSON.stringify(predObj)}, updateProp: ${updateProp}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to update record`, "db.updateRecords", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}, updateProp: ${updateProp}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to update record`, "db.updateRecords", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}, updateProp: ${updateProp}`, socketID, UID);
        reject(error);
      };
    });
  };


  // deleteRecord
  // predProps should be primary keys to ensure that only one record is updated
  deleteRecords(
    socketID = null,
    UID = null,
    table,
    predObj, // { pred1: value1, pred2: value2, ... }
    errorOnEmpty = false,
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          table: table,
          predObj: predObj
        }, ["table", "predObj"]);

        checkObjProps(predObj);

        const predKeys = Object.keys(predObj);
        let whereClauses = predKeys.map(key => '?? = ?').join(' AND ');

        let values = [table];
        for (let i = 0; i < predKeys.length; i++) {
          values.push(predKeys[i]);
          values.push(predObj[predKeys[i]]);
        }

        let query = `
            DELETE
            FROM ??
            WHERE ${whereClauses}
          `;

        this.con.query(query, values, (err, result, fields) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else if (result.affectedRows == 0 && errorOnEmpty) {
              throw new EmptyDBResult(`no records found`);
            }

            logDebug(`deleted record`, "db.deleteRecord", undefined, undefined, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to delete record`, "db.deleteRecord", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to delete record`, "db.deleteRecord", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
        reject(error);
      };
    });
  };

  // USERS Table Functions
  // =====================

  createUser(
    socketID = null,
    UID,
    username,
    avatar,
    creationDate
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          UID: UID,
          username: username,
          avatar: avatar,
          creationDate: creationDate
        }, ["UID", "username", "avatar", "creationDate"]);

        let query = `
        INSERT INTO USERS 
        VALUES (?, ?, ?, ?, ?)
        `;

        let values = [
          UID,
          username,
          avatar,
          creationDate,
          null
        ];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            logDebug(`created user`, "db.createUser", undefined, undefined, `UID: ${UID}, username: ${username}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to create user`, "db.createUser", undefined, error, `UID: ${UID}, username: ${username}`, socketID, UID);
            reject(error);
          }
        });
      } catch (error) {
        logDebug(`failed to create user`, "db.createUser", undefined, error, `UID: ${UID}, username: ${username}`, socketID, UID);
        reject(error);
      }
    });
  };

  fetchUsersByUsername(
    socketID = null,
    UID = null,
    username,
    limit = 10
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          username: username
        }, ["username"]);

        let query = `
            (SELECT * FROM USERS WHERE username = ?)
            UNION ALL
            (SELECT * FROM USERS WHERE username LIKE ? AND username != ? ORDER BY username LIMIT 10)
            ORDER BY CASE WHEN username = ? THEN 0 ELSE 1 END, username
            LIMIT ?;
          `;

        let values = [username, username + '%', username, username, limit];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            logDebug(`fetched users`, "db.fetchUsersByUsername", undefined, undefined, `username: ${username}`, socketID, UID);
            resolve(result);

          } catch (error) {
            logDebug(`failed to fetch users`, "db.fetchUsersByUsername", undefined, error, `username: ${username}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to fetch users`, "db.fetchUsersByUsername", undefined, error, `username: ${username}`, socketID, UID);
        reject(error);
      };
    });
  };

  // CRs Table Functions
  // ==================

  createCR(
    socketID = null,
    UID = null,
    requestID,
    origUID,
    recUID,
    requestDate
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          requestID: requestID,
          origUID: origUID,
          recUID: recUID,
          requestDate: requestDate
        }, ["requestID", "origUID", "recUID", "requestDate"]);

        if (origUID == recUID) {
          throw new FuncErr("origUID and recUID cannot be the same");
        }

        let query = `
        INSERT INTO CRs 
        VALUES (?, ?, ?, ?)
        `;

        let values = [
          requestID,
          origUID,
          recUID,
          requestDate
        ];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            logDebug(`created CR`, "db.createCR", undefined, undefined, `requestID: ${requestID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to create CR`, "db.createCR", undefined, error, `requestID: ${requestID}`, socketID, UID);
            reject(error);
          }
        });
      } catch (error) {
        logDebug(`failed to create CR`, "db.createCR", undefined, error, `requestID: ${requestID}`, socketID, UID);
        reject(error);
      };
    });
  };

  fetchCRsByUserID(
    socketID = null,
    UID = null,
    queryUID,
    cols = null,
    sortOrder = "DESC"
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          queryUID: queryUID
        }, ["queryUID"]);

        let selectCols;
        if (Array.isArray(cols)) {
          selectCols = cols.join(', ');
        } else if (typeof cols === 'string') {
          selectCols = cols;
        } else {
          selectCols = '*';
        }

        let query = `
            SELECT ${selectCols}
            FROM CRs
            WHERE origUID = ? OR recUID = ?
            ORDER BY requestDate ${sortOrder};
          `;

        let values = [queryUID, queryUID];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            logDebug(`fetched CRs`, "db.fetchCRsbyUserID", undefined, undefined, `queryUID: ${queryUID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to fetch CRs`, "db.fetchCRsbyUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to fetch CRs`, "db.fetchCRsbyUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
        reject(error);
      };
    });
  };

  deleteCRsByUserID(
    socketID = null,
    UID = null,
    queryUID
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          queryUID: queryUID
        }, ["queryUID"]);

        let query = `
            DELETE FROM CRs
            WHERE origUID = ? OR recUID = ?;
          `;

        let values = [queryUID, queryUID];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            };

            logDebug(`deleted CRs`, "db.deleteCRsByUserID", undefined, undefined, `queryUID: ${queryUID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to delete CRs`, "db.deleteCRsByUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
            reject(error);
          }
        });
      } catch (error) {
        logDebug(`failed to delete CRs`, "db.deleteCRsByUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
        reject(error);
      };
    });
  };

  // RUChannels Table Functions
  // =========================

  createRUChannel(
    socketID = null,
    UID = null,
    channelID,
    queryUID,
    creationDate
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          channelID: channelID,
          queryUID: queryUID,
          creationDate: creationDate
        }, ["channelID", "queryUID", "creationDate"]);

        let query = `
            INSERT INTO RUChannels 
            VALUES (?, ?, ?)
          `;

        let values = [
          channelID,
          queryUID,
          creationDate
        ];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            logDebug(`created RUChannel`, "db.createRUChannel", undefined, undefined, `channelID: ${channelID}, queryUID: ${queryUID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to create RUChannel`, "db.createRUChannel", undefined, error, `channelID: ${channelID}, queryUID: ${queryUID}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to create RUChannel`, "db.createRUChannel", undefined, error, `channelID: ${channelID}, queryUID: ${queryUID}`, socketID, UID);
        reject(error);
      }
    });
  };

  fetchRecRUChannelsbyUserID(
    socketID = null,
    UID = null,
    queryUID,
    cols = null
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          queryUID: queryUID
        }, ["queryUID"]);

        let selectCols;
        if (Array.isArray(cols)) {
          selectCols = cols.join(', ');
        } else if (typeof cols === 'string') {
          selectCols = cols;
        } else {
          selectCols = '*';
        };

        let query = `
            SELECT ${selectCols}
            FROM RUChannels
            WHERE UID != ?
            AND channelID IN (
              SELECT channelID
              FROM RUChannels
              WHERE UID = ? 
            );
          `;

        let values = [queryUID, queryUID];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            };

            logDebug(`fetched RUChannels`, "db.fetchRecRUChannelsbyUserID", undefined, undefined, `queryUID: ${queryUID}`, socketID, UID);
            resolve(result);

          } catch (error) {
            logDebug(`failed to fetch RUChannels`, "db.fetchRecRUChannelsbyUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to fetch RUChannels`, "db.fetchRecRUChannelsbyUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
        reject(error);
      };
    });
  };

  deleteRUChannelsByUserID(
    socketID = null,
    UID = null,
    queryUID
  ) {
    return new Promise(async (resolve, reject) => {
      try {

        checkParams({
          queryUID: queryUID
        }, ["queryUID"]);

        let channelRecords = await this.fetchRecords(socketID, UID, "RUChannels", "UID", queryUID, "channelID");

        if (channelRecords.length > 0) {

          let query = `
              DELETE 
              FROM RUChannels 
              WHERE channelID IN (?);
            `;

          let values = [channelRecords.map(channelRecord => channelRecord.channelID)];

          this.con.query(query, values, (err, result) => {
            try {
              if (err) {
                throw new DBErr(err.message);
              }

              logDebug(`deleted RUChannels`, "db.deleteRUChannelsByUserID", undefined, undefined, `queryUID: ${queryUID}, deleted: ${result.affectedRows}`, socketID, UID);
              resolve();

            } catch (error) {
              logDebug(`failed to delete RUChannels`, "db.deleteRUChannelsByUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
              reject(error);
            };
          });
        } else {
          logDebug(`no RUChannels to delete`, "db.deleteRUChannelsByUserID", undefined, undefined, `queryUID: ${queryUID}, deleted: 0`, socketID, UID);
          resolve();
        };
      } catch (error) {
        logDebug(`failed to delete RUChannels`, "db.deleteRUChannelsByUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
        reject(error);
      };
    });
  };

  // EVENTS Table Functions
  // =====================

  createEvent(
    socketID = null,
    UID = null,
    eventName,
    datetime,
    origUID,
    recUID,
    packetBuffer
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          eventName: eventName,
          datetime: datetime,
          origUID: origUID,
          recUID: recUID
        }, ["eventName", "datetime", "origUID", "recUID"]);

        let query = `
            INSERT INTO EVENTS 
            (eventName, datetime, origUID, recUID, packet) 
            VALUES (?, ?, ?, ?, ?)
          `;

        let values = [
          eventName,
          datetime,
          origUID,
          recUID,
          packetBuffer
        ];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            logDebug(`created event`, "db.createEvent", undefined, undefined, `eventName: ${eventName} origUID: ${origUID}, recUID: ${recUID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to create event`, "db.createEvent", undefined, error, `eventName: ${eventName} origUID: ${origUID}, recUID: ${recUID}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to create event`, "db.createEvent", undefined, error, `eventName: ${eventName} origUID: ${origUID}, recUID: ${recUID}`, socketID, UID);
        reject(error);
      }
    });
  };
}

module.exports = Database;
