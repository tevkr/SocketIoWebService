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

// {roomId, userId, peerId, micMuted, camOffed, quit}
users = [];
function addUser(roomId, userId, peerId) {
    users.push({ roomId: roomId, userId: userId, peerId: peerId, micMuted: false, camOffed: false, quit: false });
    return true;
}

function findUser(roomId, userId) {
    return users.find(user => user.userId == userId && user.roomId == roomId);
}

function findUserByPeerIdAndRoomId(roomId, peerId) {
    return users.find(user => user.peerId == peerId && user.roomId == roomId);
}

function getRoomUsers(roomId) {
    var roomUsers = users.filter(function (user, index, arr) {
        return user.roomId == roomId;
    });
    return roomUsers;
}

function removeUser(roomId, userId) {
    var user = findUser(roomId, userId);
    if (user == null)
        return false;
    if (user.micMuted == false && user.camOffed == false) {
        users = users.filter(function (user, index, arr) {
            return ((user.userId != userId && user.roomId == roomId) || user.roomId != roomId);
        });
    }
    else {
        user.quit = true;
    }
    return true;
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
    user.quit = false;
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

function switchCamOffedState(roomId, peerId) {
    var user = findUserByPeerIdAndRoomId(roomId, peerId);
    if (user == null)
        return false;
    user.camOffed = !user.camOffed;
    return true;
}

function switchMicMutedState(roomId, peerId) {
    var user = findUserByPeerIdAndRoomId(roomId, peerId);
    if (user == null)
        return false;
    user.micMuted = !user.micMuted;
    return true;
}

function compareHash(roomId, remoteHash) {
    var hash = require('crypto').createHash('md5').update(roomId + "nom_xd_prod").digest("hex");
    return hash.toLowerCase() == remoteHash.toLowerCase();
}

// Timers {roomId, timer}
timers = [];
timeToRemove = 60000; // 1 min
function startTimerToRemove(roomId) {
    timer = setTimeout(function () {
        removeUsersByRoom(roomId);
        removeRoom(roomId);
    }, timeToRemove);
    timers.push({ roomId: roomId, timer: timer });
}
function stopTimerToRemove(roomId) {
    timers = timers.filter(function (value, index, arr) {
        if (value.roomId == roomId) {
            clearTimeout(value.timer);
            return false;
        }
        return true;
    });
}


// REST API

app.get("/get-all-rooms", function (req, res) {
    res.send(getAllRooms());
});

app.post("/add-room", function (req, res) {
    var hashVal = req.query.hashVal;
    var roomId = req.body.roomId;
    if (!compareHash(roomId, hashVal)) {
        res.send(JSON.stringify("error"));
        return;
    }
    var name = req.body.name;
    var ownerId = req.body.ownerId;
    var password = req.body.password;
    var usersCount = req.body.usersCount;
    addRoom(name, roomId, ownerId, password, usersCount);
    startTimerToRemove(roomId);
    res.send(JSON.stringify("success"));
});

app.get("/is-owner", function (req, res) {
    var hashVal = req.query.hashVal;
    var roomId = req.query.roomId;
    if (!compareHash(roomId, hashVal)) {
        res.send(JSON.stringify("error"));
        return;
    }
    var userId = req.query.userId;
    res.send(JSON.stringify(isOwner(roomId, userId)));
});

app.post("/set-owner-if-not-exists", function (req, res) {
    var hashVal = req.query.hashVal;
    var roomId = req.body.roomId;
    if (!compareHash(roomId, hashVal)) {
        res.send(JSON.stringify("error"));
        return;
    }
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
    var hashVal = req.query.hashVal;
    var roomId = req.query.roomId;
    if (!compareHash(roomId, hashVal)) {
        res.send(JSON.stringify("error"));
        return;
    }
    var password = req.query.password;
    res.send(JSON.stringify(isPasswordCorrect(roomId, password)));
});

app.get("/is-room-exists", function (req, res) {
    var hashVal = req.query.hashVal;
    var roomId = req.query.roomId;
    if (!compareHash(roomId, hashVal)) {
        res.send(JSON.stringify("error"));
        return;
    }
    res.send(JSON.stringify(isRoomExist(roomId)));
});

app.get("/debug-users", function (req, res) {
    res.send(JSON.stringify(users));
});

app.get("/debug-rooms", function (req, res) {
    res.send(JSON.stringify(rooms));
});

// Sockets
const io = require("socket.io")(server, {
    cors: {
        origin: '*'
    }
});
io.on("connection", (socket) => {
    socket.on("join-room", (roomId, userId, peerId, username, remoteHash) => {
        if (!compareHash(roomId, remoteHash)) {
            return;
        }
        if (userExists(roomId, userId)) {
            updatePeerIdOfUser(roomId, userId, peerId);
        }
        else {
            addUser(roomId, userId, peerId);
        }
        incUsersCount(roomId);
        socket.join(roomId);
        socket.on('ready', (remoteHash) => {
            if (!compareHash(roomId, remoteHash)) {
                return;
            }
            stopTimerToRemove(roomId);
            var user = Object.assign({}, findUser(roomId, userId));
            if (user != null) user.userId = "";
            socket.broadcast.to(roomId).emit("user-connected", user, peerId);
            if (isOwner(roomId, userId)) {
                io.to(socket.id).emit("users-table", getRoomUsers(roomId));
            }
            else {
                io.to(socket.id).emit("user-data", user);
            }
        });
        socket.on("message", (message, remoteHash) => {
            if (!compareHash(roomId, remoteHash)) {
                return;
            }
            if (message.length <= 256) {
                io.to(roomId).emit("createMessage", message, username);
            }
        });
        socket.on("close-room", (remoteHash) => {
            if (!compareHash(roomId, remoteHash)) {
                return;
            }
            if (isOwner(roomId, userId)) {
                io.to(roomId).emit("close-room");
                removeUsersByRoom(roomId);
                removeRoom(roomId);
            }
        });
        socket.on("mute-unmute", (userPeerId, remoteHash) => {
            if (!compareHash(roomId, remoteHash)) {
                return;
            }
            if (isOwner(roomId, userId)) {
                io.to(roomId).emit("mute-unmute", userPeerId);
                switchMicMutedState(roomId, userPeerId);
            }
        });
        socket.on("on-off", (userPeerId, remoteHash) => {
            if (!compareHash(roomId, remoteHash)) {
                return;
            }
            if (isOwner(roomId, userId)) {
                io.to(roomId).emit("on-off", userPeerId);
                switchCamOffedState(roomId, userPeerId);
            }
        });
        socket.on('disconnect', function () {
            if (findRoom(roomId) != null) {
                var user = Object.assign({}, findUser(roomId, userId));
                if (user != null) user.userId = "";
                decUsersCount(roomId);
                removeUser(roomId, userId);
                if (isRoomEmpty(roomId)) startTimerToRemove(roomId);
                socket.broadcast.to(roomId).emit("user-disconnected", user, peerId);
            }
        });
    });
});

server.listen(process.env.PORT || 5000);