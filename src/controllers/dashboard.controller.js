/**
 * Dashboard controller — aggregated data for the admin dashboard.
 */
const Permit = require("../models/Permit");
const ScanLog = require("../models/ScanLog");
const Session = require("../models/Session");
const SecurityAction = require("../models/SecurityAction");
const AuditLog = require("../models/AuditLog");
const PresenceLog = require("../models/PresenceLog");
const Gate = require("../models/Gate");
const Watchlist = require("../models/Watchlist");
const PermitToken = require("../models/PermitToken");
const SystemSetting = require("../models/SystemSetting");
const { success } = require("../utils/response");
const { computePermitValidity } = require("../services/validity.service");
const { startOfToday, endOfToday } = require("../utils/date");

/** GET /api/v1/dashboard — aggregated dashboard bundle */
async function getDashboard(req, res) {
  const today = startOfToday();
  const todayEnd = endOfToday();

  const [
    totalPermits,
    todayScans,
    invalidScansToday,
    activeSessions,
    recentScans,
    recentActions,
    recentAudit,
    gates,
    mainGateScans,
    beachGateScans,
    auditCountToday,
    actionCountToday,
    activeSessionsList,
    permitTokens,
    systemSettings,
    approvedCount,
    rejectedCount,
    reviewCount,
    presentCount
  ] = await Promise.all([
    Permit.countDocuments(),
    ScanLog.countDocuments({ createdAt: { $gte: today, $lte: todayEnd } }),
    ScanLog.countDocuments({ createdAt: { $gte: today, $lte: todayEnd }, result: { $in: ["invalid", "expired", "not_found"] } }),
    Session.countDocuments({ status: "active" }),
    ScanLog.find().sort({ createdAt: -1 }).limit(20).lean(),
    SecurityAction.find().sort({ createdAt: -1 }).limit(20).lean(),
    AuditLog.find().sort({ createdAt: -1 }).limit(20).lean(),
    Gate.find().lean(),
    ScanLog.countDocuments({ createdAt: { $gte: today, $lte: todayEnd }, gateName: { $regex: /main/i } }),
    ScanLog.countDocuments({ createdAt: { $gte: today, $lte: todayEnd }, gateName: { $regex: /beach/i } }),
    AuditLog.countDocuments({ createdAt: { $gte: today, $lte: todayEnd } }),
    SecurityAction.countDocuments({ createdAt: { $gte: today, $lte: todayEnd } }),
    Session.find({ status: "active" }).sort({ lastActivity: -1 }).limit(20)
      .select("username fullName role gateName gateLocation createdAt expiresAt lastActivity").lean(),
    PermitToken.find().sort({ createdAt: -1 }).limit(50)
      .select("permitId token status createdAt regeneratedAt disabledBy").lean(),
    SystemSetting.find().lean(),
    SecurityAction.countDocuments({ decision: "approved", createdAt: { $gte: today, $lte: todayEnd } }),
    SecurityAction.countDocuments({ decision: "rejected", createdAt: { $gte: today, $lte: todayEnd } }),
    SecurityAction.countDocuments({ decision: { $in: ["review_required", "payment_issue"] }, createdAt: { $gte: today, $lte: todayEnd } }),
    PresenceLog.countDocuments({ present: true, timestamp: { $gte: today } })
  ]);

  // Compute permit validity counts
  const allPermits = await Permit.find().select("startDate endDate statusArabic paymentArabic").lean();
  let validCount = 0, warningCount = 0, invalidCount = 0;

  for (const p of allPermits) {
    const v = computePermitValidity(p.startDate, p.endDate, p.statusArabic, p.paymentArabic);
    if (v.validityClass === "valid") validCount++;
    else if (v.validityClass === "warning") warningCount++;
    else invalidCount++;
  }

  // Build latest verification from most recent scan
  const latestScan = recentScans[0] || null;
  const latest = latestScan ? {
    found: true,
    permitId: latestScan.permitId || "",
    tenant: latestScan.tenant || "",
    unit: latestScan.unit || "",
    gateName: latestScan.gateName || "",
    gateLocation: latestScan.gateLocation || "",
    securityUsername: latestScan.securityUsername || "",
    role: latestScan.role || "",
    statusArabic: latestScan.statusArabic || "",
    paymentArabic: latestScan.paymentArabic || "",
    validityClass: latestScan.result || "",
    validityText: latestScan.resultText || "",
    mode: latestScan.mode || "scan",
    timestamp: latestScan.createdAt ? new Date(latestScan.createdAt).toLocaleString() : ""
  } : { found: false };

  // Format audit logs as arrays for frontend renderAuditLogs (expects row[0], row[1], etc.)
  const auditLogs = recentAudit.map(a => [
    a.createdAt ? new Date(a.createdAt).toLocaleString() : "-",       // [0] timestamp
    a.action || "-",                                                    // [1] action
    a.username || "-",                                                  // [2] user
    a.details || "-",                                                   // [3] details
    a.target || a.permitId || "-",                                      // [4] target
    "", "", "", "", "", "",                                              // [5-10] padding
    a.gateName || "-",                                                  // [11] gate
    a.gateLocation || "-",                                              // [12] gate location
    a.username || "-",                                                  // [13] operator
    a.role || "-"                                                       // [14] role
  ]);

  // Format security actions for frontend renderSecurityActions
  const securityActions = recentActions.map(a => ({
    createdAt: a.createdAt ? new Date(a.createdAt).toLocaleString() : "-",
    permitId: a.permitId || "-",
    action: a.decision || a.action || "-",
    notes: a.notes || "-",
    username: a.username || "-",
    gateName: a.gateName || "-"
  }));

  // Build permissions from session
  const permissions = req.sessionData ? require("./auth.controller.js") : null;

  return success(res, {
    dashboard: {
      total: totalPermits,
      active: validCount,
      warning: warningCount,
      expired: invalidCount,
      todayScans,
      invalidScansToday
    },
    summary: {
      invalidScans: invalidScansToday,
      mainGateScans,
      beachGateScans,
      activeSessions,
      approvedCount,
      rejectedCount,
      reviewCount,
      paymentIssueCount: warningCount,
      presentCount
    },
    operations: {
      auditCountToday,
      actionCountToday
    },
    latest,
    auditLogs,
    securityActions,
    activeSessions: activeSessionsList.map(s => ({
      username: s.username || "-",
      fullName: s.fullName || "-",
      role: s.role || "-",
      gateName: s.gateName || "-",
      gateLocation: s.gateLocation || "-",
      createdAt: s.createdAt ? new Date(s.createdAt).toLocaleString() : "-",
      expiresAt: s.expiresAt ? new Date(s.expiresAt).toLocaleString() : "-",
      lastActivity: s.lastActivity ? new Date(s.lastActivity).toLocaleString() : "-"
    })),
    permitTokens: permitTokens.map(t => ({
      permitId: t.permitId || "-",
      token: t.token ? (t.token.substring(0, 12) + "...") : "-",
      status: t.status || "-",
      createdAt: t.createdAt ? new Date(t.createdAt).toLocaleString() : "-",
      regeneratedAt: t.regeneratedAt ? new Date(t.regeneratedAt).toLocaleString() : "-",
      disabledBy: t.disabledBy || "-"
    })),
    systemSettings: systemSettings.length ? systemSettings.map(s => ({ key: s.key, value: s.value })) : [
      { key: "Platform", value: "AZHA Enterprise Security v2.0" },
      { key: "Backend", value: "Railway (Node.js + MongoDB)" },
      { key: "Frontend", value: "Vercel (Static)" },
      { key: "Auth", value: "JWT Session-based" },
      { key: "Realtime", value: "Socket.IO" },
      { key: "Session TTL", value: process.env.SESSION_HOURS ? process.env.SESSION_HOURS + " hours" : "24 hours" }
    ],
    userContext: {
      generatedAt: new Date().toISOString(),
      permissions: req.sessionData ? {
        canAccessDashboard: true,
        canManagePermits: true,
        canManageUsers: true,
        canManageGates: true,
        canManageTokens: true,
        canViewAuditLogs: true,
        canViewActiveSessions: true,
        canViewSystemSettings: true,
        canOpenGateFromDashboard: true
      } : {}
    },
    recentScans,
    gates
  });
}

