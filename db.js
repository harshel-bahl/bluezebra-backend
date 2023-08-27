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
  SMsg,
  FMsg,
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
          throw new DBErr(FMsg(undefined, err.message));
        }

        this.logger.info(SMsg("db.connectDB", undefined, "connected to MySQL DB"))
        this.connected = true;

        this.createTables();
      } catch (error) {
        this.logger.error(error)
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
          throw new DBErr(FMsg(undefined, err.message));
        };

        this.logger.info(SMsg("db.createTables", undefined, "created 'users' table if not present"));
      } catch (error) {
        this.logger.error(error);
      };
    });

    this.con.query(table2, (err, result) => {
      try {
        if (err) {
          throw new DBErr(FMsg(undefined, err.message));
        };

        this.logger.info(SMsg("db.createTables", undefined, "created 'CRs' table if not present"));
      } catch (error) {
        this.logger.error(error);
      };
    });

    this.con.query(table3, (err, result) => {
      try {
        if (err) {
          throw new DBErr(FMsg(undefined, err.message));
        };

        this.logger.info(SMsg("db.createTables", undefined, "created 'RUChannels' table if not present"));
      } catch (error) {
        this.logger.error(error);
      };
    });

    this.con.query(table4, (err, result) => {
      try {
        if (err) {
          throw new DBErr(FMsg(undefined, err.message));
        };

        this.logger.info(SMsg("db.createTables", undefined, "created 'events' table if not present"));
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message, socketID, UID));
            } else if (result.length == 0 && errorOnEmpty) {
              throw new EmptyDBResult(FMsg(undefined, `no record found in table: ${table}`));
            } else if (result.length > 1 && errorOnMultiple) {
              throw new MultipleDBResults(FMsg(undefined, `multiple records found in table: ${table}`));
            } else {
              this.logger.debug(SMsg("db.fetchRecord", undefined, `table: ${table}`, socketID, UID));
              resolve(result[0]);
            };
          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            } else if (result.length == 0 && failOnEmpty) {
              throw new EmptyDBResult(FMsg(undefined, `no records found in table: ${table}`));
            } else {
              this.logger.debug(SMsg("db.fetchRecords", undefined, `table: ${table}`, socketID, UID));
              resolve(result);
            };
          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            } else if (result.affectedRows == 0) {
              throw new EmptyDBResult(FMsg(undefined, `no record found in table: ${table}`));
            } else if (result.affectedRows == 1 && result.changedRows == 0) {
              throw new DBErr(FMsg(undefined, `no changes made to record in table: ${table}`));
            } else {
              this.logger.debug(SMsg("db.updateRecord", undefined, `table: ${table}, updateProp: ${updateProp}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            } else if (result.affectedRows == 0 && failOnEmpty) {
              throw new EmptyDBResult(FMsg(undefined, `no records found in table: ${table}`));
            } else {
              this.logger.debug(SMsg("db.updateRecords", undefined, `table: ${table}, updateProp: ${updateProp}, updated: ${result.changedRows}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            } else if (result.affectedRows == 0) {
              throw new EmptyDBResult(FMsg(undefined, `no record found in table: ${table}`));
            } else {
              this.logger.debug(SMsg("db.deleteRecord", undefined, `table: ${table}, predProp1: ${predProp1}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            } else if (result.affectedRows == 0 && failOnEmpty) {
              throw new EmptyDBResult(FMsg(undefined, `no records found in table: ${table}`));
            } else {
              this.logger.debug(SMsg("db.deleteRecords", undefined, `table: ${table}, predProp: ${predProp}, deleted: ${result.affectedRows}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            } else {
              this.logger.debug(SMsg("db.createUser", undefined, `userID: ${userID}, username: ${username}`, socketID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(error);
            reject(error);
          }
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            } else {
              this.logger.debug(SMsg("db.fetchUsersByUsername", undefined, `username: ${username}`, socketID, UID));
              resolve(result);
            }
          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            } else {
              this.logger.debug(SMsg("db.createCR", undefined, `requestID: ${requestID}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(error);
            reject(error);
          }
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            } else {
              this.logger.debug(SMsg("db.fetchCRsbyUserID", undefined, `userID: ${userID}`, socketID, UID));
              resolve();
            };
          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            };

            this.logger.debug(SMsg("db.deleteCRsByUserID", undefined, `userID: ${userID}`, socketID, UID));
            resolve();

          } catch (error) {
            this.logger.warn(error);
            reject(error);
          }
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            }

            this.logger.debug(SMsg("db.createRUChannel", undefined, `channelID: ${channelID}`, socketID, UID));
            resolve();

          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            };

            this.logger.debug(SMsg("db.fetchRUChannelsByChannelID", undefined, `channelID: ${channelID}, userID: ${userID}`, socketID, UID));
            resolve(result);

          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            };

            this.logger.debug(SMsg("db.fetchRUChannelsbyUserID", undefined, `userID: ${userID}`, socketID, UID));
            resolve(result);

          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
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
                throw new DBErr(FMsg(undefined, err.message));
              }

              this.logger.debug(SMsg("db.deleteRUChannelsByUserID", undefined, `userID: ${userID}, deleted: ${result.affectedRows}`, socketID, UID));
              resolve();

            } catch (error) {
              this.logger.warn(error);
              reject(error);
            };
          });
        } else {
          this.logger.debug(SMsg("db.deleteRUChannelsByUserID", undefined, `userID: ${userID}, deleted: 0`, socketID, UID));
          resolve();
        };
      } catch (error) {
        this.logger.error(error);
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
              throw new DBErr(FMsg(undefined, err.message));
            }

            this.logger.debug(SMsg("db.createEvent", undefined, `eventName: ${eventName} recUID: ${recUID}`, socketID, UID));
            resolve();

          } catch (error) {
            this.logger.warn(error);
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(error);
        reject(error);
      };
    });
  };
};

module.exports = Database;
