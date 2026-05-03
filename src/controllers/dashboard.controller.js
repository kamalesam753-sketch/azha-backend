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
const { success } = require("../utils/response");
const { computePermitValidity } = require("../services/validity.service");
const { startOfToday, endOfToday } = require("../utils/date");

/** GET /api/v1/dashboard — aggregated dashboard bundle */
async function getDashboard(req, res) {
  const today = startOfToday();
  const todayEnd = endOfToday();

  const [
    totalPermits,
    totalScans,
    todayScans,
    activeSessions,
    totalPresent,
    activeWatchlist,
    recentScans,
    recentActions,
    recentAudit,
    gates
  ] = await Promise.all([
    Permit.countDocuments(),
    ScanLog.countDocuments(),
    ScanLog.countDocuments({ createdAt: { $gte: today, $lte: todayEnd } }),
    Session.countDocuments({ status: "active" }),
    PresenceLog.countDocuments({ present: true, timestamp: { $gte: today } }),
    Watchlist.countDocuments({ status: "active" }),
    ScanLog.find().sort({ createdAt: -1 }).limit(20).lean(),
    SecurityAction.find().sort({ createdAt: -1 }).limit(20).lean(),
    AuditLog.find().sort({ createdAt: -1 }).limit(20).lean(),
    Gate.find().lean()
  ]);

  // Compute permit status counts
  const allPermits = await Permit.find().select("startDate endDate statusArabic paymentArabic").lean();
  let validCount = 0, warningCount = 0, invalidCount = 0;

  for (const p of allPermits) {
    const v = computePermitValidity(p.startDate, p.endDate, p.statusArabic, p.paymentArabic);
    if (v.validityClass === "valid") validCount++;
    else if (v.validityClass === "warning") warningCount++;
    else invalidCount++;
  }

  return success(res, {
    stats: {
      totalPermits,
      validPermits: validCount,
      warningPermits: warningCount,
      expiredPermits: invalidCount,
      totalScans,
      todayScans,
      activeSessions,
      totalPresent,
      activeWatchlist,
      totalGates: gates.length
    },
    recentScans,
    recentActions,
    recentAudit,
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
