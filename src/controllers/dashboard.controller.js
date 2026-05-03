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

module.exports = { getDashboard };
