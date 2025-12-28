const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Admin panel static route
app.use("/admin", express.static(__dirname + "/admin"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/* =========================
   ONLINE COUNT
========================= */
let onlineUsers = 0;

/* =========================
   BAN STORAGE (PERMANENT)
========================= */
const DATA_FILE = "./bans.json";
let bans = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

function saveBans() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(bans, null, 2));
}

/* =========================
   HELPERS
========================= */
function getIP(socket) {
  return (
    socket.handshake.headers["x-forwarded-for"] ||
    socket.handshake.address
  );
}

/* =========================
   MATCHING QUEUE
========================= */
let waiting = [];

/* =========================
   SOCKET.IO
========================= */
io.on("connection", (socket) => {
  const ip = getIP(socket);

  /* 🔢 ONLINE COUNT */
  onlineUsers++;
  io.emit("online-count", onlineUsers);

  /* 🚫 PERMANENT BAN CHECK */
  if (bans[ip]) {
    socket.emit("banned", "You are permanently banned");
    socket.disconnect();
    onlineUsers--;
    io.emit("online-count", onlineUsers);
    return;
  }

  /* 🟢 USER JOINS CHAT (START BUTTON) */
  socket.on("join", () => {
    waiting.push(socket);
    socket.emit("waiting");

    if (waiting.length >= 2) {
      const a = waiting.shift();
      const b = waiting.shift();
      a.partner = b;
      b.partner = a;
      a.emit("matched");
      b.emit("matched");
    }
  });

  /* 💬 TEXT MESSAGE + ABUSE CHECK */
  socket.on("message", (msg) => {
    const badWords = [
      "fuck","bitch","asshole","sex","nude",
      "madarchod","chutiya","bhenchod"
    ];
    const lower = msg.toLowerCase();

    if (badWords.some(w => lower.includes(w))) {
      bans[ip] = {
        reason: "Abusive language",
        bannedAt: new Date().toISOString()
      };
      saveBans();
      socket.emit("banned", "Abusive language detected");
      socket.disconnect();
      return;
    }

    socket.partner && socket.partner.emit("message", msg);
  });

  socket.on("typing", () => {
    socket.partner && socket.partner.emit("typing");
  });

  /* 🚨 REPORT → PERMANENT BAN */
  socket.on("report", () => {
    if (!socket.partner) return;

    const targetIP = getIP(socket.partner);
    bans[targetIP] = {
      reason: "Reported by user",
      bannedAt: new Date().toISOString()
    };
    saveBans();

    socket.partner.emit("banned", "You are permanently banned");
    socket.partner.disconnect();
  });

  /* 🔞 AI NUDITY FRAME (HOOK READY) */
  socket.on("frame", () => {
    // AI hook ready (already handled in previous step)
    // Intentionally left light to avoid CPU abuse
  });

  /* 🔁 WEBRTC SIGNALING */
  ["offer", "answer", "ice-candidate"].forEach(evt => {
    socket.on(evt, d => socket.partner && socket.partner.emit(evt, d));
  });

  /* ⏭ NEXT */
  socket.on("next", () => {
    if (socket.partner) {
      socket.partner.emit("partner_left");
      socket.partner.partner = null;
    }
    socket.partner = null;
    waiting.push(socket);
  });

  /* ❌ DISCONNECT */
  socket.on("disconnect", () => {
    waiting = waiting.filter(s => s !== socket);
    if (socket.partner) socket.partner.emit("partner_left");

    onlineUsers--;
    if (onlineUsers < 0) onlineUsers = 0;
    io.emit("online-count", onlineUsers);
  });
});

/* =========================
   START SERVER
========================= */
server.listen(5000, () => {
  console.log("🔥 OMEGLO SERVER RUNNING");
  console.log("• Online count: ON");
  console.log("• Permanent ban: ON");
  console.log("• Start page flow: ON");
  console.log("http://localhost:5000");
});
