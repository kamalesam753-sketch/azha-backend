/**
 * Auth controller — login, logout, session verification.
 */
const crypto = require("crypto");
const User = require("../models/User");
const Session = require("../models/Session");
const { comparePassword } = require("../utils/hash");
const { success, fail } = require("../utils/response");
const { logAction } = require("../services/audit.service");
const env = require("../config/env");
const rt = require("../services/realtime.service");

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return fail(res, "Username and password are required", 400);
  }

  const user = await User.findOne({
    username: String(username).trim().toLowerCase()
  });

  if (!user || user.status !== "active") {
    return fail(res, "Invalid credentials", 401);
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    await logAction("login_failed", { username: username });
    return fail(res, "Invalid credentials", 401);
  }

  const sessionToken = crypto.randomUUID() + "-" + Date.now();
  const expiresAt = new Date(Date.now() + env.SESSION_HOURS * 3600000);

  await Session.create({
    sessionToken,
    username: user.username,
    role: user.role,
    fullName: user.fullName || "",
    gateName: user.gateName || "",
    gateLocation: user.gateLocation || "",
    status: "active",
    expiresAt,
    lastActivity: new Date()
  });

  await logAction("login_success", { username: user.username, role: user.role });

  rt.emit(rt.events.GUARD_ONLINE, { username: user.username, role: user.role, gateName: user.gateName || "" });

  return success(res, {
    sessionToken,
    username: user.username,
    role: user.role,
    fullName: user.fullName || "",
    gateName: user.gateName || "",
    gateLocation: user.gateLocation || ""
  }, "Login successful");
}

async function verifySession(req, res) {
  return success(res, {
    username: req.sessionData.username,
    role: req.sessionData.role,
    fullName: req.sessionData.fullName || "",
    gateName: req.sessionData.gateName || "",
    gateLocation: req.sessionData.gateLocation || ""
  }, "Session valid");
}

async function logout(req, res) {
  await Session.updateOne(
    { sessionToken: req.sessionData.sessionToken },
    { status: "ended" }
  );

  await logAction("logout", req.sessionData);

  rt.emit(rt.events.GUARD_OFFLINE, { username: req.sessionData.username, gateName: req.sessionData.gateName || "" });

  return success(res, null, "Logged out successfully");
}

module.exports = { login, verifySession, logout };
