var mysql = require('mysql');
const util = require('./utilities');
const error = require('./error');

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
          throw new error.DBError("db.connectDC", err.message);
        }

        this.logger.info(util.funcS("db.connectDB", "connected to MySQL DB"))
        this.connected = true;

        this.createTables();
      } catch (error) {
        this.logger.error(util.funcF("db.connectDB", error));
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
          throw new error.DBError("db.createTables", err.message);
        };

        this.logger.info(util.funcS("db.createTables", "created 'users' table if not present"));
      } catch (error) {
        this.logger.error(util.funcF("db.createTables", error, "failed to create 'users' table"));
      };
    });

    this.con.query(table2, (err, result) => {
      try {
        if (err) {
          throw new error.DBError("db.createTables", err.message);
        };

        this.logger.info(util.funcS("db.createTables", "created 'CRs' table if not present"));
      } catch (error) {
        this.logger.error(util.funcF("db.createTables", error, "failed to create 'CRs' table"));
      };
    });

    this.con.query(table3, (err, result) => {
      try {
        if (err) {
          throw new error.DBError("db.createTables", err.message);
        };

        this.logger.info(util.funcS("db.createTables", "created 'RUChannels' table if not present"));
      } catch (error) {
        this.logger.error(util.funcF("db.createTables", error, "failed to create 'RUChannels' table"));
      };
    });

    this.con.query(table4, (err, result) => {
      try {
        if (err) {
          throw new error.DBError("db.createTables", err.message);
        };

        this.logger.info(util.funcS("db.createTables", "created 'events' table if not present"));
      } catch (error) {
        this.logger.error(util.funcF("db.createTables", error, "failed to create 'events' table"));
      };
    });
  };


  // General Fetch Functions
  // =======================

  // fetchRecord
  // predProps should be a primary keys to ensure that only one record is fetched
  fetchRecord(
    origSocketID = null,
    origUID = null,
    table,
    predProp1,
    predValue1,
    predProp2 = null,
    predValue2 = null,
    cols = null,
    errorOnEmpty = true,
    errorOnMultiple = false) {

    return new Promise((resolve, reject) => {
      try {
        if (table == null || predProp1 == null || predValue1 == null) {
          throw new error.DBError("db.fetchRecord", `missing required parameters: table: ${table}, predProp1: ${predProp1}, predValue1: ${predValue1}`);
        } else {

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
                throw new error.DBError("db.fetchRecord", err.message);
              } else if (result.length == 0 && errorOnEmpty) {
                throw new error.DBError("db.fetchRecord", "no results");
              } else if (result.length > 1 && errorOnMultiple) {
                throw new error.DBError("db.fetchRecord", "multiple results");
              } else {
                this.logger.debug(util.funcS("db.fetchRecord", `table: ${table}`, origSocketID, origUID));
                resolve(result[0]);
              };
            } catch (error) {
              this.logger.warn(util.funcF("db.fetchRecord", error, `table: ${table}`, origSocketID, origUID));
              reject(error);
            };
          });
        };

      } catch (error) {
        this.logger.error(util.funcF("db.fetchRecord", error, `table: ${table}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  // fetchRecords
  //
  fetchRecords(
    origSocketID = null,
    origUID = null,
    table,
    predProp,
    predValue,
    cols = null,
    sortColumn = null,
    sortOrder = "DESC",
    limit = null,
    failOnEmpty = false) {

    return new Promise((resolve, reject) => {
      try {
        if (table == null || predProp == null || predValue == null) {
          throw new error.DBError("db.fetchRecords", `missing required parameters: table: ${table}, predProp: ${predProp}, predValue: ${predValue}`);
        } else {

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
                throw new error.DBError("db.fetchRecords", err.message);
              } else if (result.length == 0 && failOnEmpty) {
                throw new error.DBError("db.fetchRecords", "no results");
              } else {
                this.logger.debug(util.funcS("db.fetchRecords", `table: ${table}`, origSocketID, origUID));
                resolve(result);
              };
            } catch (error) {
              this.logger.warn(util.funcF("db.fetchRecords", error, `table: ${table}`, origSocketID, origUID));
              reject(error);
            };
          });
        };

      } catch (error) {
        this.logger.error(util.funcF("db.fetchRecords", error, `table: ${table}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  // General Update Functions
  // ========================

  // updateRecord
  // predProps should be a primary keys to ensure that only one record is updated
  updateRecord(
    origSocketID = null,
    origUID = null,
    table,
    predProp1,
    predValue1,
    predProp2 = null,
    predValue2 = null,
    updateProp,
    updateValue) {

    return new Promise((resolve, reject) => {

      try {
        if (table == null || predProp1 == null || predValue1 == null || updateProp == null || updateValue == null) {
          throw new error.DBError("db.updateRecord", `missing required parameters: table: ${table}, predProp1: ${predProp1}, predValue1: ${predValue1}, updateProp: ${updateProp}, updateValue: ${updateValue}`);
        } else {

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
                throw new error.DBError("db.updateRecord", err.message);
              } else if (result.affectedRows == 0) {
                throw new error.DBError("db.updateRecord", "no records found");
              } else if (result.affectedRows == 1 && result.changedRows == 0) {
                throw new error.DBError("db.updateRecord", "no changes made");
              } else {
                this.logger.debug(util.funcS("db.updateRecord", `table: ${table}, updateProp: ${updateProp}`, origSocketID, origUID));
                resolve();
              };
            } catch (error) {
              this.logger.warn(util.funcF("db.updateRecord", error, `table: ${table}, updateProp: ${updateProp}`, origSocketID, origUID));
              reject(error);
            };
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.updateRecord", error, `table: ${table}, updateProp: ${updateProp}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  // updateRecords
  // 
  updateRecords(
    origSocketID = null,
    origUID = null,
    table,
    predProp,
    predValue,
    updateProp,
    updateValue,
    failOnEmpty = false) {

    return new Promise((resolve, reject) => {

      try {
        if (table == null || predProp == null || predValue == null || updateProp == null || updateValue == null) {
          throw new error.DBError("db.updateRecords", `missing required parameters: table: ${table}, predProp: ${predProp}, predValue: ${predValue}, updateProp: ${updateProp}, updateValue: ${updateValue}`);
        } else {

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
                throw new error.DBError("db.updateRecords", err.message);
              } else if (result.affectedRows == 0 && failOnEmpty) {
                throw new error.DBError("db.updateRecords", "no records found");
              } else {
                this.logger.debug(util.funcS("db.updateRecords", `table: ${table}, updateProp: ${updateProp}, updated: ${result.changedRows}`, origSocketID, origUID));
                resolve();
              };
            } catch (error) {
              this.logger.warn(util.funcF("db.updateRecords", error, `table: ${table}, updateProp: ${updateProp}`, origSocketID, origUID));
              reject(error);
            };
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.updateRecords", error, `table: ${table}, updateProp: ${updateProp}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  // General Delete Functions
  // ========================

  // deleteRecord
  //
  deleteRecord(
    origSocketID = null,
    origUID = null,
    table,
    predProp1,
    predValue1,
    predProp2 = null,
    predValue2 = null) {

    return new Promise((resolve, reject) => {

      try {
        if (table == null || predProp1 == null || predValue1 == null) {
          throw new error.DBError("db.deleteRecord", `missing required parameters: table: ${table}, predProp1: ${predProp1}, predValue1: ${predValue1}`);
        } else {

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
                throw new error.DBError("db.deleteRecord", err.message);
              } else if (result.affectedRows == 0) {
                throw new error.DBError("db.deleteRecord", "no records found");
              } else {
                this.logger.debug(util.funcS("db.deleteRecord", `table: ${table}, predProp1: ${predProp1}`, origSocketID, origUID));
                resolve();
              };
            } catch (error) {
              this.logger.warn(util.funcF("db.deleteRecord", error, `table: ${table}, predProp1: ${predProp1}`, origSocketID, origUID));
              reject(error);
            };
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.deleteRecord", error, `table: ${table}, predProp1: ${predProp1}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  // deleteRecords
  // 
  deleteRecords(
    origSocketID = null,
    origUID = null,
    table,
    predProp,
    predValue,
    failOnEmpty = false) {

    return new Promise((resolve, reject) => {

      try {
        if (table == null || predProp == null || predValue == null) {
          throw new error.DBError("db.deleteRecords", `missing required parameters: table: ${table}, predProp: ${predProp}, predValue: ${predValue}`);
        } else {

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
                throw new error.DBError("db.deleteRecords", err.message);
              } else if (result.affectedRows == 0 && failOnEmpty) {
                throw new error.DBError("db.deleteRecords", "no records found");
              } else {
                this.logger.debug(util.funcS("db.deleteRecords", `table: ${table}, predProp: ${predProp}, deleted: ${result.affectedRows}`, origSocketID, origUID));
                resolve();
              };
            } catch (error) {
              this.logger.warn(util.funcF("db.deleteRecords", error, `table: ${table}, predProp: ${predProp}`, origSocketID, origUID));
              reject(error);
            };
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.deleteRecords", error, `table: ${table}, predProp: ${predProp}`, origSocketID, origUID));
        reject(error);
      }
    });
  };

  // USERS Table Functions
  // =====================

  createUser(
    origSocketID = null,
    userID,
    username,
    avatar,
    creationDate
  ) {
    return new Promise((resolve, reject) => {
      try {
        if (userID == null || username == null || avatar == null || creationDate == null) {
          throw new error.DBError("db.createUser", `missing required parameters: userID: ${userID}, username: ${username}, avatar: ${avatar}, creationDate: ${creationDate}`);
        } else {
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
                throw new error.DBError("db.createUser", err.message);
              } else if (result.affectedRows == 0) {
                throw new error.DBError("db.createUser", "failed to create user");
              } else {
                this.logger.debug(util.funcS("db.createUser", `userID: ${userID}, username: ${username}`, origSocketID));
                resolve();
              };
            } catch (error) {
              this.logger.warn(util.funcF("db.createUser", error, `userID: ${userID}, username: ${username}`, origSocketID));
              reject(error);
            }
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.createUser", error, `userID: ${userID}, username: ${username}`, origSocketID));
        reject(error);
      }
    });
  };

  fetchUsersByUsername(
    origSocketID = null,
    origUID = null,
    username,
    limit = 10
  ) {
    return new Promise((resolve, reject) => {
      try {
        if (username == null) {
          throw new error.DBError("db.fetchUsersByUsername", `missing required parameters: username: ${username}`);
        } else {

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
                throw new error.DBError("db.fetchUsersByUsername", err.message);
              } else {
                this.logger.debug(util.funcS("db.fetchUsersByUsername", `username: ${username}`, origSocketID, origUID));
                resolve(result);
              }
            } catch (error) {
              this.logger.warn(util.funcF("db.fetchUsersByUsername", error, `username: ${username}`, origSocketID, origUID));
              reject(error);
            };
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.fetchUsersByUsername", error, `username: ${username}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  // CRs Table Functions
  // ==================

  createCR(
    origSocketID = null,
    requestID,
    origUID,
    recUID,
    requestDate
  ) {
    return new Promise((resolve, reject) => {
      try {
        if (requestID == null || origUID == null || recUID == null || requestDate == null) {
          throw new error.DBError("db.createCR", `missing required parameters: requestID: ${requestID}, origUID: ${origUID}, recUID: ${recUID}, requestDate: ${requestDate}`);
        } else if (originUserID == receivingUserID) {
          throw new error.DBError("db.createCR", "origUID and recUID cannot be the same");
        } else {

          let query = `INSERT INTO CRs VALUES (?, ?, ?, ?)`;

          let values = [
            requestID,
            origUID,
            recUID,
            requestDate
          ];

          this.con.query(query, values, (err, result) => {
            try {
              if (err) {
                throw new error.DBError("db.createCR", err.message);
              } else {
                this.logger.debug(util.funcS("db.createCR", `requestID: ${requestID}`, origSocketID, origUID));
                resolve();
              };
            } catch (error) {
              this.logger.warn(util.funcF("db.createCR", error, `requestID: ${requestID}`, origSocketID, origUID));
              reject(error);
            }
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.createCR", error, `requestID: ${requestID}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  fetchCRsByUserID(
    origSocketID = null,
    origUID = null,
    userID,
    cols = null,
    sortOrder = "DESC"
  ) {
    return new Promise((resolve, reject) => {
      try {
        if (userID == null) {
          throw new error.DBError("db.fetchCRsByUserID", `missing required parameters: userID: ${userID}`);
        } else {

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
                throw new error.DBError("db.fetchCRsByUserID", err.message);
              } else {
                this.logger.debug(util.funcS("db.fetchCRsbyUserID", `userID: ${userID}`, origSocketID, origUID));
                resolve();
              };
            } catch (error) {
              this.logger.warn(util.funcF("db.fetchCRsByUserID", error, `userID: ${userID}`, origSocketID, origUID));
              reject(error);
            };
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.fetchCRsByUserID", error, `userID: ${userID}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  deleteCRsByUserID(
    origSocketID = null,
    origUID = null,
    userID
  ) {
    return new Promise((resolve, reject) => {
      try {
        if (userID == null) {
          throw new error.DBError("db.deleteCRsByUserID", `missing required parameters: userID: ${userID}`);
        } else {

          let query = `
            DELETE FROM CRs
            WHERE originUserID = ? OR receivingUserID = ?;
          `;

          let values = [userID, userID];

          this.con.query(query, values, (err, result) => {
            try {
              if (err) {
                throw new error.DBError("db.deleteCRsByUserID", err.message);
              };

              this.logger.debug(util.funcS("db.deleteCRsByUserID", `userID: ${userID}`, origSocketID, origUID));
              resolve();

            } catch (error) {
              this.logger.warn(util.funcF("db.deleteCRsByUserID", error, `userID: ${userID}`, origSocketID, origUID));
              reject(error);
            }
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.deleteCRsByUserID", error, `userID: ${userID}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  // RUChannels Table Functions
  // =========================

  createRUChannel(
    origSocketID = null,
    origUID = null,
    channelID,
    userID,
    creationDate
  ) {
    return new Promise((resolve, reject) => {
      try {
        if (channelID == null || userID == null || creationDate == null) {
          throw new error.DBError("db.createRUChannel", `missing required parameters: channelID: ${channelID}, userID: ${userID}, creationDate: ${creationDate}`);
        } else {

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
                throw new error.DBError("db.createRUChannel", err.message);
              } 

              this.logger.debug(util.funcS("db.createRUChannel", `channelID: ${channelID}`, origSocketID, origUID));
              resolve();

            } catch (error) {
              this.logger.warn(util.funcF("db.createRUChannel", error, `channelID: ${channelID}`, origSocketID, origUID));
              reject(error);
            };
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.createRUChannel", error, `channelID: ${channelID}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  fetchRUChannelsByChannelID(
    origSocketID = null,
    origUID = null,
    channelID,
    userID,
    cols = null
  ) {
    return new Promise((resolve, reject) => {

      try {
        if (channelID == null || userID == null) {
          throw new error.DBError("db.fetchRUChannelsByChannelID", `missing required parameters: channelID: ${channelID}, userID: ${userID}`);
        };

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
              throw new error.DBError("db.fetchRUChannelsByChannelID", err.message);
            };

            this.logger.debug(util.funcS("db.fetchRUChannelsByChannelID", `channelID: ${channelID}, userID: ${userID}`, origSocketID, origUID));
            resolve(result);

          } catch (error) {
            this.logger.warn(util.funcF("db.fetchRUChannelsByChannelID", error, `channelID: ${channelID}, userID: ${userID}`, origSocketID, origUID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(util.funcF("db.fetchRUChannelsByChannelID", error, `channelID: ${channelID}, userID: ${userID}`, origSocketID, origUID));
        reject(error)
      };
    });
  };

  fetchRUChannelsbyUserID(
    origSocketID = null,
    origUID = null,
    userID,
    cols = null
  ) {
    return new Promise((resolve, reject) => {
      try {
        if (userID == null) {
          throw new error.DBError("db.fetchRUChannelsbyUserID", `missing required parameters: userID: ${userID}`);
        };

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
              throw new error.DBError("db.fetchRUChannelsbyUserID", err.message);
            };

            this.logger.debug(util.funcS("db.fetchRUChannelsbyUserID", `userID: ${userID}`, origSocketID, origUID));
            resolve(result);

          } catch (error) {
            this.logger.warn(util.funcF("db.fetchRUChannelsbyUserID", error, `userID: ${userID}`, origSocketID, origUID));
            reject(error);
          };
        });
      } catch (error) {
        this.logger.error(util.funcF("db.fetchRUChannelsbyUserID", error, `userID: ${userID}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  deleteRUChannelsByUserID(
    origSocketID = null,
    origUID = null,
    userID
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        if (userID == null) {
          throw new error.DBError("db.deleteRUChannelsByUserID", `missing required parameters: userID: ${userID}`);
        } else {

          let channelRecords = await this.fetchRecords("RUChannels", "userID", userID, "channelID");

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
                  throw new error.DBError("db.deleteRUChannelsByUserID", err.message);
                } 

                this.logger.debug(util.funcS("db.deleteRUChannelsByUserID", `userID: ${userID}, deleted: ${result.affectedRows}`, origSocketID, origUID));
                resolve();

              } catch (error) {
                this.logger.warn(util.funcF("db.deleteRUChannelsByUserID", error, `userID: ${userID}, deleted: ${result.affectedRows}`, origSocketID, origUID));
                reject(error);
              };
            });
          } else {
            this.logger.debug(util.funcS("db.deleteRUChannelsByUserID", `userID: ${userID}, deleted: 0`, origSocketID, origUID));
            resolve();
          };
        };
      } catch (error) {
        this.logger.error(util.funcF("db.deleteRUChannelsByUserID", error, `userID: ${userID}`, origSocketID, origUID));
        reject(error);
      };
    });
  };

  // EVENTS Table Functions
  // =====================

  createEvent(
    origSocketID = null,
    eventName,
    datetime,
    origUID,
    recUID,
    packetBuffer
  ) {
    return new Promise((resolve, reject) => {

      try {
        if (eventName == null || datetime == null || origUID == null || recUID == null) {
          throw new error.DBError("db.createEvent", `missing required parameters: eventName: ${eventName}, datetime: ${datetime}, origUID: ${origUID}, recUID: ${recUID}`);
        } else {

          let query = `
            INSERT INTO EVENTS 
            (eventName, datetime, originUserID, receivingUserID, packet) 
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
                throw new error.DBError("db.createEvent", err.message);
              } 

              this.logger.debug(util.funcS("db.createEvent", `eventName: ${eventName} recUID: ${recUID}`, origSocketID, origUID));
              resolve();

            } catch (error) {
              this.logger.warn(util.funcF("db.createEvent", error, `eventName: ${eventName} recUID: ${recUID}`, origSocketID, origUID));
              reject(error);
            };
          });
        };
      } catch (error) {
        this.logger.error(util.funcF("db.createEvent", error, `eventName: ${eventName} recUID: ${recUID}`, origSocketID, origUID));
        reject(error);
      };
    });
  };
};

module.exports = Database;
