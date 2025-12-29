const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("OMEGLO SERVER RUNNING");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let onlineUsers = 0;
let waiting = [];

io.on("connection", socket => {
  onlineUsers++;
  io.emit("online-count", onlineUsers);
  console.log("CONNECT", onlineUsers);

  socket.on("join", () => {
    if (!waiting.includes(socket)) waiting.push(socket);

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

  socket.on("next", () => {
    if (socket.partner) socket.partner.emit("partner_left");
    socket.partner = null;
    if (!waiting.includes(socket)) waiting.push(socket);
  });

  socket.on("report", () => {
    if (socket.partner) socket.partner.disconnect();
  });

  socket.on("disconnect", () => {
    waiting = waiting.filter(s => s !== socket);
    onlineUsers--;
    if (onlineUsers < 0) onlineUsers = 0;
    io.emit("online-count", onlineUsers);
    console.log("DISCONNECT", onlineUsers);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log("SERVER RUNNING ON", PORT);
});
