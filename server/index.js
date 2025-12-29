const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/* =====================
   ONLINE COUNT
===================== */
let onlineUsers = 0;

/* =====================
   BAN STORAGE
===================== */
const DATA_FILE = "./bans.json";
let bans = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

function saveBans() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(bans, null, 2));
}

function getIP(socket) {
  return socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
}

/* =====================
   MATCHING
===================== */
let waiting = [];

/* =====================
   SOCKET
===================== */
io.on("connection", socket => {
  const ip = getIP(socket);

  onlineUsers++;
  io.emit("online-count", onlineUsers);

  if (bans[ip]) {
    socket.emit("banned", "You are banned");
    socket.disconnect();
    return;
  }

  socket.on("join", () => {
    waiting.push(socket);
    if (waiting.length >= 2) {
      const a = waiting.shift();
      const b = waiting.shift();
      a.partner = b;
      b.partner = a;
      a.emit("matched");
      b.emit("matched");
    }
  });

  socket.on("message", msg => {
    socket.partner && socket.partner.emit("message", msg);
  });

  socket.on("report", () => {
    if (!socket.partner) return;
    const targetIP = getIP(socket.partner);
    bans[targetIP] = { reason:"Reported", time:new Date() };
    saveBans();
    socket.partner.emit("banned","You are banned");
    socket.partner.disconnect();
  });

  socket.on("next", () => {
    if (socket.partner) socket.partner.emit("partner_left");
    socket.partner = null;
    waiting.push(socket);
  });

  socket.on("disconnect", () => {
    waiting = waiting.filter(s => s !== socket);
    onlineUsers--;
    if (onlineUsers < 0) onlineUsers = 0;
    io.emit("online-count", onlineUsers);
  });
});

server.listen(5000, () => {
  console.log("OMEGLO SERVER RUNNING");
});
