/**
 * AZHA Enterprise Security System — Server Entry Point.
 * 
 * Handles:
 * 1. Environment validation
 * 2. Database connection
 * 3. HTTP server + Socket.IO realtime
 */
const http = require("http");
const env = require("./src/config/env");
const connectDB = require("./src/config/db");
const app = require("./src/app");
const { Server: SocketIO } = require("socket.io");
const realtimeService = require("./src/services/realtime.service");

async function start() {
  try {
    await connectDB();
    console.log("MongoDB connected");

    const server = http.createServer(app);

    // Socket.IO — realtime engine
    const io = new SocketIO(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    realtimeService.init(io);

    io.on("connection", (socket) => {
      console.log(`[WS] Client connected: ${socket.id}`);
      socket.on("disconnect", () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
      });
    });

    server.listen(env.PORT, () => {
      console.log(`AZHA API running on port ${env.PORT}`);
      console.log(`Socket.IO realtime engine active`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
