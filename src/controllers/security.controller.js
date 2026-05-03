/**
 * Security actions controller — decision registration (approve/reject/review).
 */
const SecurityAction = require("../models/SecurityAction");
const { success, fail, paginated } = require("../utils/response");
const { logAction } = require("../services/audit.service");

const VALID_DECISIONS = ["approved", "rejected", "review_required", "payment_issue", "security_note"];

/** POST /api/v1/security/decisions — register a security decision */
async function submitDecision(req, res) {
  const { decision, permitId, notes } = req.body;

  if (!decision || !VALID_DECISIONS.includes(decision)) {
    return fail(res, `Invalid decision. Must be one of: ${VALID_DECISIONS.join(", ")}`, 400);
  }

  const action = await SecurityAction.create({
    decision,
    permitId: permitId || "",
    notes: notes || "",
    username: req.sessionData?.username || "",
    role: req.sessionData?.role || "",
    gateName: req.sessionData?.gateName || "",
    gateLocation: req.sessionData?.gateLocation || ""
  });

  await logAction("security_decision", req.sessionData, {
    details: `${decision} on ${permitId || "no-permit"}`
  });

  return success(res, action, "Decision registered", 201);
}

/** GET /api/v1/security/decisions — list security decisions */
async function getDecisions(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const skip = (page - 1) * limit;

  const total = await SecurityAction.countDocuments();
  const rows = await SecurityAction.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return paginated(res, rows, total, page, limit);
}

module.exports = { submitDecision, getDecisions };
