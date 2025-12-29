const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();

/* =========================
   FRONTEND SERVE (IMPORTANT)
   client/pages ko serve kar rahe
========================= */
app.use(express.static(path.join(__dirname, "../client/pages")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/pages/index.html"));
});

const server = http.createServer(app);
const io = new Server(server);

/* =========================
   ONLINE COUNT
========================= */
let onlineUsers = 0;

/* =========================
   MATCHING QUEUE
========================= */
let waiting = [];

/* =========================
   SOCKET LOGIC
========================= */
io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("online-count", onlineUsers);

  socket.on("join", ({ mode, interests }) => {
    socket.mode = mode;
    socket.interests = interests;
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

  socket.on("message", (msg) => {
    socket.partner && socket.partner.emit("message", msg);
  });

  socket.on("next", () => {
    if (socket.partner) {
      socket.partner.emit("partner_left");
      socket.partner.partner = null;
    }
    socket.partner = null;
    waiting.push(socket);
  });

  socket.on("disconnect", () => {
    waiting = waiting.filter(s => s !== socket);
    if (socket.partner) socket.partner.emit("partner_left");
    onlineUsers--;
    if (onlineUsers < 0) onlineUsers = 0;
    io.emit("online-count", onlineUsers);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log("OMEGLO RUNNING ON PORT", PORT);
});
