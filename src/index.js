const { server, io, startServer } = require('./server');
require('./events');
const db = require('./db');


db.connectDB();

startServer();