/** GET /api/v1/dashboard/reports — filtered scan/permit report */
async function getReports(req, res) {
  const { dateFrom, dateTo, gateName, validityClass, permitId, tenant, unit } = req.query;
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));

  // Build scan log filter
  const scanFilter = {};
  if (dateFrom || dateTo) {
    scanFilter.createdAt = {};
    if (dateFrom) scanFilter.createdAt.$gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) scanFilter.createdAt.$lte = new Date(dateTo + "T23:59:59");
  }
  if (gateName) scanFilter.gateName = gateName;
  if (permitId) scanFilter.permitId = { $regex: permitId, $options: "i" };

  const scans = await ScanLog.find(scanFilter).sort({ createdAt: -1 }).limit(limit).lean();

  // Enrich with permit validity data
  const permitIds = [...new Set(scans.map(s => s.permitId).filter(Boolean))];
  const permits = await Permit.find({ permitId: { $in: permitIds } })
    .select("permitId unit tenant startDate endDate statusArabic paymentArabic")
    .lean();

  const permitMap = {};
  permits.forEach(p => {
    const v = computePermitValidity(p.startDate, p.endDate, p.statusArabic, p.paymentArabic);
    permitMap[p.permitId] = { ...p, validityClass: v.validityClass, validityText: v.validityText };
  });

  // Build enriched rows
  const rows = scans.map(s => {
    const p = permitMap[s.permitId] || {};
    return {
      ...s,
      unit: s.unit || p.unit || "",
      tenant: s.tenant || p.tenant || "",
      validityClass: s.result || p.validityClass || "unknown",
      validityText: s.resultText || p.validityText || "",
      statusArabic: p.statusArabic || "",
      paymentArabic: p.paymentArabic || ""
    };
  });

  // Apply optional client-side-like filters
  let filtered = rows;
  if (validityClass) {
    filtered = filtered.filter(r => r.validityClass === validityClass);
  }
  if (tenant) {
    const t = tenant.toLowerCase();
    filtered = filtered.filter(r =>
      (r.tenant || "").toLowerCase().includes(t) ||
      (r.unit || "").toLowerCase().includes(t) ||
      (r.permitId || "").toLowerCase().includes(t)
    );
  }

  // Summary counts
  let validCount = 0, warningCount = 0, invalidCount = 0;
  filtered.forEach(r => {
    if (r.validityClass === "valid") validCount++;
    else if (r.validityClass === "warning") warningCount++;
    else invalidCount++;
  });

  return success(res, {
    summary: {
      totalMatchedRows: filtered.length,
      validCount,
      warningCount,
      invalidCount
    },
    rows: filtered
  });
}

module.exports = { getDashboard, getReports };
