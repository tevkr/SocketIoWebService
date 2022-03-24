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
    var allRooms = rooms.slice();
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
}

function decUsersCount(roomId) {
    var room = findRoom(roomId);
    if (room == null) return false;
    room.usersCount--;
}

// REST API

// Main
app.get("/get-all-rooms", function (req, res) {
    res.send(getAllRooms());
});

app.get("/is-owner", function (req, res) {
    var roomId = req.body.roomId;
    var userId = req.body.userId;
    res.send(JSON.stringify(isOwner(roomId, userId)));
});

app.get("/is-password-correct", function (req, res) {
    var roomId = req.query.roomId;
    var password = req.query.password;
    console.log(rooms);
    res.send(JSON.stringify(isPasswordCorrect(roomId, password)));
});

app.get("/is-room-exists", function (req, res) {
    var roomId = req.query.roomId;
    res.send(JSON.stringify(isRoomExist(roomId)));
});

// For test

app.post("/add-room", function (req, res) {
    var name = req.body.name;
    var roomId = req.body.roomId;
    var ownerId = req.body.ownerId;
    var password = req.body.password;
    var usersCount = req.body.usersCount;
    addRoom(name, roomId, ownerId, password, usersCount);
    res.send(JSON.stringify("success"));
});

app.post("/join-room", function (req, res) {
    var roomId = req.body.roomId;
    incUsersCount(roomId);
    res.send(JSON.stringify("success"));
});

app.post("/leave-room", function (req, res) {
    var roomId = req.body.roomId;
    decUsersCount(roomId);
    res.send(JSON.stringify("success"));
});


// Sockets
const io = require("socket.io")(server, {
    cors: {
        origin: '*'
    }
});
io.on("connection", (socket) => {
    socket.on("join-room", (roomId, userId, userName) => {
        incUsersCount(roomId);
        var room = findRoom(roomId);
        if (room.ownerId == null || room.ownerId == "") room.ownerId = userId;
        socket.join(roomId);
        socket.broadcast.to(roomId).emit("user-connected", userId);
        socket.on("message", (message) => {
            io.to(roomId).emit("createMessage", message, userName);
        });
        socket.on('disconnect', function () {
            decUsersCount(roomId);
            if (isRoomEmpty(roomId)) removeRoom(roomId);
        });
    });
});

server.listen(process.env.PORT || 5000);