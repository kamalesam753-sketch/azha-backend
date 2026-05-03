/**
 * Permit service — business logic for permit operations.
 */
const Permit = require("../models/Permit");
const { computePermitValidity } = require("./validity.service");
const { ensureToken } = require("./token.service");
const { toDateKey } = require("../utils/date");
const { sanitizeRegex } = require("../utils/sanitize");

/**
 * Build the public payload for a permit (used in API responses).
 * NOTE: Does NOT include PII fields for public/client endpoints.
 */
function mapPermitPayload(permit, secureToken, options) {
  const includePII = options && options.includePII;
  const validity = computePermitValidity(
    permit.startDate || "",
    permit.endDate || "",
    permit.statusArabic || "",
    permit.paymentArabic || ""
  );

  const payload = {
    permitId: permit.permitId || "",
    unit: permit.unit || "",
    tenant: permit.tenant || "",
    tenantCount: permit.tenantCount || "",
    startDate: toDateKey(permit.startDate || "") || "",
    endDate: toDateKey(permit.endDate || "") || "",
    paymentArabic: permit.paymentArabic || "",
    statusArabic: validity.validityText,
    validityClass: validity.validityClass,
    validityText: validity.validityText,
    validityNote: validity.validityNote,
    secureToken: secureToken || "",
    token: secureToken || ""
  };

  if (includePII) {
    payload.ownerName = permit.ownerName || "";
    payload.phone = permit.phone || "";
    payload.carPlate = permit.carPlate || "";
  }

  return payload;
}

/**
 * Search permits by text query across multiple fields.
 */
async function searchPermits(queryText, limit) {
  const q = String(queryText || "").trim();
  if (!q) return [];

  const safeQ = sanitizeRegex(q);
  const regex = new RegExp(safeQ, "i");

  const rows = await Permit.find({
    $or: [
      { permitId: regex },
      { unit: regex },
      { tenant: regex },
      { phone: regex },
      { carPlate: regex }
    ]
  })
    .sort({ updatedAt: -1 })
    .limit(Math.min(limit || 50, 100))
    .lean();

  const result = [];
  for (const p of rows) {
    const tokenRow = await ensureToken(p.permitId);
    result.push({
      ...mapPermitPayload(p, tokenRow.token, { includePII: true }),
      token: tokenRow.token
    });
  }

  return result;
}

/**
 * Generate a unique permit ID.
 */
function generatePermitId() {
  return "AZH-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7).toUpperCase();
}

module.exports = { mapPermitPayload, searchPermits, generatePermitId };
