const app = require('express')();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server);

function startServer() {
    server.listen(3000, () => {
        logger.info(funcS("startServer", "Server listening on localhost, port 3000"));
    });
}

module.exports = {
    server,
    io,
    startServer,
}