const express = require("express");
const cors = require('cors');
const app = express();
app.use(cors({
    origin: '*'
}));
const server = require("http").Server(app);
const io = require("socket.io")(server, {
    cors: {
        origin: '*'
    }
});
io.on("connection", (socket) => {
    socket.on("join-room", (roomId, userId, userName) => {
        socket.join(roomId);
        socket.broadcast.to(roomId).emit("user-connected", userId);
        socket.on("message", (message) => {
            io.to(roomId).emit("createMessage", message, userName);
        });
    });
});
server.listen(process.env.PORT || 5000);