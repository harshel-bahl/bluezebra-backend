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

    this.createTables()
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
      channelID VARCHAR(255) NOT NULL CHECK (channelID <> ''),
      userID VARCHAR(255) NOT NULL CHECK (userID <> ''),
      requestDate DATETIME NOT NULL,
      PRIMARY KEY (requestID, userID)
    );`

    var sql3 = `CREATE TABLE IF NOT EXISTS RUChannels (
      channelID VARCHAR(255) NOT NULL CHECK (channelID <> ''),
      userID VARCHAR(255) NOT NULL CHECK (userID <> ''),
      creationDate DATETIME NOT NULL,
      PRIMARY KEY (channelID, userID),
    );`

    var sql4 = `CREATE TABLE IF NOT EXISTS EVENTS (
      eventID INT AUTO_INCREMENT PRIMARY KEY,
      eventName VARCHAR(255) NOT NULL,
      datetime DATETIME(3) NOT NULL,
      originUserID VARCHAR(255) NOT NULL CHECK (originUserID <> ''),
      receivingUserID VARCHAR(255) NOT NULL CHECK (receivingUserID <> ''),
      packet BLOB,
      PRIMARY KEY (eventID)
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
    cols = "*",
    errorOnMultiple = false) {

    let query = `
      SELECT ? 
      FROM ?
      WHERE ? = ? ${"AND ? = ?" * (predProp2 !== null && predValue2 !== null)}
    `;

    let values = [cols, table, predProp1, predValue1, predProp2, predValue2];

    if (predProp2 !== null && predValue2 !== null) {
      values.push(predProp2);
      values.push(predValue2);
    };

    return new Promise((resolve, reject) => {
      this.con.query(query, values, function (err, result, fields) {
        if (err) {
          reject(new Error(`db.fetchRecord - table: ${table}, predProp1: ${predProp1}, predValue1: ${predValue1}, err: ${err}`));
        } else if (result.length == 0) {
          reject(new Error(`db.fetchRecord - table: ${table}, predProp1: ${predProp1}, predValue1: ${predValue1}, err: no results`));
        } else if (result.length > 1 && errorOnMultiple) {
          reject(new Error(`db.fetchRecord - table: ${table}, predProp1: ${predProp1}, predValue1: ${predValue1}, err: multiple results`));
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
    cols = "*",
    limit = null,
    sortColumn = null,
    sortOrder = "DESC",
    failOnEmpty = false) {

    let query = `
      SELECT ? 
      FROM ?
      WHERE ? = ?
      ${sortColumn !== null ? `ORDER BY ? ?` : ""}
      ${limit !== null ? `LIMIT ?` : ""}
    `;

    let values = [cols, table, predProp, predValue];

    if (sortColumn !== null) {
      values.push(sortColumn);
      values.push(sortOrder);
    };

    if (limit !== null) {
      values.push(limit);
    };

    return new Promise((resolve, reject) => {
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

    let query = `
    UPDATE ?
    SET ? = ?
    WHERE ? = ? ${"AND ? = ?" * (predProp2 !== null && predValue2 !== null)}
    `;

    let values = [table, updateProp, updateValue, predProp1, predValue1];

    if (predProp2 !== null && predValue2 !== null) {
      values.push(predProp2);
      values.push(predValue2);
    };

    return new Promise((resolve, reject) => {
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

    let query = `
    UPDATE ?
    SET ? = ?
    WHERE ? = ?
    `;

    let values = [table, updateProp, updateValue, predProp, predValue];

    return new Promise((resolve, reject) => {
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

    let query = `
    DELETE
    FROM ?
    WHERE ? = ? ${"AND ? = ?" * (predProp2 !== null && predValue2 !== null)}
    `;

    let values = [table, predProp1, predValue1];

    if (predProp2 !== null && predValue2 !== null) {
      values.push(predProp2);
      values.push(predValue2);
    };

    return new Promise((resolve, reject) => {
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

    let query = `
    DELETE
    FROM ?
    WHERE ? = ?
    `;

    let values = [table, predProp, predValue];

    return new Promise((resolve, reject) => {
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

    let values = [
      userID,
      username,
      avatar,
      creationDate,
      null
    ];

    return new Promise((resolve, reject) => {
      this.con.query(`INSERT INTO USERS VALUES (?, ?, ?, ?, ?)`, values, function (err, result) {

        if (err) {
          reject(new Error("db.createUser: " + err.message))
        } else if (result.affectedRows == 0) {
          reject("db.createUser: failed to create user");
        } else {
          resolve();
        };
      });
    });
  };

  fetchUsersByUsername(username, limit = 10) {
    return new Promise((resolve, reject) => {
      this.con.query(`
      (SELECT * FROM USERS WHERE username = ?)
      UNION ALL
      (SELECT * FROM USERS WHERE username LIKE ? AND username != ? ORDER BY username LIMIT 10)
      ORDER BY CASE WHEN username = ? THEN 0 ELSE 1 END, username
      LIMIT ?;
    `, [username, username + '%', username, username, limit], function (err, result) {

        if (err) {
          reject(new Error("db.fetchUsersByUsername: " + err))
        } else {
          resolve(result);
        }

        // let users = [];
        // for (let i = 0; i < result.length; i++) {
        //   users.push({
        //     userID: result[i].userID,
        //     username: result[i].username,
        //     avatar: result[i].avatar,
        //     creationDate: result[i].creationDate
        //   });
        // };
      });
    });
  };

  checkUsername(username) {
    return new Promise((resolve, reject) => {
      this.con.query('SELECT userID FROM USERS WHERE username=?', [username], function (err, result) {

        if (err) reject(new Error("db.checkUsername: " + err.message));

        if (result.length == 0) {
          resolve(true);
        } else if (result.length > 0) {
          resolve(false);
        };
      });
    });
  };

  checkUserID(userID) {
    return new Promise((resolve, reject) => {
      this.con.query('SELECT userID FROM USERS WHERE userID=?', [userID], function (err, result) {

        if (err) reject(new Error("db.checkUserID: " + err.message));

        if (result.length == 0) {
          resolve(false);
        } else if (result.length > 0) {
          resolve(true);
        };
      });
    });
  };

  // fetchUserByUserID(userID) {
  //   return new Promise((resolve, reject) => {
  //     this.con.query(`SELECT * FROM USERS WHERE userID=?`, [userID], function (err, result) {

  //       if (err) reject(new Error("db.fetchUserbyUserID: " + err));

  //       if (result.length == 0) {
  //         reject("db.fetchUserbyUserID: user not found");
  //       } else {
  //         resolve({
  //           userID: result[0].userID,
  //           username: result[0].username,
  //           avatar: result[0].avatar,
  //           creationDate: result[0].creationDate
  //         });
  //       }
  //     });
  //   });
  // };



  // updateLastOnline(userID, date) {
  //   return new Promise((resolve, reject) => {
  //     this.con.query(`UPDATE USERS SET lastOnline=? WHERE userID=?`, [date, userID], function (err, result) {

  //       if (err) reject(new Error("db.updateLastOnline: " + err));

  //       resolve();
  //     });
  //   });
  // };

  // fetchUserLastOnline(userID) {
  //   return new Promise((resolve, reject) => {
  //     this.con.query('SELECT lastOnline from USERS WHERE userID=?', [userID], function (err, result) {

  //       if (err) reject(new Error("db.fetchUserLastOnline: " + err));

  //       if (result.length != 0 && result.length == 1) {
  //         resolve(result[0].lastOnline)
  //       };
  //     });
  //   });
  // };

  // CRs Table Functions
  // ==================

  createCR(requestID, channelID, userID, requestDate) {

    let values = [
      requestID,
      channelID,
      userID,
      requestDate
    ];

    return new Promise((resolve, reject) => {
      this.con.query(`INSERT INTO CRs VALUES (?, ?, ?, ?)`, values, function (err, result) {

        if (err) {
          reject(new Error("db.createCR: " + err.message));
        } else if (result.affectedRows == 0) {
          reject("db.createCR: failed to create CR");
        } else {
          resolve();
        };
      });
    });
  };

  // RUChannels Table Functions
  // =========================

  createRUChannel(channelID, userID, creationDate) {

    let query = `INSERT INTO RUChannels VALUES (?, ?, ?)`
    let values = [
      channelID,
      userID,
      creationDate
    ];

    return new Promise((resolve, reject) => {
      this.con.query(query, values, function (err, result) {

        if (err) {
          reject(new Error("db.createRUChannel: " + err.message));
        } else if (result.affectedRows == 0) {
          reject("db.createRUChannel: failed to create CR");
        } else {
          resolve();
        };
      });
    });
  };

  // EVENTS Table Functions
  // =====================

  createEvent(eventName, datetime, originUserID, receivingUserID, packet) {

    let query = `
    INSERT INTO EVENTS 
    (eventName, datetime, originUserID, receivingUserID, packet) 
    VALUES (?, ?, ?, ?, ?)
    `;

    let values = [eventName, datetime, originUserID, receivingUserID, packet];

    return new Promise((resolve, reject) => {
      this.con.query(query, values, function (err, result) {

        if (err) {
          reject(new Error("db.addEvent: " + err));
        } else if (result.affectedRows == 0) {
          reject("db.addEvent: failed to add event");
        } else {
          resolve();
        };
      });
    });
  };

  // fetchEventsByUserID(receivingUserID) {
  //   return new Promise((resolve, reject) => {

  //     let sql = `SELECT * FROM EVENTS WHERE receivingUserID=? ORDER BY datetime DESC`;

  //     this.con.query(sql, [receivingUserID], function (err, result) {
  //       if (err) throw err;

  //       let events = [];
  //       for (let i = 0; i < result.length; i++) {
  //         events.push({
  //           eventID: result[i].eventID,
  //           eventName: result[i].eventName,
  //           datetime: result[i].datetime,
  //           originUserID: result[i].originUserID,
  //           receivingUserID: result[i].receivingUserID,
  //           attempts: result[i].attempts,
  //           packet: result[i].packet
  //         });
  //       };

  //       resolve(events);
  //     });
  //   });
  // };

  // deleteEvent(eventID) {
  //   return new Promise((resolve, reject) => {
  //     this.con.query(`DELETE FROM EVENTS WHERE eventID=?`, [eventID], function (err, result) {
  //       if (err) throw err;

  //       if (result.affectedRows != 0) {
  //         resolve(true);
  //       } else {
  //         reject(false);
  //       };
  //     });
  //   });
  // };
};

module.exports = new Database();
