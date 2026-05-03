/**
 * Watchlist controller.
 */
const Watchlist = require("../models/Watchlist");
const { success, fail, paginated } = require("../utils/response");
const { logAction } = require("../services/audit.service");
const rt = require("../services/realtime.service");

async function getAll(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  const total = await Watchlist.countDocuments(filter);
  const rows = await Watchlist.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  return paginated(res, rows, total, page, limit);
}

async function create(req, res) {
  const { type, value, reason, severity, notes } = req.body;
  if (!type || !value) return fail(res, "type and value are required", 400);
  const entry = await Watchlist.create({
    type, value, reason: reason || "", severity: severity || "medium",
    notes: notes || "", addedBy: req.sessionData?.username || "", status: "active"
  });
  await logAction("watchlist_added", req.sessionData, { details: `${type}: ${value}` });
  rt.emit(rt.events.WATCHLIST_NEW, { type, value, severity: severity || "medium", reason: reason || "" });
  rt.emit(rt.events.ALERT_NEW, { level: severity === "critical" ? "critical" : "high", text: `Watchlist: ${type} "${value}" added` });
  return success(res, entry, "Added to watchlist", 201);
}

async function resolve(req, res) {
  const entry = await Watchlist.findById(req.params.id);
  if (!entry) return fail(res, "Watchlist entry not found", 404);
  entry.status = "resolved";
  entry.resolvedBy = req.sessionData?.username || "";
  entry.resolvedAt = new Date();
  await entry.save();
  await logAction("watchlist_resolved", req.sessionData, { details: `${entry.type}: ${entry.value}` });
  rt.emit(rt.events.WATCHLIST_RESOLVED, { type: entry.type, value: entry.value });
  return success(res, entry, "Watchlist entry resolved");
}

async function remove(req, res) {
  const result = await Watchlist.deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) return fail(res, "Entry not found", 404);
  await logAction("watchlist_deleted", req.sessionData, { details: `Deleted ${req.params.id}` });
  return success(res, null, "Watchlist entry deleted");
}

module.exports = { getAll, create, resolve, remove };
