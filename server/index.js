const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// ================== ADMIN PANEL ==================
app.use("/admin", express.static(__dirname + "/admin"));

// ================== HEALTH CHECK =================
app.get("/", (req, res) => {
  res.send("🔥 OMEGLO SERVER RUNNING");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ================== ONLINE COUNT =================
let onlineUsers = 0;

// ================== MATCHING QUEUE =================
let waitingQueue = [];

// ================== INTEREST STORAGE =================
// socket.id -> interests array
const interestsMap = {};

// ================== REPORT STORAGE (simple) =================
const reports = {}; // ip -> count

function getIP(socket) {
  return (
    socket.handshake.headers["x-forwarded-for"] ||
    socket.handshake.address ||
    "unknown"
  );
}

// ================== SOCKET =================
io.on("connection", (socket) => {
  const ip = getIP(socket);

  // ---------- ONLINE COUNT ----------
  onlineUsers++;
  console.log("CONNECT:", socket.id, "ONLINE:", onlineUsers);
  io.emit("online-count", onlineUsers);

  // force client sync (cache/debug)
  socket.on("force-online-check", () => {
    socket.emit("online-count", onlineUsers);
  });

  // ---------- INTERESTS ----------
  socket.on("setInterests", (interestStr) => {
    if (!interestStr) {
      interestsMap[socket.id] = [];
    } else {
      interestsMap[socket.id] = interestStr
        .split(",")
        .map(x => x.trim().toLowerCase())
        .filter(Boolean);
    }
  });

  // ---------- JOIN QUEUE ----------
  socket.on("join", () => {
    if (waitingQueue.includes(socket)) return;

    waitingQueue.push(socket);
    socket.emit("waiting");

    // try matching
    tryMatch();
  });

  function tryMatch() {
    if (waitingQueue.length < 2) return;

    let a = waitingQueue.shift();
    let b = waitingQueue.shift();

    a.partner = b;
    b.partner = a;

    a.emit("matched");
    b.emit("matched");
  }

  // ---------- MESSAGE ----------
  socket.on("message", (msg) => {
    if (socket.partner) {
      socket.partner.emit("message", msg);
    }
  });

  // ---------- NEXT ----------
  socket.on("next", () => {
    if (socket.partner) {
      socket.partner.emit("partner_left");
      socket.partner.partner = null;
    }
    socket.partner = null;

    if (!waitingQueue.includes(socket)) {
      waitingQueue.push(socket);
      socket.emit("waiting");
      tryMatch();
    }
  });

  // ---------- REPORT ----------
  socket.on("report", () => {
    if (!socket.partner) return;

    const targetIP = getIP(socket.partner);
    reports[targetIP] = (reports[targetIP] || 0) + 1;

    console.log("REPORT:", targetIP, "COUNT:", reports[targetIP]);

    socket.partner.emit("banned", "You have been reported");
    socket.partner.disconnect();
  });

  // ---------- DISCONNECT ----------
  socket.on("disconnect", () => {
    waitingQueue = waitingQueue.filter(s => s !== socket);

    if (socket.partner) {
      socket.partner.emit("partner_left");
      socket.partner.partner = null;
    }

    delete interestsMap[socket.id];

    onlineUsers--;
    if (onlineUsers < 0) onlineUsers = 0;

    console.log("DISCONNECT:", socket.id, "ONLINE:", onlineUsers);
    io.emit("online-count", onlineUsers);
  });
});

// ================== START SERVER =================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log("🔥 OMEGLO SERVER RUNNING ON PORT", PORT);
});
