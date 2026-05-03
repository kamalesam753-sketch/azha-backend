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

/**
 * Build permissions object from role for frontend dashboard access control.
 */
function buildPermissions(role) {
  const base = {
    canAccessDashboard: false,
    canAccessGate: false,
    canManagePermits: false,
    canManageUsers: false,
    canManageGates: false,
    canManageTokens: false,
    canViewAuditLogs: false,
    canViewActiveSessions: false,
    canViewSystemSettings: false,
    canOpenGateFromDashboard: false,
    canOpenDashboardFromGate: false,
    defaultRoute: "login"
  };

  switch (role) {
    case "admin":
      return { ...base, canAccessDashboard: true, canAccessGate: true, canManagePermits: true, canManageUsers: true, canManageGates: true, canManageTokens: true, canViewAuditLogs: true, canViewActiveSessions: true, canViewSystemSettings: true, canOpenGateFromDashboard: true, canOpenDashboardFromGate: true, defaultRoute: "dashboard" };
    case "supervisor":
      return { ...base, canAccessDashboard: true, canAccessGate: true, canManagePermits: true, canManageGates: true, canManageTokens: true, canViewAuditLogs: true, canViewActiveSessions: true, canOpenDashboardFromGate: true, defaultRoute: "dashboard" };
    case "viewer":
      return { ...base, canAccessDashboard: true, defaultRoute: "dashboard" };
    case "guard":
      return { ...base, canAccessGate: true, defaultRoute: "gate" };
    case "scanner":
      return { ...base, canAccessGate: true, defaultRoute: "gate" };
    default:
      return base;
  }
}

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
    gateLocation: user.gateLocation || "",
    permissions: buildPermissions(user.role)
  }, "Login successful");
}

async function verifySession(req, res) {
  return success(res, {
    username: req.sessionData.username,
    role: req.sessionData.role,
    fullName: req.sessionData.fullName || "",
    gateName: req.sessionData.gateName || "",
    gateLocation: req.sessionData.gateLocation || "",
    permissions: buildPermissions(req.sessionData.role)
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

