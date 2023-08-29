const mysql = require('mysql');
const config = require('./config');

const {
  ReqParamsNull,
  EmptyObj,
  MissingObjProps,
  ObjPropsNull,
  DBErr,
  EmptyDBResult,
  MultipleDBResults,
  FuncErr,
  ...errors
} = require('./error');

const {
  logDebug,
  logInfo,
  logWarn,
  logError,
  checkParams,
  checkObjProps,
  ...util
} = require('./utilities');

// Add transactions support for rollbacks in case of failures

class DB {

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
    return new Promise((resolve, reject) => {
      this.con.connect(async (err) => {
        try {
          if (err) {
            throw new DBErr(err.message);
          }

          logInfo("connected to MySQL DB", "DB.connectDB");

          this.connected = true;

          await this.createTables();

          resolve()
        } catch (error) {
          logError("failed to connect to MySQL DB", "DB.connectDB", undefined, error);

          this.connected = false;

          reject(error)
        }
      });
    })
  }

  // Table Creation Functions
  // ========================

  async createTables() {
    await this.createTable1();
    await this.createTable2();
    await this.createTable3();
    await this.createTable4();
  };

  createTable1() {
    return new Promise((resolve, reject) => {

      let table1 = `CREATE TABLE IF NOT EXISTS USERS (
        UID VARCHAR(255) NOT NULL CHECK (UID <> ''),
        username VARCHAR(255) NOT NULL CHECK (username <> ''), 
        password VARCHAR(100) NOT NULL CHECK (password <> ''),
        publicKey BlOB NOT NULL,
        avatar VARCHAR(50) NOT NULL CHECK (avatar <> ''),
        creationDate DATETIME NOT NULL,
        lastOnline DATETIME,
        PRIMARY KEY (UID),
        UNIQUE (username)
      );`;

      this.con.query(table1, (err, result) => {
        try {
          if (err) {
            throw new DBErr(err.message);
          }

          logInfo("created 'users' table if not present", "DB.createTable1");
          resolve()
        } catch (error) {
          logError("failed to create 'users' table", "DB.createTable1", undefined, error);
          reject(error)
        }
      });
    });
  }

  createTable2() {
    return new Promise((resolve, reject) => {

      let table2 = `CREATE TABLE IF NOT EXISTS CRs (
        requestID VARCHAR(255) NOT NULL CHECK (requestID <> ''),
        origUID VARCHAR(255) NOT NULL CHECK (origUID <> ''),
        recUID VARCHAR(255) NOT NULL CHECK (recUID <> ''),
        requestDate DATETIME NOT NULL,
        PRIMARY KEY (requestID),
        FOREIGN KEY (origUID) REFERENCES USERS(UID),
        FOREIGN KEY (recUID) REFERENCES USERS(UID)
      );`;

      this.con.query(table2, (err, result) => {
        try {
          if (err) {
            throw new DBErr(err.message);
          }

          logInfo("created 'CRs' table if not present", "DB.createTable2");
          resolve()
        } catch (error) {
          logError("failed to create 'CRs' table", "DB.createTable2", undefined, error);
          reject(error);
        }
      });
    });
  }

  createTable3() {
    return new Promise((resolve, reject) => {

      let table3 = `CREATE TABLE IF NOT EXISTS RUChannels (
        channelID VARCHAR(255) NOT NULL CHECK (channelID <> ''),
        UID1 VARCHAR(255) NOT NULL CHECK (UID1 <> ''),
        UID2 VARCHAR(255) NOT NULL CHECK (UID2 <> ''),
        creationDate DATETIME NOT NULL,
        PRIMARY KEY (channelID),
        FOREIGN KEY (UID1) REFERENCES USERS(UID),
        FOREIGN KEY (UID2) REFERENCES USERS(UID)
      );`;

      this.con.query(table3, (err, result) => {
        try {
          if (err) {
            throw new DBErr(err.message);
          }

          logInfo("created 'RUChannels' table if not present", "DB.createTable3");
          resolve();
        } catch (error) {
          logError("failed to create 'RUChannels' table", "DB.createTable3", undefined, error);
          reject(error);
        }
      });
    });
  }

  createTable4() {
    return new Promise((resolve, reject) => {

      var table4 = `CREATE TABLE IF NOT EXISTS EVENTS (
        eventID INT AUTO_INCREMENT,
        eventName VARCHAR(255) NOT NULL,
        datetime DATETIME(3) NOT NULL,
        origUID VARCHAR(255) NOT NULL CHECK (origUID <> ''),
        recUID VARCHAR(255) NOT NULL CHECK (recUID <> ''),
        packet BLOB,
        PRIMARY KEY (eventID),
        FOREIGN KEY (origUID) REFERENCES USERS(UID),
        FOREIGN KEY (recUID) REFERENCES USERS(UID)
      );`;

      this.con.query(table4, (err, result) => {
        try {
          if (err) {
            throw new DBErr(err.message);
          }

          logInfo("created 'events' table if not present", "DB.createTable4");
          resolve();
        } catch (error) {
          logError("failed to create 'events' table", "DB.createTable4", undefined, error);
          reject(error);
        }
      });
    });
  }
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
    limit = null, // if limit=1 then only the first record is returned
    whereClauseSeperator = "AND",
    errorOnEmpty = false,
    errorOnMultiple = false // forces function to return only the first record
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
        let whereClauses = predKeys.map(key => '?? = ?').join(` ${whereClauseSeperator} `);

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
            logDebug(`fetched records`, "DB.fetchRecords", undefined, undefined, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);

            if (errorOnMultiple || limit == 1) {
              resolve(result[0]);
            } else {
              resolve(result);
            }

          } catch (error) {
            logDebug(`failed to fetch records`, "DB.fetchRecords", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to fetch records`, "DB.fetchRecords", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
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
    updateValue,
    whereClauseSeperator = "AND",
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
        let whereClauses = predKeys.map(key => '?? = ?').join(` ${whereClauseSeperator} `);

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

            logDebug(`updated record`, "DB.updateRecords", undefined, undefined, `table: ${table}, predObj: ${JSON.stringify(predObj)}, updateProp: ${updateProp}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to update record`, "DB.updateRecords", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}, updateProp: ${updateProp}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to update record`, "DB.updateRecords", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}, updateProp: ${updateProp}`, socketID, UID);
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
    whereClauseSeperator = "AND",
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
        let whereClauses = predKeys.map(key => '?? = ?').join(` ${whereClauseSeperator} `);

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

            logDebug(`deleted record`, "DB.deleteRecord", undefined, undefined, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to delete record`, "DB.deleteRecord", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to delete record`, "DB.deleteRecord", undefined, error, `table: ${table}, predObj: ${JSON.stringify(predObj)}`, socketID, UID);
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
    password,
    publicKey,
    avatar,
    creationDate
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          UID: UID,
          username: username,
          password: password,
          publicKey: publicKey,
          avatar: avatar,
          creationDate: creationDate
        }, ["UID", "username", "password", "publicKey", "avatar", "creationDate"]);

        let query = `
        INSERT INTO USERS 
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        let values = [
          UID,
          username,
          password,
          publicKey,
          avatar,
          creationDate,
          null
        ];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            logDebug(`created user`, "DB.createUser", undefined, undefined, `UID: ${UID}, username: ${username}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to create user`, "DB.createUser", undefined, error, `UID: ${UID}, username: ${username}`, socketID, UID);
            reject(error);
          }
        });
      } catch (error) {
        logDebug(`failed to create user`, "DB.createUser", undefined, error, `UID: ${UID}, username: ${username}`, socketID, UID);
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

            logDebug(`fetched users`, "DB.fetchUsersByUsername", undefined, undefined, `username: ${username}`, socketID, UID);
            resolve(result);

          } catch (error) {
            logDebug(`failed to fetch users`, "DB.fetchUsersByUsername", undefined, error, `username: ${username}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to fetch users`, "DB.fetchUsersByUsername", undefined, error, `username: ${username}`, socketID, UID);
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

            logDebug(`created CR`, "DB.createCR", undefined, undefined, `requestID: ${requestID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to create CR`, "DB.createCR", undefined, error, `requestID: ${requestID}`, socketID, UID);
            reject(error);
          }
        });
      } catch (error) {
        logDebug(`failed to create CR`, "DB.createCR", undefined, error, `requestID: ${requestID}`, socketID, UID);
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

            logDebug(`fetched CRs`, "DB.fetchCRsbyUserID", undefined, undefined, `queryUID: ${queryUID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to fetch CRs`, "DB.fetchCRsbyUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to fetch CRs`, "DB.fetchCRsbyUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
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

            logDebug(`deleted CRs`, "DB.deleteCRsByUserID", undefined, undefined, `queryUID: ${queryUID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to delete CRs`, "DB.deleteCRsByUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
            reject(error);
          }
        });
      } catch (error) {
        logDebug(`failed to delete CRs`, "DB.deleteCRsByUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
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
    UID1,
    UID2,
    creationDate
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          channelID: channelID,
          UID1: UID1,
          UID2: UID2,
          creationDate: creationDate
        }, ["channelID", "UID1", "UID2", "creationDate"]);

        let query = `
            INSERT INTO RUChannels 
            VALUES (?, ?, ?, ?)
          `;

        let values = [
          channelID,
          UID1,
          UID2,
          creationDate
        ];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            logDebug(`created RUChannel`, "DB.createRUChannel", undefined, undefined, `channelID: ${channelID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to create RUChannel`, "DB.createRUChannel", undefined, error, `channelID: ${channelID}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to create RUChannel`, "DB.createRUChannel", undefined, error, `channelID: ${channelID}`, socketID, UID);
        reject(error);
      }
    });
  };

  fetchRUChannelsByUserID(
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
            FROM RUChannels
            WHERE UID1 = ? OR UID2 = ?
            ORDER BY creationDate ${sortOrder};
          `;

        let values = [queryUID, queryUID];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            logDebug(`fetched RUChannels`, "DB.fetchRUChannelsByUserID", undefined, undefined, `queryUID: ${queryUID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to fetch RUChannels`, "DB.fetchRUChannelsByUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to fetch RUChannels`, "DB.fetchRUChannelsByUserID", undefined, error, `queryUID: ${queryUID}`, socketID, UID);
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

            logDebug(`created event`, "DB.createEvent", undefined, undefined, `eventName: ${eventName} origUID: ${origUID}, recUID: ${recUID}`, socketID, UID);
            resolve();

          } catch (error) {
            logDebug(`failed to create event`, "DB.createEvent", undefined, error, `eventName: ${eventName} origUID: ${origUID}, recUID: ${recUID}`, socketID, UID);
            reject(error);
          };
        });
      } catch (error) {
        logDebug(`failed to create event`, "DB.createEvent", undefined, error, `eventName: ${eventName} origUID: ${origUID}, recUID: ${recUID}`, socketID, UID);
        reject(error);
      }
    });
  };
}

module.exports = new DB();
