const express = require("express");
const cors = require('cors');
const app = express();

app.use(
    express.urlencoded({
        extended: true
    })
)

app.use(express.json())

app.use(cors({
    origin: '*'
}));
const server = require("http").Server(app);

// Database
// {name, roomId, ownerId, password, usersCount}
var rooms = [];

function getAllRooms() {
    var allRooms = JSON.parse(JSON.stringify(rooms));
    allRooms.forEach((element, index) => {
        allRooms[index].password = (element.password != null && element.password != "");
        delete allRooms[index].ownerId;
    });
    return allRooms;
}

function findRoom(roomId) {
    return rooms.find(room => room.roomId === roomId);
}

function addRoom(name, roomId, ownerId, password, usersCount) {
    rooms.push({ name: name, roomId: roomId, ownerId: ownerId, password: password, usersCount: usersCount });
}

function removeRoom(roomId) {
    rooms = rooms.filter(function (room, index, arr) {
        return room.roomId != roomId;
    });
}

function isRoomExist(roomId) {
    return findRoom(roomId) != null;
}

function isRoomEmpty(roomId) {
    return findRoom(roomId).usersCount <= 0;
}

function isOwner(roomId, userId) {
    var room = findRoom(roomId);
    if (room == null) return false;
    return room.ownerId == userId;
}

function hasOwner(roomId) {
    var room = findRoom(roomId);
    if (room == null) return false;
    return room.ownerId != null && room.ownerId != "";
}

function setOwner(roomId, ownerId) {
    var room = findRoom(roomId);
    if (room == null) return false;
    room.ownerId = ownerId;
    return true;
}

function isRoomHavePassword(roomId) {
    var room = findRoom(roomId);
    if (room == null) return false;
    return room.password != null && room.password != "";
}

function isPasswordCorrect(roomId, password) {
    var room = findRoom(roomId);
    if (room == null) return false;
    return room.password == password || room.password == "" || room.password == null;
}

function incUsersCount(roomId) {
    var room = findRoom(roomId);
    if (room == null) return false;
    room.usersCount++;
    return true;
}

function decUsersCount(roomId) {
    var room = findRoom(roomId);
    if (room == null) return false;
    room.usersCount--;
    return true;
}

// REST API

app.get("/get-all-rooms", function (req, res) {
    res.send(getAllRooms());
});

app.post("/add-room", function (req, res) {
    var name = req.body.name;
    var roomId = req.body.roomId;
    var ownerId = req.body.ownerId;
    var password = req.body.password;
    var usersCount = req.body.usersCount;
    addRoom(name, roomId, ownerId, password, usersCount);
    res.send(JSON.stringify("success"));
});

app.get("/has-owner", function (req, res) {
    var roomId = req.body.roomId;
    res.send(JSON.stringify(hasOwner(roomId)));
});

app.post("/set-owner", function (req, res) {
    var roomId = req.body.roomId;
    var ownerId = req.body.ownerId;
    setOwner(roomId, ownerId);
    res.send(JSON.stringify("success"));
});

app.get("/is-password-correct", function (req, res) {
    var roomId = req.query.roomId;
    var password = req.query.password;
    res.send(JSON.stringify(isPasswordCorrect(roomId, password)));
});

app.get("/is-room-exists", function (req, res) {
    var roomId = req.query.roomId;
    res.send(JSON.stringify(isRoomExist(roomId)));
});

// Sockets
const io = require("socket.io")(server, {
    cors: {
        origin: '*'
    }
});
io.on("connection", (socket) => {
    socket.on("join-room", (roomId, peerId, username) => {
        incUsersCount(roomId);
        socket.join(roomId);
        socket.on('ready', () => {
            socket.broadcast.to(roomId).emit("user-connected", peerId);
        });
        socket.on("message", (message) => {
            io.to(roomId).emit("createMessage", message, username);
        });
        socket.on('disconnect', function () {
            decUsersCount(roomId);
            if (isRoomEmpty(roomId)) removeRoom(roomId);
            socket.broadcast.to(roomId).emit("user-disconnected", peerId);
        });
    });
});

server.listen(process.env.PORT || 5000);