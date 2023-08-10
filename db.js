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

        if (err) reject(new Error("db.createUser: " + err));

        if (result.affectedRows != 0) {
          resolve(null);
        } else {
          reject("db.createUser: failed to create user");
        };
      });
    });
  };

  deleteUser(userID) {
    return new Promise((resolve, reject) => {
      this.con.query(`DELETE FROM USERS WHERE userID=?`, [userID], function (err, result) {

        if (err) reject(new Error("db.deleteUser: " + err));

        if (result.affectedRows != 0) {
          resolve();
        } else {
          reject("db.deleteUser: failed to delete user");
        };
      });
    });
  };

  checkUsername(username) {
    return new Promise((resolve, reject) => {
      this.con.query('SELECT userID FROM USERS WHERE username=?', [username], function (err, result) {

        if (err) reject(new Error("db.checkUsername: " + err));

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

        if (err) reject(new Error("db.checkUserID: " + err));

        if (result.length == 0) {
          resolve(false);
        } else if (result.length > 0) {
          resolve(true);
        };
      });
    });
  };

  fetchUserByUserID(userID) {
    return new Promise((resolve, reject) => {
      this.con.query(`SELECT * FROM USERS WHERE userID=?`, [userID], function (err, result) {

        if (err) reject(new Error("db.fetchUserbyUserID: " + err));

        if (result.length == 0) {
          reject("db.fetchUserbyUserID: user not found");
        } else {
          resolve({
            userID: result[0].userID,
            username: result[0].username,
            avatar: result[0].avatar,
            creationDate: result[0].creationDate
          });
        }
      });
    });
  };

  fetchUsersByUsername(username) {
    return new Promise((resolve, reject) => {
      this.con.query(`
      (SELECT * FROM USERS WHERE username = ?)
      UNION ALL
      (SELECT * FROM USERS WHERE username LIKE ? AND username != ? ORDER BY username LIMIT 10)
      ORDER BY CASE WHEN username = ? THEN 0 ELSE 1 END, username
      LIMIT 10;
    `, [username, username + '%', username, username], function (err, result) {

        if (err) reject(new Error("db.fetchUsersByUsername: " + err));

        let users = [];
        for (let i = 0; i < result.length; i++) {
          users.push({
            userID: result[i].userID,
            username: result[i].username,
            avatar: result[i].avatar,
            creationDate: result[i].creationDate
          });
        };

        resolve(users);
      });
    });
  };

  updateLastOnline(userID, date) {
    return new Promise((resolve, reject) => {
      this.con.query(`UPDATE USERS SET lastOnline=? WHERE userID=?`, [date, userID], function (err, result) {

        if (err) reject(new Error("db.updateLastOnline: " + err));

        resolve();
      });
    });
  };

  fetchUserLastOnline(userID) {
    return new Promise((resolve, reject) => {
      this.con.query('SELECT lastOnline from USERS WHERE userID=?', [userID], function (err, result) {

        if (err) reject(new Error("db.fetchUserLastOnline: " + err));

        if (result.length != 0 && result.length == 1) {
          resolve(result[0].lastOnline)
        };
      });
    });
  };

  // CRs Table Functions
  // ==================

  // Creation Functions
  createCR(requestID, channelID, userID, requestDate) {

    let values = [
      requestID,
      channelID,
      userID,
      requestDate
    ];

    return new Promise((resolve, reject) => {
      this.con.query(`INSERT INTO USERS VALUES (?, ?, ?, ?)`, values, function (err, result) {

        if (err) reject(new Error("db.createCR: " + err));

        if (result.affectedRows != 0) {
          resolve(null);
        } else {
          reject("db.createCR: failed to create CR");
        };
      });
    });
  };

  // Fetch Functions

  fetchRecord(table, predProp, predValue, cols = "*") {

  };

  fetchRecords(table, predProp, predValue, cols = "*", limit = null, sortColumn = null, sortOrder = "DESC") {

    let query = `
      SELECT ? 
      FROM ?
      WHERE ? = ?
      ${sortColumn !== null ? `ORDER BY ${sortColumn} ${sortOrder}` : ""}
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
          reject(new Error(`db.fetchRecord - table: ${table}, predProp: ${predProp}, predValue: ${predValue}, err: ${err.message}`));
        } else {
          resolve(result);
        };
      });
    });
  };


  fetchCRbyRequestID(predicateProp, predicateValue, cols = "*") {
    return new Promise((resolve, reject) => {
      this.con.query(`SELECT ${cols} FROM CRs WHERE ${predicateProp}=?`, [predicateValue], function (err, result) {

        if (err) reject(new Error("db.fetchCRbyRequestID: " + err));

        if (result.length == 0) {
          reject("db.fetchCRbyRequestID: CR not found");
        } else {
          resolve(result[0]);
        }
      });
    });
  }
};

// Delete Functions
deleteCRbyRequestID(requestID, returnEntries = false) {
  return new Promise((resolve, reject) => {
    this.con.query(`DELETE FROM CRs WHERE requestID=?`, [requestID], function (err, result) {

      if (err) reject(new Error("db.deleteCRbyRequestID: " + err));

      if (result.affectedRows != 0) {
        resolve(returnEntries ? `affectedEntries: ${result.affectedRows}` : void 0);
      } else {
        reject("db.deleteCRbyRequestID: failed to delete user");
      };
    });
  });
};

deleteCRbyChannelID(channelID, returnEntries = false) {
  return new Promise((resolve, reject) => {
    this.con.query(`DELETE FROM CRs WHERE channelID=?`, [channelID], function (err, result) {

      if (err) reject(new Error("db.deleteCRbyChannelID: " + err));

      if (result.affectedRows != 0) {
        resolve(returnEntries ? `affectedEntries: ${result.affectedRows}` : void 0);
      } else {
        reject("db.deleteCRbyChannelID: failed to delete user");
      };
    });
  });
};

deleteCRbyUserID(userID, returnEntries = false) {
  return new Promise((resolve, reject) => {
    this.con.query(`DELETE FROM CRs WHERE userID=?`, [userID], function (err, result) {

      if (err) reject(new Error("db.deleteCRbyUserID: " + err));

      if (result.affectedRows != 0) {
        resolve(returnEntries ? `affectedEntries: ${result.affectedRows}` : void 0);
      } else {
        reject("db.deleteCRbyUserID: failed to delete user");
      };
    });
  });
};

// RUChannels Table Functions
// =========================

// EVENTS Table Functions
// =====================

addEvent(eventName, datetime, originUserID, receivingUserID, packet) {

  let values = [eventName, datetime, originUserID, receivingUserID, 0, packet];

  return new Promise((resolve, reject) => {
    this.con.query(`
      INSERT INTO events 
      (eventName, datetime, originUserID, receivingUserID, attempts, packet) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      values, function (err, result) {

        if (err) reject(new Error("db.addEvent: " + err));

        if (result.affectedRows != 0) {
          resolve(null);
        } else {
          reject("db.addEvent: failed to add event");
        };
      });
  });
};

fetchEventsByUserID(receivingUserID) {
  return new Promise((resolve, reject) => {

    let sql = `SELECT * FROM EVENTS WHERE receivingUserID=? ORDER BY datetime DESC`;

    this.con.query(sql, [receivingUserID], function (err, result) {
      if (err) throw err;

      let events = [];
      for (let i = 0; i < result.length; i++) {
        events.push({
          eventID: result[i].eventID,
          eventName: result[i].eventName,
          datetime: result[i].datetime,
          originUserID: result[i].originUserID,
          receivingUserID: result[i].receivingUserID,
          attempts: result[i].attempts,
          packet: result[i].packet
        });
      };

      resolve(events);
    });
  });
};

deleteEvent(eventID) {
  return new Promise((resolve, reject) => {
    this.con.query(`DELETE FROM EVENTS WHERE eventID=?`, [eventID], function (err, result) {
      if (err) throw err;

      if (result.affectedRows != 0) {
        resolve(true);
      } else {
        reject(false);
      };
    });
  });
};
};

module.exports = new Database();
