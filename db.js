var mysql = require('mysql');
const util = require('./utilities');

class Database {

  constructor() {
    this.con = mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "Smashers1!",
      database: "bluezebra",
      // socketPath: "/var/run/mysqld/mysqld.sock"
    });
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
      util.handleSuccess("db.createTables", "Created 'users' table if not present");
    });

    this.con.query(sql2, function (err, result) {
      if (err) throw err;
      util.handleSuccess("db.createTables", "Created 'CRs' table if not present");
    });

    this.con.query(sql3, function (err, result) {
      if (err) throw err;
      util.handleSuccess("db.createTables", "Created 'RUChannels' table if not present");
    });

    this.con.query(sql4, function (err, result) {
      if (err) throw err;
      util.handleSuccess("db.createTables", "Created 'events' table if not present");
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
    errorOnMultiple = false) {

    return new Promise((resolve, reject) => {
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
        if (err) {
          reject(new Error(`db.fetchRecord - err: ${err}`));
        } else if (result.length == 0) {
          reject(new Error(`db.fetchRecord - err: no results`));
        } else if (result.length > 1 && errorOnMultiple) {
          reject(new Error(`db.fetchRecord - err: multiple results`));
        } else {
          resolve(result[0]);
        };
      });
    });
  };

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
        if (err) {
          reject(new Error(`db.fetchRecords - table: ${table}, predProp: ${predProp}, predValue: ${predValue}, err: ${err.message}`));
        } else if (result.length == 0 && failOnEmpty) {
          reject(new Error(`db.fetchRecords - table: ${table}, predProp: ${predProp}, predValue: ${predValue}, err: No records found`));
        } else {
          resolve(result);
        };
      });
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
        if (err) {
          reject(new Error(`db.updateRecord - table: ${table}, updateProp: ${updateProp}, updateValue: ${updateValue}, err: ${err.message}`));
        } else if (result.affectedRows == 0) {
          reject(new Error(`db.updateRecord - table: ${table}, updateProp: ${updateProp}, updateValue: ${updateValue}, err: No records found`));
        } else if (result.affectedRows == 1 && result.changedRows == 0) {
          reject(new Error(`db.updateRecord - table: ${table}, updateProp: ${updateProp}, updateValue: ${updateValue}, err: No changes made`));
        } else {
          resolve();
        };
      });
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
    returnUpdatedCount = true,
    failOnEmpty = false) {

    return new Promise((resolve, reject) => {
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
        if (err) {
          reject(new Error(`db.updateRecords - table: ${table}, predProp: ${predProp}, predValue: ${predValue}, err: ${err.message}`));
        } else if (result.affectedRows == 0 && failOnEmpty) {
          reject(new Error(`db.updateRecords - table: ${table}, predProp: ${predProp}, predValue: ${predValue}, err: No records found`));
        } else {
          resolve(returnUpdatedCount ? result.affectedRows : void 0);
        };
      });
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
        if (err) {
          reject(new Error(`db.deleteRecord - table: ${table}, predProp1: ${predProp1}, predValue1: ${predValue1}, err: ${err.message}`));
        } else if (result.affectedRows == 0) {
          reject(new Error(`db.deleteRecord - table: ${table}, predProp1: ${predProp1}, predValue1: ${predValue1}, err: No records found`));
        } else {
          resolve();
        };
      });
    });
  };

  // deleteRecords
  // 
  deleteRecords(
    table,
    predProp,
    predValue,
    returnDeletionCount = true,
    failOnEmpty = false) {

    return new Promise((resolve, reject) => {
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
        if (err) {
          reject(new Error(`db.deleteRecords - table: ${table}, predProp: ${predProp}, predValue: ${predValue}, err: ${err.message}`));
        } else if (result.affectedRows == 0 && failOnEmpty) {
          reject(new Error(`db.deleteRecords - table: ${table}, predProp: ${predProp}, predValue: ${predValue}, err: No records found`));
        } else {
          resolve(returnDeletionCount ? result.affectedRows : void 0);
        };
      });
    });
  };

  // USERS Table Functions
  // =====================

  createUser(userID, username, avatar, creationDate) {

    return new Promise((resolve, reject) => {
      let query = `INSERT INTO USERS VALUES (?, ?, ?, ?, ?)`;

      let values = [
        userID,
        username,
        avatar,
        creationDate,
        null
      ];

      this.con.query(query, values, function (err, result) {

        if (err) {
          reject(new Error("db.createUser: " + err.message));
        } else if (result.affectedRows == 0) {
          reject(new Error("db.createUser: failed to create user"));
        } else {
          resolve();
        };
      });
    });
  };

  fetchUsersByUsername(username, limit = 10) {

    return new Promise((resolve, reject) => {
      let query = `
    (SELECT * FROM USERS WHERE username = ?)
    UNION ALL
    (SELECT * FROM USERS WHERE username LIKE ? AND username != ? ORDER BY username LIMIT 10)
    ORDER BY CASE WHEN username = ? THEN 0 ELSE 1 END, username
    LIMIT ?;
    `;

      let values = [username, username + '%', username, username, limit];

      this.con.query(query, values, function (err, result) {
        if (err) {
          reject(new Error("db.fetchUsersByUsername: " + err));
        } else {
          resolve(result);
        }
      });
    });
  };

  // CRs Table Functions
  // ==================

  createCR(requestID, originUserID, receivingUserID, requestDate) {

    return new Promise((resolve, reject) => {
      let query = `INSERT INTO CRs VALUES (?, ?, ?, ?)`;

      let values = [
        requestID,
        originUserID,
        receivingUserID,
        requestDate
      ];

      this.con.query(query, values, function (err, result) {
        if (err) {
          reject(new Error("db.createCR: " + err.message));
        } else if (result.affectedRows == 0) {
          reject(new Error("db.createCR: failed to create CR"));
        } else {
          resolve();
        };
      });
    });
  };

  fetchCRsByUserID(userID, cols = null, sortOrder = "DESC") {

    return new Promise((resolve, reject) => {
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
        if (err) {
          reject(new Error("db.fetchCRsByUserID: " + err.message));
        } else {
          resolve();
        };
      });
    });
  };

  deleteCRsByUserID(userID) {

    return new Promise((resolve, reject) => {
      let query = `
    DELETE FROM CRs
    WHERE originUserID = ? OR receivingUserID = ?;
    `;

      let values = [userID, userID];

      this.con.query(query, values, function (err, result) {
        if (err) {
          reject(new Error("db.deleteCRsByUserID: " + err.message));
        } else {
          resolve();
        };
      });
    });
  };

  // RUChannels Table Functions
  // =========================

  createRUChannel(channelID, userID, creationDate) {

    return new Promise((resolve, reject) => {
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
        if (err) {
          reject(new Error("db.createRUChannel: " + err.message));
        } else if (result.affectedRows == 0) {
          reject(new Error("db.createRUChannel: failed to create CR"));
        } else {
          resolve();
        };
      });
    });
  };

  fetchRUChannelsbyUserID(userID, cols = null) {
    return new Promise((resolve, reject) => {
  
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
      WHERE userID != ?
      AND channelID IN (
        SELECT channelID
        FROM RUChannels
        WHERE userID = ?
      );`;
  
      let values = [userID, userID];
  
      this.con.query(query, values, function (err, result) {
        if (err) {
          reject(new Error("db.fetchRUChannelsbyUserID: " + err.message));
        } else {
          resolve(result);
        };
      });
    });
  };
  

  deleteRUChannelsByUserID(userID) {
    return new Promise(async (resolve, reject) => {
      try {
        let channelRecords = await this.fetchRecords("RUChannels", "userID", userID, "channelID");
        
        if (channelRecords.length > 0) {
          let query = `
          DELETE 
          FROM RUChannels 
          WHERE channelID IN (?);
          `;
          
          let values = [channelRecords.map(channelRecord => channelRecord.channelID)];
          
          this.con.query(query, values, function (err, result) {
            if (err) {
              reject(new Error("db.deleteRUChannelsByUserID: " + err.message));
            } else if (result.affectedRows == 0) {
              reject(new Error("db.deleteRUChannelsByUserID: No channels were deleted"));
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // EVENTS Table Functions
  // =====================

  createEvent(eventName, datetime, originUserID, receivingUserID, packet) {

    return new Promise((resolve, reject) => {
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

        if (err) {
          reject(new Error("db.createEvent: " + err));
        } else if (result.affectedRows == 0) {
          reject(new Error("db.createEvent: failed to add event"));
        } else {
          resolve();
        };
      });
    });
  };
};

module.exports = new Database();
