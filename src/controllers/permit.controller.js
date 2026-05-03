/**
 * Permit controller — CRUD + search + client card.
 */
const Permit = require("../models/Permit");
const { success, fail, paginated } = require("../utils/response");
const { computePermitValidity } = require("../services/validity.service");
const { ensureToken, disableToken, regenerateToken } = require("../services/token.service");
const { mapPermitPayload, searchPermits: searchSvc, generatePermitId } = require("../services/permit.service");
const { logAction } = require("../services/audit.service");
const { toDateKey } = require("../utils/date");
const rt = require("../services/realtime.service");

/** GET /api/v1/permits — list all permits (admin) */
async function getAll(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const total = await Permit.countDocuments();
  const rows = await Permit.find()
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const list = [];
  for (const p of rows) {
    const tokenRow = await ensureToken(p.permitId);
    list.push(mapPermitPayload(p, tokenRow.token, { includePII: true }));
  }

  return paginated(res, list, total, page, limit);
}

/** POST /api/v1/permits — create permit */
async function create(req, res) {
  const {
    unit, tenant, tenantCount, startDate, endDate,
    phone, carPlate, paymentArabic, statusArabic, ownerName
  } = req.body;

  if (!unit || !tenant || !startDate || !endDate) {
    return fail(res, "unit, tenant, startDate, and endDate are required", 400);
  }

  const permitId = generatePermitId();

  const permit = await Permit.create({
    permitId,
    unit, tenant, tenantCount: tenantCount || "",
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
    phone: phone || "", carPlate: carPlate || "",
    paymentArabic: paymentArabic || "تم الدفع",
    statusArabic: statusArabic || "ساري",
    ownerName: ownerName || ""
  });

  const tokenRow = await ensureToken(permit.permitId);

  await logAction("permit_created", req.sessionData, {
    details: `Created permit ${permitId} for ${unit}`
  });

  return success(res, mapPermitPayload(permit, tokenRow.token, { includePII: true }), "Permit created", 201);
}

/** PUT /api/v1/permits/:id — update permit */
async function update(req, res) {
  const permit = await Permit.findOne({
    $or: [
      { permitId: req.params.id },
      { _id: isObjectId(req.params.id) ? req.params.id : null }
    ]
  });

  if (!permit) return fail(res, "Permit not found", 404);

  const fields = ["unit", "tenant", "tenantCount", "startDate", "endDate", "phone", "carPlate", "paymentArabic", "statusArabic", "ownerName"];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      permit[f] = f.includes("Date") ? toDateKey(req.body[f]) : req.body[f];
    }
  }

  await permit.save();
  const tokenRow = await ensureToken(permit.permitId);

  await logAction("permit_updated", req.sessionData, { details: `Updated ${permit.permitId}` });

  return success(res, mapPermitPayload(permit, tokenRow.token, { includePII: true }), "Permit updated");
}

/** DELETE /api/v1/permits/:id — delete permit */
async function remove(req, res) {
  const result = await Permit.deleteOne({
    $or: [
      { permitId: req.params.id },
      { _id: isObjectId(req.params.id) ? req.params.id : null }
    ]
  });

  if (result.deletedCount === 0) return fail(res, "Permit not found", 404);

  await disableToken(req.params.id, req.sessionData?.username || "");
  await logAction("permit_deleted", req.sessionData, { details: `Deleted ${req.params.id}` });

  return success(res, null, "Permit deleted");
}

/** GET /api/v1/permits/search?q= — search permits */
async function search(req, res) {
  const results = await searchSvc(req.query.q, Number(req.query.limit) || 50);
  return success(res, results);
}

/** POST /api/v1/permits/:id/token — generate/regenerate client token */
async function generateToken(req, res) {
  const permit = await Permit.findOne({
    $or: [
      { permitId: req.params.id },
      { _id: isObjectId(req.params.id) ? req.params.id : null }
    ]
  });

  if (!permit) return fail(res, "Permit not found", 404);

  const tokenRow = await regenerateToken(permit.permitId);

  await logAction("token_generated", req.sessionData, { details: `Token for ${permit.permitId}` });

  return success(res, { permitId: permit.permitId, token: tokenRow.token, secureToken: tokenRow.token });
}

/** POST /api/v1/permits/:id/revoke — emergency revoke */
async function revokePermit(req, res) {
  const permit = await Permit.findOne({
    $or: [
      { permitId: req.params.id },
      { _id: isObjectId(req.params.id) ? req.params.id : null }
    ]
  });

  if (!permit) return fail(res, "Permit not found", 404);

  permit.statusArabic = "ملغي";
  await permit.save();
  await disableToken(permit.permitId, req.sessionData?.username || "");

  await logAction("permit_revoked", req.sessionData, { details: `Revoked ${permit.permitId}` });

  rt.emit(rt.events.PERMIT_REVOKED, { permitId: permit.permitId, unit: permit.unit, revokedBy: req.sessionData?.username || "" });
  rt.emit(rt.events.ALERT_NEW, { level: "high", text: `Permit ${permit.permitId} REVOKED by ${req.sessionData?.username || "admin"}` });

  return success(res, null, "Permit revoked and token disabled");
}

/** GET /api/v1/permits/client?token= — PUBLIC client card endpoint */
async function getClientCard(req, res) {
  const { findActiveToken } = require("../services/token.service");
  const token = req.query.token || "";

  if (!token) return fail(res, "Token is required", 400);

  const tokenRow = await findActiveToken(token);
  if (!tokenRow) return fail(res, "Invalid or disabled token", 404);

  const permit = await Permit.findOne({ permitId: tokenRow.permitId }).lean();
  if (!permit) return fail(res, "Permit not found", 404);

  // PII-SAFE: no phone, no carPlate for public endpoint
  const payload = mapPermitPayload(permit, tokenRow.token, { includePII: false });
  return success(res, payload);
}

function isObjectId(v) {
  return /^[a-f0-9]{24}$/.test(String(v || ""));
}

module.exports = { getAll, create, update, remove, search, generateToken, revokePermit, getClientCard };
