var mysql = require('mysql');
const util = require('./utilities');

class Database {

  constructor(showLogs = false) {
    this.con = mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "Smashers1!",
      database: "bluezebra",
      // socketPath: "/var/run/mysqld/mysqld.sock"
    });

    this.showLogs = showLogs;
  };

  connect() {
    this.con.connect(function (err) {
      if (err) throw err;
      console.log("Connected to MySQL server!");
    });

    this.createTables();
  };

  // Table Creation Functions
  // ========================

  createTables() {

    var sql1 = `CREATE TABLE IF NOT EXISTS USERS (
      userID VARCHAR(255) NOT NULL CHECK (userID <> ''),
      username VARCHAR(255) NOT NULL CHECK (username <> ''), 
      avatar VARCHAR(50) NOT NULL,
      creationDate DATETIME NOT NULL, 
      lastOnline DATETIME,
      PRIMARY KEY (userID),
      UNIQUE (username)
    );`;

    var sql2 = `CREATE TABLE IF NOT EXISTS CRs (
      requestID VARCHAR(255) NOT NULL CHECK (requestID <> ''),
      originUserID VARCHAR(255) NOT NULL CHECK (originUserID <> ''),
      receivingUserID VARCHAR(255) NOT NULL CHECK (receivingUserID <> ''),
      requestDate DATETIME NOT NULL,
      PRIMARY KEY (requestID)
    );`;

    var sql3 = `CREATE TABLE IF NOT EXISTS RUChannels (
      channelID VARCHAR(255) NOT NULL CHECK (channelID <> ''),
      userID VARCHAR(255) NOT NULL CHECK (userID <> ''),
      creationDate DATETIME NOT NULL,
      PRIMARY KEY (channelID, userID)
    );`;

    var sql4 = `CREATE TABLE IF NOT EXISTS EVENTS (
      eventID INT AUTO_INCREMENT PRIMARY KEY,
      eventName VARCHAR(255) NOT NULL,
      datetime DATETIME(3) NOT NULL,
      originUserID VARCHAR(255) NOT NULL CHECK (originUserID <> ''),
      receivingUserID VARCHAR(255) NOT NULL CHECK (receivingUserID <> ''),
      packet BLOB
    );`;

    this.con.query(sql1, function (err, result) {
      if (err) throw err;
      util.handleFuncSuccess("db.createTables", "Created 'users' table if not present", this.showLogs);
    });

    this.con.query(sql2, function (err, result) {
      if (err) throw err;
      util.handleFuncSuccess("db.createTables", "Created 'CRs' table if not present", this.showLogs);
    });

    this.con.query(sql3, function (err, result) {
      if (err) throw err;
      util.handleFuncSuccess("db.createTables", "Created 'RUChannels' table if not present", this.showLogs);
    });

    this.con.query(sql4, function (err, result) {
      if (err) throw err;
      util.handleFuncSuccess("db.createTables", "Created 'events' table if not present", this.showLogs);
    });
  };


  // General Fetch Functions
  // =======================

  // fetchRecord
  // predProps should be a primary keys to ensure that only one record is fetched
  fetchRecord(
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
          throw util.funcErr("db.fetchRecord", "missing required parameters");
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

          this.con.query(query, values, function (err, result, fields) {
            try {
              if (err) {
                throw util.funcErr("db.fetchRecord", err);
              } else if (result.length == 0 && errorOnEmpty) {
                throw util.funcErr("db.fetchRecord", "no results");
              } else if (result.length > 1 && errorOnMultiple) {
                throw util.funcErr("db.fetchRecord", "multiple results");
              } else {
                util.handleFuncSuccess("db.fetchRecord", `table: ${table}`, this.showLogs);
                resolve(result[0]);
              };
            } catch (error) {
              util.handleFuncFailure("db.fetchRecord", error, `table: ${table}`, this.showLogs);
              reject(error);
            };
          });
        };

      } catch (error) {
        util.handleFuncFailure("db.fetchRecord", error, `table: ${table}`, this.showLogs);
        reject(error);
      };
    });
  };

  // fetchRecords
  //
  fetchRecords(
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
          throw util.funcErr("db.fetchRecords", "missing required parameters");
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

          this.con.query(query, values, function (err, result, fields) {
            try {
              if (err) {
                throw util.funcErr("db.fetchRecords", err);
              } else if (result.length == 0 && failOnEmpty) {
                throw util.funcErr("db.fetchRecords", "no results");
              } else {
                util.handleFuncSuccess("db.fetchRecords", `table: ${table}`, this.showLogs);
                resolve(result);
              };
            } catch (error) {
              util.handleFuncFailure("db.fetchRecords", error, `table: ${table}`, this.showLogs);
              reject(error);
            };
          });
        };

      } catch (error) {
        util.handleFuncFailure("db.fetchRecords", error, `table: ${table}`, this.showLogs);
        reject(error);
      };
    });
  };

  // General Update Functions
  // ========================

  // updateRecord
  // predProps should be a primary keys to ensure that only one record is updated
  updateRecord(
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
          throw util.funcErr("db.updateRecord", "missing required parameters");
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

          this.con.query(query, values, function (err, result, fields) {
            try {
              if (err) {
                throw util.funcErr("db.updateRecord", err);
              } else if (result.affectedRows == 0) {
                throw util.funcErr("db.updateRecord", "no records found");
              } else if (result.affectedRows == 1 && result.changedRows == 0) {
                throw util.funcErr("db.updateRecord", "no changes made");
              } else {
                util.handleFuncSuccess("db.updateRecord", `table: ${table}, updateProp: ${updateProp}`, this.showLogs);
                resolve();
              };
            } catch (error) {
              util.handleFuncFailure("db.updateRecord", error, `table: ${table}, updateProp: ${updateProp}`, this.showLogs);
              reject(error);
            };
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.updateRecord", error, `table: ${table}, updateProp: ${updateProp}`, this.showLogs);
        reject(error);
      };
    });
  };

  // updateRecords
  // 
  updateRecords(
    table,
    predProp,
    predValue,
    updateProp,
    updateValue,
    failOnEmpty = false) {

    return new Promise((resolve, reject) => {

      try {
        if (table == null || predProp == null || predValue == null || updateProp == null || updateValue == null) {
          throw util.funcErr("db.updateRecords", "missing required parameters");
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

          this.con.query(query, values, function (err, result, fields) {
            try {
              if (err) {
                throw util.funcErr("db.updateRecords", err);
              } else if (result.affectedRows == 0 && failOnEmpty) {
                throw util.funcErr("db.updateRecords", "no records found");
              } else {
                util.handleFuncSuccess("db.updateRecords", `table: ${table}, updateProp: ${updateProp}, updated: ${result.changedRows}`, this.showLogs);
                resolve();
              };
            } catch (error) {
              util.handleFuncFailure("db.updateRecords", error, `table: ${table}, updateProp: ${updateProp}`, this.showLogs);
              reject(error);
            };
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.updateRecords", error, `table: ${table}, updateProp: ${updateProp}`, this.showLogs);
        reject(error);
      };
    });
  };

  // General Delete Functions
  // ========================

  // deleteRecord
  //
  deleteRecord(
    table,
    predProp1,
    predValue1,
    predProp2 = null,
    predValue2 = null) {

    return new Promise((resolve, reject) => {

      try {
        if (table == null || predProp1 == null || predValue1 == null) {
          throw util.funcErr("db.deleteRecord", "missing required parameters");
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

          this.con.query(query, values, function (err, result, fields) {
            try {
              if (err) {
                throw util.funcErr("db.deleteRecord", err);
              } else if (result.affectedRows == 0) {
                throw util.funcErr("db.deleteRecord", "no record found");
              } else {
                util.handleFuncSuccess("db.deleteRecord", `table: ${table}, predProp1: ${predProp1}`, this.showLogs);
                resolve();
              };
            } catch (error) {
              util.handleFuncFailure("db.deleteRecord", error, `table: ${table}, predProp1: ${predProp1}`, this.showLogs);
              reject(error);
            };
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.deleteRecord", error, `table: ${table}, predProp1: ${predProp1}`, this.showLogs);
        reject(error);
      };
    });
  };

  // deleteRecords
  // 
  deleteRecords(
    table,
    predProp,
    predValue,
    failOnEmpty = false) {

    return new Promise((resolve, reject) => {

      try {
        if (table == null || predProp == null || predValue == null) {
          throw util.funcErr("db.deleteRecords", "missing required parameters");
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

          this.con.query(query, values, function (err, result, fields) {
            try {
              if (err) {
                throw util.funcErr("db.deleteRecords", err);
              } else if (result.affectedRows == 0 && failOnEmpty) {
                throw util.funcErr("db.deleteRecords", "no records found");
              } else {
                util.handleFuncSuccess("db.deleteRecords", `table: ${table}, predProp: ${predProp}, deleted: ${result.affectedRows}`, this.showLogs);
                resolve();
              };
            } catch (error) {
              util.handleFuncFailure("db.deleteRecords", error, `table: ${table}, predProp: ${predProp}`, this.showLogs);
              reject(error);
            };
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.deleteRecords", error, `table: ${table}, predProp: ${predProp}`, this.showLogs);
        reject(error);
      }
    });
  };

  // USERS Table Functions
  // =====================

  createUser(userID, username, avatar, creationDate) {

    return new Promise((resolve, reject) => {
      try {
        if (userID == null || username == null || avatar == null || creationDate == null) {
          throw util.funcErr("db.createUser", "missing required parameters");
        } else {
          let query = `INSERT INTO USERS VALUES (?, ?, ?, ?, ?)`;

          let values = [
            userID,
            username,
            avatar,
            creationDate,
            null
          ];

          this.con.query(query, values, function (err, result) {
            try {
              if (err) {
                throw util.funcErr("db.createUser", err);
              } else if (result.affectedRows == 0) {
                throw util.funcErr("db.createUser", "failed to create user");
              } else {
                util.handleFuncSuccess("db.createUser", `userID: ${userID}`, this.showLogs);
                resolve();
              };
            } catch (error) {
              util.handleFuncFailure("db.createUser", error, `userID: ${userID}`, this.showLogs);
              reject(error);
            }
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.createUser", error, `userID: ${userID}`, this.showLogs);
        reject(error);
      }
    });
  };

  fetchUsersByUsername(username, limit = 10) {

    return new Promise((resolve, reject) => {
      try {
        if (username == null) {
          throw util.funcErr("db.fetchUsersByUsername", "missing required parameters");
        } else {

          let query = `
            (SELECT * FROM USERS WHERE username = ?)
            UNION ALL
            (SELECT * FROM USERS WHERE username LIKE ? AND username != ? ORDER BY username LIMIT 10)
            ORDER BY CASE WHEN username = ? THEN 0 ELSE 1 END, username
            LIMIT ?;
          `;

          let values = [username, username + '%', username, username, limit];

          this.con.query(query, values, function (err, result) {
            try {
              if (err) {
                throw util.funcErr("db.fetchUsersByUsername", err);
              } else {
                util.handleFuncSuccess("db.fetchUsersByUsername", `username: ${username}`, this.showLogs);
                resolve(result);
              }
            } catch (error) {
              util.handleFuncFailure("db.fetchUsersByUsername", error, `username: ${username}`, this.showLogs);
              reject(error);
            };
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.fetchUsersByUsername", error, `username: ${username}`, this.showLogs);
        reject(error);
      };
    });
  };

  // CRs Table Functions
  // ==================

  createCR(requestID, originUserID, receivingUserID, requestDate) {

    return new Promise((resolve, reject) => {
      try {
        if (requestID == null || originUserID == null || receivingUserID == null || requestDate == null) {
          throw util.funcErr("db.createCR", "missing required parameters");
        } else if (originUserID == receivingUserID) {
          throw util.funcErr("db.createCR", "originUserID and receivingUserID cannot be the same");
        } else {

          let query = `INSERT INTO CRs VALUES (?, ?, ?, ?)`;

          let values = [
            requestID,
            originUserID,
            receivingUserID,
            requestDate
          ];

          this.con.query(query, values, function (err, result) {
            try {
              if (err) {
                throw util.funcErr("db.createCR", err);
              } else if (result.affectedRows == 0) {
                throw util.funcErr("db.createCR", "failed to create CR");
              } else {
                util.handleFuncSuccess("db.createCR", `requestID: ${requestID}`, this.showLogs);
                resolve();
              };
            } catch (error) {
              util.handleFuncFailure("db.createCR", error, `requestID: ${requestID}`, this.showLogs);
              reject(error);
            }
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.createCR", error, `requestID: ${requestID}`, this.showLogs);
        reject(error);
      };
    });
  };

  fetchCRsByUserID(userID, cols = null, sortOrder = "DESC") {

    return new Promise((resolve, reject) => {
      try {
        if (userID == null) {
          throw util.funcErr("db.fetchCRsByUserID", "missing required parameters");
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

          this.con.query(query, values, function (err, result) {
            try {
              if (err) {
                throw util.funcErr("db.fetchCRsByUserID", err);
              } else {
                resolve();
              };
            } catch (error) {
              util.handleFuncFailure("db.fetchCRsByUserID", error, `userID: ${userID}`, this.showLogs);
              reject(error);
            };
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.fetchCRsByUserID", error, `userID: ${userID}`, this.showLogs);
        reject(error);
      };
    });
  };

  deleteCRsByUserID(userID) {

    return new Promise((resolve, reject) => {
      try {
        if (userID == null) {
          throw util.funcErr("db.deleteCRsByUserID", "missing required parameters");
        } else {
          let query = `
            DELETE FROM CRs
            WHERE originUserID = ? OR receivingUserID = ?;
          `;

          let values = [userID, userID];

          this.con.query(query, values, function (err, result) {
            try {
              if (err) {
                throw util.funcErr("db.deleteCRsByUserID", err);
              } else {
                util.handleFuncSuccess("db.deleteCRsByUserID", `userID: ${userID}`, this.showLogs);
                resolve();
              };
            } catch (error) {
              util.handleFuncFailure("db.deleteCRsByUserID", error, `userID: ${userID}`, this.showLogs);
              reject(error);
            }
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.deleteCRsByUserID", error, `userID: ${userID}`, this.showLogs);
        reject(error);
      };
    });
  };

  // RUChannels Table Functions
  // =========================

  createRUChannel(channelID, userID, creationDate) {

    return new Promise((resolve, reject) => {
      try {
        if (channelID == null || userID == null || creationDate == null) {
          throw util.funcErr("db.createRUChannel", "missing required parameters");
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

          this.con.query(query, values, function (err, result) {
            try {
              if (err) {
                throw util.funcErr("db.createRUChannel", err);
              } else if (result.affectedRows == 0) {
                throw util.funcErr("db.createRUChannel", "failed to create RUChannel");
              } else {
                util.handleFuncSuccess("db.createRUChannel", `channelID: ${channelID}`, this.showLogs);
                resolve();
              };
            } catch (error) {
              util.handleFuncFailure("db.createRUChannel", error, `channelID: ${channelID}`, this.showLogs);
              reject(error);
            };
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.createRUChannel", error, `channelID: ${channelID}`, this.showLogs);
        reject(error);
      };
    });
  };

  fetchRUChannelsByChannelID(channelID, userID, cols = null) {
    return new Promise((resolve, reject) => {

      try {
        if (channelID == null || userID == null) {
          throw util.funcErr("db.fetchRUChannelsByChannelID", "missing required parameters");
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

        this.con.query(query, values, function (err, result) {
          try {
            if (err) {
              throw util.funcErr("db.fetchRUChannelsByChannelID", err);
            } else {
              util.handleFuncSuccess("db.fetchRUChannelsByChannelID", `channelID: ${channelID}, userID: ${userID}`, this.showLogs);
              resolve(result);
            };
          } catch (error) {
            util.handleFuncFailure("db.fetchRUChannelsByChannelID", error, `channelID: ${channelID}, userID: ${userID}`, this.showLogs);
            reject(error);
          };
        });
      } catch (error) {
        util.handleFuncFailure("db.fetchRUChannelsByChannelID", error, `channelID: ${channelID}, userID: ${userID}`, this.showLogs);
        reject(error)
      };
    });
  };

  fetchRUChannelsbyUserID(userID, cols = null) {
    return new Promise((resolve, reject) => {

      try {
        if (userID == null) {
          throw util.funcErr("db.fetchRUChannelsbyUserID", "missing required parameters");
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

        this.con.query(query, values, function (err, result) {
          try {
            if (err) {
              throw util.funcErr("db.fetchRUChannelsbyUserID", err);
            } else {
              util.handleFuncSuccess("db.fetchRUChannelsbyUserID", `userID: ${userID}`, this.showLogs);
              resolve(result);
            };
          } catch (error) {
            util.handleFuncFailure("db.fetchRUChannelsbyUserID", error, `userID: ${userID}`, this.showLogs);
            reject(error);
          };
        });
      } catch (error) {
        util.handleFuncFailure("db.fetchRUChannelsbyUserID", error, `userID: ${userID}`, this.showLogs);
        reject(error);
      };
    });
  };

  deleteRUChannelsByUserID(userID) {
    return new Promise(async (resolve, reject) => {

      try {
        if (userID == null) {
          throw util.funcErr("db.deleteRUChannelsByUserID", "missing required parameters");
        } else {

          let channelRecords = await this.fetchRecords("RUChannels", "userID", userID, "channelID");

          if (channelRecords.length > 0) {

            let query = `
              DELETE 
              FROM RUChannels 
              WHERE channelID IN (?);
            `;

            let values = [channelRecords.map(channelRecord => channelRecord.channelID)];

            this.con.query(query, values, function (err, result) {
              try {
                if (err) {
                  throw util.funcErr("db.deleteRUChannelsByUserID", err);
                } else if (result.affectedRows == 0) {
                  throw util.funcErr("db.deleteRUChannelsByUserID", "no channels were deleted");
                } else {
                  util.handleFuncSuccess("db.deleteRUChannelsByUserID", `userID: ${userID}, deleted: ${result.affectedRows}`, this.showLogs);
                  resolve();
                }
              } catch (error) {
                util.handleFuncFailure("db.deleteRUChannelsByUserID", error, `userID: ${userID}`, this.showLogs);
                reject(error);
              };
            });
          } else {
            util.handleFuncSuccess("db.deleteRUChannelsByUserID", `userID: ${userID}, deleted: 0`, this.showLogs);
            resolve();
          };
        };
      } catch (error) {
        util.handleFuncFailure("db.deleteRUChannelsByUserID", error, `userID: ${userID}`, this.showLogs);
        reject(error);
      };
    });
  };

  // EVENTS Table Functions
  // =====================

  createEvent(eventName, datetime, originUserID, receivingUserID, packet) {

    return new Promise((resolve, reject) => {

      try {
        if (eventName == null || datetime == null || originUserID == null || receivingUserID == null) {
          throw util.funcErr("db.createEvent", "missing required parameters");
        } else {

          let query = `
            INSERT INTO EVENTS 
            (eventName, datetime, originUserID, receivingUserID, packet) 
            VALUES (?, ?, ?, ?, ?)
          `;

          let values = [
            eventName,
            datetime,
            originUserID,
            receivingUserID,
            packet
          ];

          this.con.query(query, values, function (err, result) {
            try {
              if (err) {
                throw util.funcErr("db.createEvent", err);
              } else if (result.affectedRows == 0) {
                throw util.funcErr("db.createEvent", "failed to add event");
              } else {
                util.handleFuncSuccess("db.createEvent", `eventName: ${eventName}`, this.showLogs);
                resolve();
              };
            } catch (error) {
              util.handleFuncFailure("db.createEvent", error, `eventName: ${eventName}`, this.showLogs);
              reject(error);
            };
          });
        };
      } catch (error) {
        util.handleFuncFailure("db.createEvent", error, `eventName: ${eventName}`, this.showLogs);
        reject(error);
      };
    });
  };
};

module.exports = Database;
