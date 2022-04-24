const express = require("express");
const cors = require('cors');
const app = express();
const mysql = require("mysql2");
const Str = require('@supercharge/strings')
require('dotenv').config()

// Object keys to camelCase
function camelCaseKeys(object) {
    return Object
        .entries(object)
        .reduce((carry, [key, value]) => {
            carry[Str(key).camel().get()] = value

            return carry
        }, {})
}

// Connection to MySQL server
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS
});

// Testing connection
connection.connect(function (err) {
    if (err) {
        return console.error("Error: " + err.message);
    }
    else {
        console.log("The connection to the MySQL server has been successfully established");
    }
});

// Function that makes queries
async function mySQLQuery(query, data) {
    return new Promise((resolve, reject) => {
        connection.query(query, data,
            function (err, result, fields) {
                if (err) {
                    reject(err);
                }
                else {
                    for (var i = 0; i < result.length; i++) {
                        result[i] = camelCaseKeys(result[i]);
                    }
                    resolve(result);
                }
            });
    });
}

// ------- App settings -------
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

// ------- Database functions -------
// ROOM {name, room_id, owner_id, password, users_count}
async function getAllRooms() {
    var allRooms = await mySQLQuery('SELECT * FROM rooms', []);
    allRooms.forEach((element, index) => {
        allRooms[index].password = (element.password != null && element.password != "");
        delete allRooms[index].ownerId;
    });
    return allRooms;
}

async function findRoom(roomId) {
    var result = await mySQLQuery('SELECT DISTINCT * FROM rooms WHERE room_id = ?', [roomId]);
    if (result.length == 0) return null;
    else return result[0];
}

async function addRoom(name, roomId, ownerId, password, usersCount) {
    await mySQLQuery('INSERT INTO rooms(name,room_id,owner_id,password,users_count) VALUES (?,?,?,?,?)', [name, roomId, ownerId, password, usersCount]);
    return true;
}

async function removeRoom(roomId) {
    await mySQLQuery('DELETE FROM rooms WHERE room_id = ?', [roomId]);
    return true;
}

async function isRoomExist(roomId) {
    var room = await findRoom(roomId);
    return room != null;
}

async function isRoomEmpty(roomId) {
    var room = await findRoom(roomId);
    return room.usersCount <= 0;
}

async function isOwner(roomId, userId) {
    var room = await findRoom(roomId);
    if (room == null) return false;
    return room.ownerId == userId;
}

async function hasOwner(roomId) {
    var room = await findRoom(roomId);
    if (room == null) return false;
    return room.ownerId != null && room.ownerId != "";
}

async function setOwner(roomId, ownerId) {
    var room = await findRoom(roomId);
    if (room == null) return false;
    await mySQLQuery('UPDATE rooms SET owner_id = ? WHERE room_id = ?', [ownerId, roomId]);
    return true;
}

async function isPasswordCorrect(roomId, password) {
    var room = await findRoom(roomId);
    if (room == null) return false;
    return room.password == password || room.password == "" || room.password == null;
}

async function incUsersCount(roomId) {
    var room = await findRoom(roomId);
    if (room == null) return false;
    await mySQLQuery('UPDATE rooms SET users_count = users_count + 1 WHERE room_id = ?', [roomId]);
    return true;
}

async function decUsersCount(roomId) {
    var room = await findRoom(roomId);
    if (room == null) return false;
    await mySQLQuery('UPDATE rooms SET users_count = users_count - 1 WHERE room_id = ?', [roomId]);
    return true;
}

// USER {room_id, user_id, peer_id, mic_muted, cam_offed, quit}
async function addUser(roomId, userId, peerId) {
    await mySQLQuery('INSERT INTO users(room_id,user_id,peer_id,mic_muted,cam_offed,quit) VALUES (?,?,?,FALSE,FALSE,FALSE)', [roomId, userId, peerId]);
    return true;
}

