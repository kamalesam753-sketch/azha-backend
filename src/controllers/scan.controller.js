/**
 * Scan controller — QR verification and scan log.
 */
const Permit = require("../models/Permit");
const ScanLog = require("../models/ScanLog");
const Watchlist = require("../models/Watchlist");
const { success, fail, paginated } = require("../utils/response");
const { findActiveToken } = require("../services/token.service");
const { computePermitValidity } = require("../services/validity.service");
const { logAction } = require("../services/audit.service");
const { mapPermitPayload } = require("../services/permit.service");
const { toDateKey } = require("../utils/date");
const rt = require("../services/realtime.service");
const emergencyCtrl = require("./emergency.controller");

/** POST /api/v1/scans/verify — verify a token (POST-only for security) */
async function verifyToken(req, res) {
  // Emergency lockdown check
  const emergency = await emergencyCtrl.getState();
  if (emergency && emergency.active) {
    rt.emit(rt.events.ALERT_NEW, { level: "critical", text: "Scan blocked: Emergency lockdown active" });
    return fail(res, "ACCESS TEMPORARILY DISABLED — Emergency lockdown is active", 403);
  }

  const token = req.body.token || "";
  if (!token) return fail(res, "Token is required", 400);

  const tokenRow = await findActiveToken(token);
  if (!tokenRow) {
    await ScanLog.create({
      token,
      result: "not_found",
      resultText: "رمز غير صالح",
      scannedBy: req.sessionData?.username || "",
      gateName: req.sessionData?.gateName || ""
    });
    await logAction("scan_not_found", req.sessionData, { details: `Token: ${token}` });
    return fail(res, "Token not found or disabled", 404);
  }

  const permit = await Permit.findOne({ permitId: tokenRow.permitId }).lean();
  if (!permit) {
    return fail(res, "Permit not found for this token", 404);
  }

  const validity = computePermitValidity(
    permit.startDate, permit.endDate,
    permit.statusArabic, permit.paymentArabic
  );

  // Check watchlist
  const watchlistHits = await Watchlist.find({
    status: "active",
    $or: [
      { type: "permit", value: permit.permitId },
      { type: "vehicle", value: permit.carPlate },
      { type: "person", value: permit.tenant }
    ]
  }).lean();

  const scanResult = {
    ...mapPermitPayload(permit, tokenRow.token, { includePII: true }),
    watchlistAlert: watchlistHits.length > 0,
    watchlistHits: watchlistHits.map((w) => ({
      type: w.type,
      value: w.value,
      severity: w.severity,
      reason: w.reason
    }))
  };

  await ScanLog.create({
    token,
    permitId: permit.permitId,
    unit: permit.unit,
    tenant: permit.tenant,
    result: validity.validityClass,
    resultText: validity.validityText,
    scannedBy: req.sessionData?.username || "",
    gateName: req.sessionData?.gateName || "",
    gateLocation: req.sessionData?.gateLocation || "",
    watchlistAlert: watchlistHits.length > 0
  });

  await logAction("scan_completed", req.sessionData, {
    details: `Scanned ${permit.permitId}: ${validity.validityClass}`
  });

  // Realtime broadcast
  rt.emit(rt.events.SCAN_NEW, {
    permitId: permit.permitId, unit: permit.unit, tenant: permit.tenant,
    result: validity.validityClass, resultText: validity.validityText,
    scannedBy: req.sessionData?.username || "", gateName: req.sessionData?.gateName || "",
    watchlistAlert: watchlistHits.length > 0
  });

  if (watchlistHits.length > 0) {
    rt.emit(rt.events.ALERT_NEW, { level: "critical", text: `WATCHLIST HIT: ${permit.permitId} (${permit.tenant})` });
  }
  if (validity.validityClass === "invalid") {
    rt.emit(rt.events.ALERT_NEW, { level: "high", text: `Expired permit scanned: ${permit.permitId}` });
  }

  return success(res, scanResult);
}

/** GET /api/v1/scans — scan log history */
async function getLog(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const skip = (page - 1) * limit;

  const total = await ScanLog.countDocuments();
  const logs = await ScanLog.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return paginated(res, logs, total, page, limit);
}

/** GET /api/v1/scans/latest — latest scan for current session */
async function getLatest(req, res) {
  const scan = await ScanLog.findOne({
    scannedBy: req.sessionData?.username || ""
  }).sort({ createdAt: -1 }).lean();

  if (!scan) return success(res, null, "No scans yet");
  return success(res, scan);
}

module.exports = { verifyToken, getLog, getLatest };
