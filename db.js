var mysql = require('mysql');

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
    var sql1 = `CREATE TABLE IF NOT EXISTS users (
      userID VARCHAR(255) NOT NULL CHECK (userID <> ''),
      username VARCHAR(255) NOT NULL CHECK (username <> ''), 
      avatar VARCHAR(50) NOT NULL,
      creationDate DATETIME NOT NULL, 
      lastOnline DATETIME,
      PRIMARY KEY (userID),
      UNIQUE (userID),
      UNIQUE (username)
    );`;

    var sql2 = `CREATE TABLE IF NOT EXISTS events (
    eventID INT AUTO_INCREMENT PRIMARY KEY,
    eventName VARCHAR(255) NOT NULL,
    datetime DATETIME(3) NOT NULL,
    userID VARCHAR(255) NOT NULL CHECK (userID <> ''),
    packet BLOB
    )`;

    this.con.query(sql1, function (err, result) {
      if (err) throw err;
      console.log("SUCCESS: Created 'users' table if not present");
    });

    this.con.query(sql2, function (err, result) {
      if (err) throw err;
      console.log("SUCCESS: Created 'events' table if not present");
    });
  };

  checkUsername(username) {
    return new Promise((resolve, reject) => {
      this.con.query('SELECT userID FROM users WHERE username=?', [username], function (err, result) {
        if (err) throw new Error("db.checkUsername: " + err);

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
      this.con.query('SELECT userID FROM users WHERE userID=?', [userID], function (err, result) {
        if (err) throw new Error("db.checkUserID: " + err);

        if (result.length == 0) {
          resolve(false);
        } else if (result.length > 0) {
          resolve(true);
        };
      });
    });
  };

  createUser(userID, username, avatar, creationDate) {

    let values = [
      userID,
      username,
      avatar,
      creationDate,
      null
    ];

    return new Promise((resolve, reject) => {
      this.con.query(`INSERT INTO users VALUES (?, ?, ?, ?, ?)`, values, function (err, result) {
        if (err) throw new Error("db.createUser: " + err);

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
      this.con.query(`DELETE FROM users WHERE userID=?`, [userID], function (err, result) {
        if (err) throw new Error("db.deleteUser: " + err);

        if (result.affectedRows != 0) {
          resolve();
        } else {
          reject("db.deleteUser: failed to delete user");
        };
      });
    });
  };

  fetchUserByUserID(userID) {
    return new Promise((resolve, reject) => {
      this.con.query(`SELECT * FROM users WHERE userID=?`, [userID], function (err, result) {
        if (err) throw new Error("db.fetchUserbyUserID: " + err);

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
      (SELECT * FROM Users WHERE username = ?)
      UNION ALL
      (SELECT * FROM Users WHERE username LIKE ? AND username != ? ORDER BY username LIMIT 10)
      ORDER BY CASE WHEN username = ? THEN 0 ELSE 1 END, username
      LIMIT 10;
    `, [username, username + '%', username, username], function (err, result) {
        if (err) throw new Error("db.fetchUsersByUsername: " + err);

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
      this.con.query(`UPDATE users SET lastOnline=? WHERE userID=?`, [date, userID], function (err, result) {
        if (err) throw new Error("db.updateLastOnline: " + err);
        resolve();
      });
    });
  };

  fetchUserLastOnline(userID) {
    return new Promise((resolve, reject) => {
      this.con.query('SELECT lastOnline from users WHERE userID=?', [userID], function (err, result) {
        if (err) throw new Error("db.fetchUserLastOnline: " + err);

        if (result.length != 0 && result.length == 1) {
          resolve(result[0].lastOnline)
        };
      });
    });
  };

  addEvent(eventName, datetime, userID, packet) {

    let values = [eventName, datetime, userID, packet];

    return new Promise((resolve, reject) => {
      this.con.query(`
      INSERT INTO events 
      (eventName, datetime, userID, packet) 
      VALUES (?, ?, ?, ?)`,
        values, function (err, result) {

          if (err) throw new Error("db.addEvent: " + err);

          if (result.affectedRows != 0) {
            resolve(null);
          } else {
            reject("db.addEvent: failed to add event");
          };
        });
    });
  };

  fetchEventsByUserID(userID) {
    return new Promise((resolve, reject) => {

      let sql = `SELECT * FROM events WHERE userID=? ORDER BY datetime DESC`;

      this.con.query(sql, [userID], function (err, result) {
        if (err) throw err;

        let events = [];
        for (let i = 0; i < result.length; i++) {
          events.push({
            eventID: result[i].eventID,
            eventName: result[i].eventName,
            packet: result[i].packet
          });
        };

        resolve(events);
      });
    });
  };

  deleteEvent(eventID) {
    return new Promise((resolve, reject) => {
      this.con.query(`DELETE FROM users WHERE userID=?`, [userID], function (err, result) {
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
