const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// 🔥 SOCKET.IO (IMPORTANT FIX)
const io = new Server(server, {
  path: "/socket.io",
  cors: { origin: "*" }
});

// 🔥 SERVE FRONTEND
app.use(express.static(path.join(__dirname, "../client/pages")));

// 🔢 ONLINE COUNT
let onlineUsers = 0;

io.on("connection", (socket) => {
  onlineUsers++;
  console.log("CONNECTED:", socket.id, "ONLINE:", onlineUsers);

  io.emit("online-count", onlineUsers);

  socket.on("join", () => {
    socket.emit("matched");
  });

  socket.on("disconnect", () => {
    onlineUsers--;
    if (onlineUsers < 0) onlineUsers = 0;

    console.log("DISCONNECTED:", socket.id, "ONLINE:", onlineUsers);
    io.emit("online-count", onlineUsers);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT", PORT);
});
