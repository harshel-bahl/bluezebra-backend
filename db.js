var mysql = require('mysql');

const {
  DBErr,
  EmptyDBResult,
  MultipleDBResults,
  FuncErr
} = require('./error');

const {
  currDT,
  UUID,
  isNull,
  isNotNull,
  checkParams,
  funcS,
  errLog,
} = require('./utilities');

class Database {

  constructor(logger) {

    this.con = mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "Smashers1!",
      database: "bluezebra",
      // socketPath: "/var/run/mysqld/mysqld.sock"
    });

    this.logger = logger;

    this.connected = false;
  };

  connectDB() {
    this.con.connect((err) => {
      try {
        if (err) {
          throw new DBErr(err.message);
        }

        this.logger.info(funcS("db.connectDB", "connected to MySQL DB"))
        this.connected = true;

        this.createTables();
      } catch (error) {
        this.logger.error(errLog(error))
        this.connected = false;
      }
    });
  }

  // Table Creation Functions
  // ========================

  createTables() {

    var table1 = `CREATE TABLE IF NOT EXISTS USERS (
      userID VARCHAR(255) NOT NULL CHECK (userID <> ''),
      username VARCHAR(255) NOT NULL CHECK (username <> ''), 
      avatar VARCHAR(50) NOT NULL,
      creationDate DATETIME NOT NULL, 
      lastOnline DATETIME,
      PRIMARY KEY (userID),
      UNIQUE (username)
    );`;

    var table2 = `CREATE TABLE IF NOT EXISTS CRs (
      requestID VARCHAR(255) NOT NULL CHECK (requestID <> ''),
      originUserID VARCHAR(255) NOT NULL CHECK (originUserID <> ''),
      receivingUserID VARCHAR(255) NOT NULL CHECK (receivingUserID <> ''),
      requestDate DATETIME NOT NULL,
      PRIMARY KEY (requestID)
    );`;

    var table3 = `CREATE TABLE IF NOT EXISTS RUChannels (
      channelID VARCHAR(255) NOT NULL CHECK (channelID <> ''),
      userID VARCHAR(255) NOT NULL CHECK (userID <> ''),
      creationDate DATETIME NOT NULL,
      PRIMARY KEY (channelID, userID)
    );`;

    var table4 = `CREATE TABLE IF NOT EXISTS EVENTS (
      eventID INT AUTO_INCREMENT PRIMARY KEY,
      eventName VARCHAR(255) NOT NULL,
      datetime DATETIME(3) NOT NULL,
      originUserID VARCHAR(255) NOT NULL CHECK (originUserID <> ''),
      receivingUserID VARCHAR(255) NOT NULL CHECK (receivingUserID <> ''),
      packet BLOB
    );`;

    this.con.query(table1, (err, result) => {
      try {
        if (err) {
          throw new DBErr(err.message);
        };

        this.logger.info(funcS("db.createTables", "created 'users' table if not present"));
      } catch (error) {
        this.logger.error(errLog(error, "failed to create 'users' table"));
      };
    });

    this.con.query(table2, (err, result) => {
      try {
        if (err) {
          throw new DBErr(err.message);
        };

        this.logger.info(funcS("db.createTables", "created 'CRs' table if not present"));
      } catch (error) {
        this.logger.error(errLog(error, "failed to create 'CRs' table"));
      };
    });

    this.con.query(table3, (err, result) => {
      try {
        if (err) {
          throw new DBErr(err.message);
        };

        this.logger.info(funcS("db.createTables", "created 'RUChannels' table if not present"));
      } catch (error) {
        this.logger.error(errLog(error, "failed to create 'RUChannels' table"));
      };
    });

    this.con.query(table4, (err, result) => {
      try {
        if (err) {
          throw new DBErr(err.message);
        };

        this.logger.info(funcS("db.createTables", "created 'events' table if not present"));
      } catch (error) {
        this.logger.error(errLog(error, "failed to create 'events' table"));
      };
    });
  };


  // General Fetch Functions
  // =======================

  // fetchRecord
  // predProps should be a primary keys to ensure that only one record is fetched
  fetchRecord(
    socketID = null,
    UID = null,
    table,
    predProp1,
    predValue1,
    predProp2 = null,
    predValue2 = null,
    cols = null,
    errorOnEmpty = true,
    errorOnMultiple = false
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          table: table,
          predProp1: predProp1,
          predValue: predValue1
        }, ["table", "predProp1", "predValue1"]);

        let query = `
            SELECT ${cols == null ? "*" : "??"}
            FROM ??
            WHERE ?? = ? ${predProp2 !== null && predValue2 !== null ? "AND ?? = ?" : ""}
          `;

        let values = [
          table,
          predProp1,
          predValue1,
          predProp2,
          predValue2
        ];

        if (cols !== null) {
          values = [cols].concat(values);
        };

        if (predProp2 !== null && predValue2 !== null) {
          values.push(predProp2);
          values.push(predValue2);
        };

        this.con.query(query, values, (err, result, fields) => {
          try {
            if (err) {
              throw new DBErr("db.fetchRecord", err.message);
            } else if (result.length == 0 && errorOnEmpty) {
              throw new EmptyDBResult();
            } else if (result.length > 1 && errorOnMultiple) {
              throw new MultipleDBResults();
            } else {
              this.logger.debug(funcS("db.fetchRecord", `table: ${table}`, socketID, UID));
              resolve(result[0]);
            };
          } catch (error) {
            this.logger.warn(errLog(error, `table: ${table}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `table: ${table}`, socketID, UID));
        reject(error);
      };
    });
  };

  // fetchRecords
  //
  fetchRecords(
    socketID = null,
    UID = null,
    table,
    predProp,
    predValue,
    cols = null,
    sortColumn = null,
    sortOrder = "DESC",
    limit = null,
    failOnEmpty = false
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          table: table,
          predProp: predProp,
          predValue: predValue
        }, ["table", "predProp", "predValue"]);

        let query = `
            SELECT ${cols == null ? "*" : "??"}
            FROM ??
            WHERE ?? = ?
            ${sortColumn != null ? `ORDER BY ?? ${sortOrder}` : ""}
            ${limit != null ? `LIMIT ?` : ""}
          `;

        let values = [
          table,
          predProp,
          predValue
        ];

        if (cols !== null) {
          values = [cols].concat(values);
        };

        if (sortColumn !== null) {
          values.push(sortColumn);
          values.push(sortOrder);
        };

        if (limit !== null) {
          values.push(limit);
        };

        this.con.query(query, values, (err, result, fields) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else if (result.length == 0 && failOnEmpty) {
              throw new EmptyDBResult();
            } else {
              this.logger.debug(funcS("db.fetchRecords", `table: ${table}`, socketID, UID));
              resolve(result);
            };
          } catch (error) {
            this.logger.warn(errLog(error, `table: ${table}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `table: ${table}`, socketID, UID));
        reject(error);
      };
    });
  };

  // General Update Functions
  // ========================

  // updateRecord
  // predProps should be a primary keys to ensure that only one record is updated
  updateRecord(
    socketID = null,
    UID = null,
    table,
    predProp1,
    predValue1,
    predProp2 = null,
    predValue2 = null,
    updateProp,
    updateValue
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          table: table,
          predProp1: predProp1,
          predValue1: predValue1,
          updateProp: updateProp,
          updateValue: updateValue
        }, ["table", "predProp1", "predValue1", "updateProp", "updateValue"]);

        let query = `
            UPDATE ??
            SET ?? = ?
            WHERE ?? = ? ${predProp2 !== null && predValue2 !== null ? "AND ?? = ?" : ""}
          `;

        let values = [
          table,
          updateProp,
          updateValue,
          predProp1,
          predValue1
        ];

        if (predProp2 !== null && predValue2 !== null) {
          values.push(predProp2);
          values.push(predValue2);
        };

        this.con.query(query, values, (err, result, fields) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else if (result.affectedRows == 0) {
              throw new EmptyDBResult();
            } else if (result.affectedRows == 1 && result.changedRows == 0) {
              throw new DBErr("no changes made");
            } else {
              this.logger.debug(funcS("db.updateRecord", `table: ${table}, updateProp: ${updateProp}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(errLog(error, `table: ${table}, updateProp: ${updateProp}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `table: ${table}, updateProp: ${updateProp}`, socketID, UID));
        reject(error);
      };
    });
  };

  // updateRecords
  // 
  updateRecords(
    socketID = null,
    UID = null,
    table,
    predProp,
    predValue,
    updateProp,
    updateValue,
    failOnEmpty = false
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          table: table,
          predProp: predProp,
          predValue: predValue,
          updateProp: updateProp,
          updateValue: updateValue
        }, ["table", "predProp", "predValue", "updateProp", "updateValue"]);

        let query = `
            UPDATE ??
            SET ?? = ?
            WHERE ?? = ?
          `;

        let values = [
          table,
          updateProp,
          updateValue,
          predProp,
          predValue
        ];

        this.con.query(query, values, (err, result, fields) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else if (result.affectedRows == 0 && failOnEmpty) {
              throw new EmptyDBResult();
            } else {
              this.logger.debug(funcS("db.updateRecords", `table: ${table}, updateProp: ${updateProp}, updated: ${result.changedRows}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(errLog(error, `table: ${table}, updateProp: ${updateProp}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `table: ${table}, updateProp: ${updateProp}`, socketID, UID));
        reject(error);
      };
    });
  };

  // General Delete Functions
  // ========================

  // deleteRecord
  //
  deleteRecord(
    socketID = null,
    UID = null,
    table,
    predProp1,
    predValue1,
    predProp2 = null,
    predValue2 = null
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          table: table,
          predProp1: predProp1,
          predValue1: predValue1
        }, ["table", "predProp1", "predValue1"]);

        let query = `
            DELETE
            FROM ??
            WHERE ?? = ? ${predProp2 !== null && predValue2 !== null ? "AND ?? = ?" : ""}
          `;

        let values = [
          table,
          predProp1,
          predValue1
        ];

        if (predProp2 !== null && predValue2 !== null) {
          values.push(predProp2);
          values.push(predValue2);
        };

        this.con.query(query, values, (err, result, fields) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else if (result.affectedRows == 0) {
              throw new EmptyDBResult
            } else {
              this.logger.debug(funcS("db.deleteRecord", `table: ${table}, predProp1: ${predProp1}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(errLog(error, `table: ${table}, predProp1: ${predProp1}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `table: ${table}, predProp1: ${predProp1}`, socketID, UID));
        reject(error);
      };
    });
  };

  // deleteRecords
  // 
  deleteRecords(
    socketID = null,
    UID = null,
    table,
    predProp,
    predValue,
    failOnEmpty = false
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          table: table,
          predProp: predProp,
          predValue: predValue
        }, ["table", "predProp", "predValue"]);

        let query = `
            DELETE
            FROM ??
            WHERE ?? = ?
          `;

        let values = [
          table,
          predProp,
          predValue
        ];

        this.con.query(query, values, (err, result, fields) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else if (result.affectedRows == 0 && failOnEmpty) {
              throw new EmptyDBResult
            } else {
              this.logger.debug(funcS("db.deleteRecords", `table: ${table}, predProp: ${predProp}, deleted: ${result.affectedRows}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(errLog(error, `table: ${table}, predProp: ${predProp}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `table: ${table}, predProp: ${predProp}`, socketID, UID));
        reject(error);
      }
    });
  };

  // USERS Table Functions
  // =====================

  createUser(
    socketID = null,
    userID,
    username,
    avatar,
    creationDate
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          userID: userID,
          username: username,
          avatar: avatar,
          creationDate: creationDate
        }, ["userID", "username", "avatar", "creationDate"]);

        let query = `INSERT INTO USERS VALUES (?, ?, ?, ?, ?)`;

        let values = [
          userID,
          username,
          avatar,
          creationDate,
          null
        ];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else {
              this.logger.debug(funcS("db.createUser", `userID: ${userID}, username: ${username}`, socketID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(errLog(error, `userID: ${userID}, username: ${username}`, socketID));
            reject(error);
          }
        });
      } catch (error) {
        this.logger.error(errLog(error, `userID: ${userID}, username: ${username}`, socketID));
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
            } else {
              this.logger.debug(funcS("db.fetchUsersByUsername", `username: ${username}`, socketID, UID));
              resolve(result);
            }
          } catch (error) {
            this.logger.warn(errLog(error, `username: ${username}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `username: ${username}`, socketID, UID));
        reject(error);
      };
    });
  };

  // CRs Table Functions
  // ==================

  createCR(
    socketID = null,
    requestID,
    UID,
    recUID,
    requestDate
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          requestID: requestID,
          UID: UID,
          recUID: recUID,
          requestDate: requestDate
        }, ["requestID", "UID", "recUID", "requestDate"]);

        if (originUserID == receivingUserID) {
          throw new FuncErr("UID and recUID cannot be the same");
        }

        let query = `INSERT INTO CRs VALUES (?, ?, ?, ?)`;

        let values = [
          requestID,
          UID,
          recUID,
          requestDate
        ];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else {
              this.logger.debug(funcS("db.createCR", `requestID: ${requestID}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(errLog(error, `requestID: ${requestID}`, socketID, UID));
            reject(error);
          }
        });
      } catch (error) {
        this.logger.error(errLog(error, `requestID: ${requestID}`, socketID, UID));
        reject(error);
      };
    });
  };

  fetchCRsByUserID(
    socketID = null,
    UID = null,
    userID,
    cols = null,
    sortOrder = "DESC"
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          userID: userID
        }, ["userID"]);

        let query = `
            SELECT ${cols == null ? "*" : "??"}
            FROM CRs
            WHERE originUserID = ? OR receivingUserID = ?
            ORDER BY requestDate ${sortOrder};
          `;

        let values = [userID, userID];

        if (cols !== null) {
          values = [cols].concat(values);
        };

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            } else {
              this.logger.debug(funcS("db.fetchCRsbyUserID", `userID: ${userID}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(errLog(error, `userID: ${userID}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `userID: ${userID}`, socketID, UID));
        reject(error);
      };
    });
  };

  deleteCRsByUserID(
    socketID = null,
    UID = null,
    userID
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          userID: userID
        }, ["userID"]);

        let query = `
            DELETE FROM CRs
            WHERE originUserID = ? OR receivingUserID = ?;
          `;

        let values = [userID, userID];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            };

            this.logger.debug(funcS("db.deleteCRsByUserID", `userID: ${userID}`, socketID, UID));
            resolve();

          } catch (error) {
            this.logger.warn(errLog(error, `userID: ${userID}`, socketID, UID));
            reject(error);
          }
        });
      } catch (error) {
        this.logger.error(errLog(error, `userID: ${userID}`, socketID, UID));
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
    userID,
    creationDate
  ) {
    return new Promise((resolve, reject) => {
      try {
        checkParams({
          channelID: channelID,
          userID: userID,
          creationDate: creationDate
        }, ["channelID", "userID", "creationDate"]);

        let query = `
            INSERT INTO RUChannels 
            VALUES (?, ?, ?)
          `;

        let values = [
          channelID,
          userID,
          creationDate
        ];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            this.logger.debug(funcS("db.createRUChannel", `channelID: ${channelID}`, socketID, UID));
            resolve();

          } catch (error) {
            this.logger.warn(errLog(error, `channelID: ${channelID}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `channelID: ${channelID}`, socketID, UID));
        reject(error);
      };
    });
  };

  fetchRUChannelsByChannelID(
    socketID = null,
    UID = null,
    channelID,
    userID,
    cols = null
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          channelID: channelID,
          userID: userID
        }, ["channelID", "userID"]);

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
          WHERE channelID = ? AND userID != ?
        `;

        let values = [channelID, userID];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            };

            this.logger.debug(funcS("db.fetchRUChannelsByChannelID", `channelID: ${channelID}, userID: ${userID}`, socketID, UID));
            resolve(result);

          } catch (error) {
            this.logger.warn(errLog(error, `channelID: ${channelID}, userID: ${userID}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `channelID: ${channelID}, userID: ${userID}`, socketID, UID));
        reject(error)
      };
    });
  };

  fetchRUChannelsbyUserID(
    socketID = null,
    UID = null,
    userID,
    cols = null
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          userID: userID
        }, ["userID"]);

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
            WHERE userID != ?
            AND channelID IN (
              SELECT channelID
              FROM RUChannels
              WHERE userID = ? 
            );
          `;

        let values = [userID, userID];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            };

            this.logger.debug(funcS("db.fetchRUChannelsbyUserID", `userID: ${userID}`, socketID, UID));
            resolve(result);

          } catch (error) {
            this.logger.warn(errLog(error, `userID: ${userID}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `userID: ${userID}`, socketID, UID));
        reject(error);
      };
    });
  };

  deleteRUChannelsByUserID(
    socketID = null,
    UID = null,
    userID
  ) {
    return new Promise(async (resolve, reject) => {
      try {

        checkParams({
          userID: userID
        }, ["userID"]);

        let channelRecords = await this.fetchRecords(socketID, UID, "RUChannels", "userID", userID, "channelID");

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

              this.logger.debug(funcS("db.deleteRUChannelsByUserID", `userID: ${userID}, deleted: ${result.affectedRows}`, socketID, UID));
              resolve();

            } catch (error) {
              this.logger.warn(errLog(error, `userID: ${userID}, deleted: ${result.affectedRows}`, socketID, UID));
              reject(error);
            };
          });
        } else {
          this.logger.debug(funcS("db.deleteRUChannelsByUserID", `userID: ${userID}, deleted: 0`, socketID, UID));
          resolve();
        };
      } catch (error) {
        this.logger.error(errLog(error, `userID: ${userID}`, socketID, UID));
        reject(error);
      };
    });
  };

  // EVENTS Table Functions
  // =====================

  createEvent(
    socketID = null,
    eventName,
    datetime,
    UID,
    recUID,
    packetBuffer
  ) {
    return new Promise((resolve, reject) => {
      try {

        checkParams({
          eventName: eventName,
          datetime: datetime,
          UID: UID,
          recUID: recUID
        }, ["eventName", "datetime", "UID", "recUID"]);

        let query = `
            INSERT INTO EVENTS 
            (eventName, datetime, originUserID, receivingUserID, packet) 
            VALUES (?, ?, ?, ?, ?)
          `;

        let values = [
          eventName,
          datetime,
          UID,
          recUID,
          packetBuffer
        ];

        this.con.query(query, values, (err, result) => {
          try {
            if (err) {
              throw new DBErr(err.message);
            }

            this.logger.debug(funcS("db.createEvent", `eventName: ${eventName} recUID: ${recUID}`, socketID, UID));
            resolve();

          } catch (error) {
            this.logger.warn(errLog(error, `eventName: ${eventName} recUID: ${recUID}`, socketID, UID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(errLog(error, `eventName: ${eventName} recUID: ${recUID}`, socketID, UID));
        reject(error);
      };
    });
  };
};

module.exports = Database;
