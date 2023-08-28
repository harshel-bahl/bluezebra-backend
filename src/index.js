const { startServer } = require('./server');
const db = require('./db');
const util = require('./utilities');

async function startup() {

    util.logInfo("starting server...", "index.startup");

    await db.connectDB();

    require('./events');

    startServer();  
}

startup();