/**
 * Authentication middleware (refactored).
 * Validates session tokens and injects session context into req.session.
 */
const Session = require("../models/Session");
const { AppError } = require("./errorHandler");

const ROLES = {
  admin: { level: 100, permissions: ["*"] },
  supervisor: { level: 80, permissions: ["scan", "search", "logs", "users.read", "gates.read", "permits.*", "watchlist.*", "dashboard"] },
  guard: { level: 40, permissions: ["scan", "search", "logs", "presence"] },
  scanner: { level: 30, permissions: ["scan", "presence"] },
  viewer: { level: 10, permissions: ["dashboard", "permits.read", "logs.read"] }
};

/**
 * Require a valid session.
 * Injects req.sessionData with user info.
 */
async function requireAuth(req, _res, next) {
  const token =
    req.headers["x-session-token"] ||
    req.body?.sessionToken ||
    req.query?.sessionToken ||
    "";

  if (!token) {
    return next(new AppError("Authentication required", 401));
  }

  const session = await Session.findOne({ sessionToken: token });

  if (!session) {
    return next(new AppError("Session not found or expired", 401));
  }

  if (session.status !== "active") {
    return next(new AppError("Session is no longer active", 401));
  }

  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    await Session.updateOne({ _id: session._id }, { status: "expired" });
    return next(new AppError("Session expired", 401));
  }

  session.lastActivity = new Date();
  await session.save();

  req.sessionData = {
    sessionToken: token,
    username: session.username || "",
    role: session.role || "",
    fullName: session.fullName || "",
    gateName: session.gateName || "",
    gateLocation: session.gateLocation || "",
    sessionId: session._id
  };

  next();
}

/**
 * Require specific roles.
 */
function requireRole(...roles) {
  return function (req, _res, next) {
    const userRole = req.sessionData?.role || "";

    if (userRole === "admin") return next();

    if (!roles.includes(userRole)) {
      return next(new AppError("Insufficient permissions", 403));
    }

    next();
  };
}

/**
 * Check if a role has a specific permission.
 */
function hasPermission(role, permission) {
  const r = ROLES[role];
  if (!r) return false;
  if (r.permissions.includes("*")) return true;
  return r.permissions.some((p) => {
    if (p === permission) return true;
    if (p.endsWith(".*")) return permission.startsWith(p.replace(".*", ""));
    return false;
  });
}

function getRoleLevel(role) {
  return (ROLES[role] || {}).level || 0;
}

module.exports = { requireAuth, requireRole, hasPermission, getRoleLevel, ROLES };
