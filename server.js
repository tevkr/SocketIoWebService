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

// {roomId, userId, peerId, micMuted, camOffed}
users = [];
function addUser(roomId, userId, peerId) {
    users.push({ roomId: roomId, userId: userId, peerId: peerId, micMuted: false, camOffed: false });
    return true;
}

function findUser(roomId, userId) {
    return users.find(user => user.userId == userId && user.roomId == roomId);
}

function findUserByPeerIdAndRoomId(roomId, peerId) {
    return users.find(user => user.peerId == peerId && user.roomId == roomId);
}

function removeUser(roomId, userId) {
    var user = findUser(roomId, userId);
    if (user.micMuted == false && user.camOffed == false) {
        users = users.filter(function (user, index, arr) {
            return user.userId != userId && user.roomId != roomId;
        });
        return true;
    }
    return false;
}

function userExists(roomId, userId) {
    var user = findUser(roomId, userId);
    return user != null;
}

function updatePeerIdOfUser(roomId, userId, newPeerId) {
    var user = findUser(roomId, userId);
    if (user == null)
        return false;
    user.peerId = newPeerId;
    return true;
}

function getPeerIdByUserIdAndRoomId(roomId, userId) {
    var user = findUser(roomId, userId);
    if (user == null)
        return null;
    return user.peerId;
}

function removeUsersByRoom(roomId) {
    users = users.filter(function (user, index, arr) {
        return user.roomId != roomId;
    });
    return true;
}

function switchCamOffedState(roomId, userId) {
    var user = findUser(roomId, userId);
    if (user == null)
        return false;
    user.camOffed = !user.camOffed;
    return true;
}

function switchMicMutedState(roomId, userId) {
    var user = findUser(roomId, userId);
    if (user == null)
        return false;
    user.micMuted = !user.micMuted;
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

app.get("/is-owner", function (req, res) {
    var roomId = req.query.roomId;
    var userId = req.query.userId;
    res.send(JSON.stringify(isOwner(roomId, userId)));
});

app.post("/set-owner-if-not-exists", function (req, res) {
    var roomId = req.body.roomId;
    var ownerId = req.body.ownerId;
    if (!hasOwner(roomId)) {
        setOwner(roomId, ownerId);
        res.send(JSON.stringify("success"));
    }
    else {
        res.send(JSON.stringify("owner already exists"));
    }
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
    socket.on("join-room", (roomId, userId, peerId, username) => {
        if (userExists(roomId, userId)) {
            updatePeerIdOfUser(roomId, userId, peerId);
        }
        else {
            addUser(roomId, userId, peerId);
        }
        incUsersCount(roomId);
        socket.join(roomId);
        socket.on('ready', () => {
            socket.broadcast.to(roomId).emit("user-connected", peerId);
        });
        socket.on("message", (message) => {
            io.to(roomId).emit("createMessage", message, username);
        });
        socket.on("close-room", () => {
            if (isOwner(roomId, userId)) {
                io.to(roomId).emit("close-room");
                removeUsersByRoom(roomId);
                removeRoom(roomId);
            }
        });
        socket.on("mute-unmute", (userPeerId) => {
            if (isOwner(roomId, userId)) {
                io.to(roomId).emit("mute-unmute", userPeerId);
                switchMicMutedState(roomId, userId);
            }
        });
        socket.on("on-off", (userPeerId) => {
            if (isOwner(roomId, userId)) {
                io.to(roomId).emit("on-off", userPeerId);
                switchCamOffedState(roomId, userId);
            }
        });
        socket.on('disconnect', function () {
            decUsersCount(roomId);
            if (isRoomEmpty(roomId)) removeRoom(roomId);
            socket.broadcast.to(roomId).emit("user-disconnected", peerId);
        });
    });
});

server.listen(process.env.PORT || 5000);