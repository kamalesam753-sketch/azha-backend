/**
 * Presence controller — MongoDB-backed presence tracking.
 */
const PresenceLog = require("../models/PresenceLog");
const { success, fail, paginated } = require("../utils/response");
const rt = require("../services/realtime.service");

/** GET /api/v1/presence — list presence logs */
async function getAll(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.gateName) filter.gateName = req.query.gateName;
  if (req.query.present !== undefined) filter.present = req.query.present === "true";

  const total = await PresenceLog.countDocuments(filter);
  const logs = await PresenceLog.find(filter)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return paginated(res, logs, total, page, limit);
}

/** POST /api/v1/presence — log presence event */
async function create(req, res) {
  const { guestName, permitId, unit, tenant, present } = req.body;

  if (!permitId) return fail(res, "permitId is required", 400);

  const log = await PresenceLog.create({
    guestName: guestName || "",
    permitId,
    unit: unit || "",
    tenant: tenant || "",
    gateName: req.sessionData?.gateName || req.body.gateName || "",
    gateLocation: req.sessionData?.gateLocation || req.body.gateLocation || "",
    securityUsername: req.sessionData?.username || "",
    present: present !== false,
    timestamp: new Date()
  });

  rt.emit(rt.events.PRESENCE_UPDATE, {
    guestName: guestName || "", permitId, unit: unit || "",
    present: present !== false, gateName: req.sessionData?.gateName || ""
  });

  return success(res, log, "Presence logged", 201);
}

module.exports = { getAll, create };
