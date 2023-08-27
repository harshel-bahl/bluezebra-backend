const { server, io } = require('./server');

// const privateKey = fs.readFileSync('path_to/privkey.pem', 'utf8');
// const certificate = fs.readFileSync('path_to/fullchain.pem', 'utf8');
// const ca = fs.readFileSync('path_to/chain.pem', 'utf8');

// const credentials = {
// key: privateKey,
// cert: certificate,
// ca: ca
// };
// const server = https.createServer(credentials, app);

// add JWT middleware to io

// connectedUsers
// - userID: { socketID }
let connectedUsers = {};


function connectUser(
    socket,
    UID
) {
    socket.userdata.UID = UID;
    socket.userdata.connected = true;

    connectedUsers[UID] = {
        socketID: socket.id
    };
};

function disconnectUser(
    socket,
    UID
) {
    delete connectedUsers[UID];
    socket.userdata.connected = false;
    socket.userdata.userID = null;
};

module.exports = {
    connectedUsers,
    connectUser,
    disconnectUser,
}