async function findUser(roomId, userId) {
    var result = await mySQLQuery('SELECT DISTINCT * FROM users WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (result.length == 0) return null;
    else return result[0];
}

async function findUserByPeerIdAndRoomId(roomId, peerId) {
    var result = await mySQLQuery('SELECT DISTINCT * FROM users WHERE room_id = ? AND peer_id = ?', [roomId, peerId]);
    if (result.length == 0) return null;
    else return result[0];
}

async function getRoomUsers(roomId) {
    var roomUsers = await mySQLQuery('SELECT * FROM users WHERE room_id = ?', [roomId]);
    return roomUsers;
}

async function removeUser(roomId, userId) {
    var user = await findUser(roomId, userId);
    if (user == null)
        return false;
    if (user.micMuted == false && user.camOffed == false) {
        await mySQLQuery('DELETE FROM users WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    }
    else {
        await mySQLQuery('UPDATE users SET quit = TRUE WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    }
    return true;
}

async function userExists(roomId, userId) {
    var user = await findUser(roomId, userId);
    return user != null;
}

async function updatePeerIdOfUser(roomId, userId, newPeerId) {
    var user = await findUser(roomId, userId);
    if (user == null)
        return false;
    await mySQLQuery('UPDATE users SET peer_id = ?,quit = FALSE WHERE room_id = ? AND user_id = ?', [newPeerId, roomId, userId]);
    return true;
}

async function removeUsersByRoom(roomId) {
    await mySQLQuery('DELETE FROM users WHERE room_id = ?', [roomId]);
    return true;
}

async function switchCamOffedState(roomId, peerId) {
    var user = await findUserByPeerIdAndRoomId(roomId, peerId);
    if (user == null)
        return false;
    await mySQLQuery('UPDATE users SET cam_offed = !cam_offed WHERE room_id = ? AND peer_id = ?', [roomId, peerId]);
    return true;
}

async function switchMicMutedState(roomId, peerId) {
    var user = await findUserByPeerIdAndRoomId(roomId, peerId);
    if (user == null)
        return false;
    await mySQLQuery('UPDATE users SET mic_muted = !mic_muted WHERE room_id = ? AND peer_id = ?', [roomId, peerId]);
    return true;
}

function compareHash(roomId, remoteHash) {
    var hash = require('crypto').createHash('md5').update(roomId + "nom_xd_prod").digest("hex");
    return hash.toLowerCase() == remoteHash.toLowerCase();
}


// Clearing all empty rooms on WebService start
async function clearOnStart() {
    var rooms = await getAllRooms();
    for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].usersCount == 0) {
            removeUsersByRoom(rooms[i].roomId);
            removeRoom(rooms[i].roomId);
        }
    }
}
clearOnStart();



// Timers to remove {roomId, timer}
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


// ------- REST API (For ViddeoChatConferencesBackEnd) -------

app.get("/get-all-rooms", async (req, res) => {
    res.send(await getAllRooms());
});

app.post("/add-room", async (req, res) => {
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
    await addRoom(name, roomId, ownerId, password, usersCount);
    startTimerToRemove(roomId);
    res.send(JSON.stringify("success"));
});

app.get("/is-owner", async (req, res) => {
    var hashVal = req.query.hashVal;
    var roomId = req.query.roomId;
    if (!compareHash(roomId, hashVal)) {
        res.send(JSON.stringify("error"));
        return;
    }
    var userId = req.query.userId;
    res.send(JSON.stringify(await isOwner(roomId, userId)));
});

app.post("/set-owner-if-not-exists", async (req, res) => {
    var hashVal = req.query.hashVal;
    var roomId = req.body.roomId;
    if (!compareHash(roomId, hashVal)) {
        res.send(JSON.stringify("error"));
        return;
    }
    var ownerId = req.body.ownerId;
    if (!(await hasOwner(roomId))) {
        await setOwner(roomId, ownerId);
        res.send(JSON.stringify("success"));
    }
    else {
        res.send(JSON.stringify("owner already exists"));
    }
});

app.get("/is-password-correct", async (req, res) => {
    var hashVal = req.query.hashVal;
    var roomId = req.query.roomId;
    if (!compareHash(roomId, hashVal)) {
        res.send(JSON.stringify("error"));
        return;
    }
    var password = req.query.password;
    res.send(JSON.stringify(await isPasswordCorrect(roomId, password)));
});

app.get("/is-room-exists", async (req, res) => {
    var hashVal = req.query.hashVal;
    var roomId = req.query.roomId;
    if (!compareHash(roomId, hashVal)) {
        res.send(JSON.stringify("error"));
        return;
    }
    res.send(JSON.stringify(await isRoomExist(roomId)));
});

// ------- Web Sockets -------
const io = require("socket.io")(server, {
    cors: {
        origin: '*'
    }
});
io.on("connection", (socket) => {
    socket.on("join-room", async (roomId, userId, peerId, username, remoteHash) => {
        if (!compareHash(roomId, remoteHash)) {
            return;
        }
        if (await userExists(roomId, userId)) {
            updatePeerIdOfUser(roomId, userId, peerId);
        }
        else {
            addUser(roomId, userId, peerId);
        }
        incUsersCount(roomId);
        socket.join(roomId);
        socket.on('ready', async (remoteHash) => {
            if (!compareHash(roomId, remoteHash)) {
                return;
            }
            stopTimerToRemove(roomId);
            var user = Object.assign({}, await findUser(roomId, userId));
            if (user != null) user.userId = "";
            socket.broadcast.to(roomId).emit("user-connected", user, peerId);
            if (await isOwner(roomId, userId)) {
                io.to(socket.id).emit("users-table", await getRoomUsers(roomId));
            }
            else {
                io.to(socket.id).emit("user-data", user);
            }
        });
        socket.on("message", async (message, remoteHash) => {
            if (!compareHash(roomId, remoteHash)) {
                return;
            }
            if (message.length <= 256) {
                io.to(roomId).emit("createMessage", message, username);
            }
        });
        socket.on("close-room", async (remoteHash) => {
            if (!compareHash(roomId, remoteHash)) {
                return;
            }
            if (await isOwner(roomId, userId)) {
                io.to(roomId).emit("close-room");
                removeUsersByRoom(roomId);
                removeRoom(roomId);
            }
        });
        socket.on("mute-unmute", async (userPeerId, remoteHash) => {
            if (!compareHash(roomId, remoteHash)) {
                return;
            }
            if (await isOwner(roomId, userId)) {
                io.to(roomId).emit("mute-unmute", userPeerId);
                switchMicMutedState(roomId, userPeerId);
            }
        });
        socket.on("on-off", async (userPeerId, remoteHash) => {
            if (!compareHash(roomId, remoteHash)) {
                return;
            }
            if (await isOwner(roomId, userId)) {
                io.to(roomId).emit("on-off", userPeerId);
                switchCamOffedState(roomId, userPeerId);
            }
        });
        socket.on('disconnect', async function () {
            if (findRoom(roomId) != null) {
                var user = Object.assign({}, await findUser(roomId, userId));
                if (user != null) user.userId = "";
                socket.broadcast.to(roomId).emit("user-disconnected", user, peerId);
                decUsersCount(roomId);
                removeUser(roomId, userId);
                if ((await isRoomExist(roomId)) && (await isRoomEmpty(roomId))) startTimerToRemove(roomId);
            }
        });
    });
});

server.listen(process.env.PORT || 5000);