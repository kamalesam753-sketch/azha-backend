/**
 * AZHA Enterprise — Express Application Setup.
 * All middleware, routes, and error handling configured here.
 */
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { errorHandler } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

// Security
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());

// Parsing
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting on all API routes
app.use("/api", apiLimiter);

// Health check
app.get("/api/ping", (_req, res) => res.json({ success: true, message: "AZHA API is running" }));

// ===== REST API v1 Routes =====
app.use("/api/v1/auth", require("./routes/auth.routes"));
app.use("/api/v1/permits", require("./routes/permit.routes"));
app.use("/api/v1/scans", require("./routes/scan.routes"));
app.use("/api/v1/presence", require("./routes/presence.routes"));
app.use("/api/v1/security", require("./routes/security.routes"));
app.use("/api/v1/dashboard", require("./routes/dashboard.routes"));
app.use("/api/v1/gates", require("./routes/gate.routes"));
app.use("/api/v1/users", require("./routes/user.routes"));
app.use("/api/v1/watchlist", require("./routes/watchlist.routes"));
app.use("/api/v1/emergency", require("./routes/emergency.routes"));

// ===== Legacy Compatibility Bridge =====
// Maps old /api?action=XXX calls to new REST endpoints during frontend migration.
// This will be removed once all frontend pages are updated.
const legacyBridge = require("./legacy-bridge");
app.all("/api", legacyBridge);

// ===== Error Handling =====
app.use(errorHandler);

module.exports = app;
