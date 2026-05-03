/**
 * Centralized audit logging service.
 * All security-relevant actions are logged through this module.
 */
const AuditLog = require("../models/AuditLog");

async function logAction(type, session, extra) {
  try {
    await AuditLog.create({
      actionType: type,
      username: session?.username || "",
      role: session?.role || "",
      gateName: session?.gateName || "",
      gateLocation: session?.gateLocation || "",
      ...(extra || {})
    });
  } catch (e) {
    console.error("Audit log error:", e.message);
  }
}

module.exports = { logAction };
