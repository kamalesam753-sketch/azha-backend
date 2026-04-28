const Session = require("../models/Session");

function getRolePermissions(role) {
  const isManager = role === "admin" || role === "supervisor";
  const canAccessDashboard = isManager || role === "viewer";
  const canAccessGate = isManager || role === "guard" || role === "scanner";

  return {
    canAccessDashboard,
    canAccessGate,
    canSearchPermits: canAccessDashboard || canAccessGate,
    canScanTokens: canAccessGate,
    canSubmitSecurityDecision: canAccessGate,
    canApplySecurityDecision: isManager,
    canViewAuditLogs: isManager,
    canViewSecurityActions: canAccessDashboard,
    canViewActiveSessions: isManager,
    canManageTokens: isManager,
    canViewSystemSettings: isManager,
    canOpenGateFromDashboard: isManager,
    canOpenDashboardFromGate: isManager,
    canViewReports: canAccessDashboard,
    defaultRoute: role === "guard" || role === "scanner" ? "gate" : "dashboard"
  };
}

async function requireSession(req, res, next) {
  const sessionToken =
    req.body.sessionToken ||
    req.query.sessionToken ||
    req.headers["x-session-token"];

  if (!sessionToken) {
    return res.status(401).json({
      success: false,
      message: "Session token غير موجود"
    });
  }

  const session = await Session.findOne({ sessionToken });

  if (!session || session.status !== "active") {
    return res.status(401).json({
      success: false,
      message: "الجلسة غير نشطة"
    });
  }

  if (new Date() > session.expiresAt) {
    session.status = "expired";
    await session.save();

    return res.status(401).json({
      success: false,
      message: "انتهت صلاحية الجلسة"
    });
  }

  session.lastActivity = new Date();
  await session.save();

  req.session = session;
  req.permissions = getRolePermissions(session.role);

  next();
}

function requireRoles(roles) {
  return function (req, res, next) {
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية لهذه العملية"
      });
    }

    next();
  };
}

module.exports = {
  requireSession,
  requireRoles,
  getRolePermissions
};