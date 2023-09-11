const app = require('express')();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const util = require('./utilities');

const io = new Server(server);


function startServer() {
    server.listen(3000, () => {
        util.logInfo("started server", "server.startServer", undefined, undefined, `host: localhost, port: 3000`);
    });
}

module.exports = {
    server,
    io,
    startServer,
}