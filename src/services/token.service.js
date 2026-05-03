/**
 * Token management service.
 * Handles secure token generation, lookup, and management for permits.
 */
const crypto = require("crypto");
const PermitToken = require("../models/PermitToken");

/**
 * Ensure a permit has a token. Creates one if it doesn't exist.
 */
async function ensureToken(permitId) {
  let tokenRow = await PermitToken.findOne({ permitId });

  if (!tokenRow) {
    tokenRow = await PermitToken.create({
      permitId,
      token: "AZHASEC-" + crypto.randomUUID(),
      status: "active"
    });
  }

  return tokenRow;
}

/**
 * Disable a token immediately (emergency revoke).
 */
async function disableToken(permitId, disabledBy) {
  return PermitToken.updateMany(
    { permitId, status: "active" },
    { status: "disabled", disabledBy: disabledBy || "" }
  );
}

/**
 * Regenerate a token for a permit (revoke old, create new).
 */
async function regenerateToken(permitId) {
  await PermitToken.updateMany({ permitId }, { status: "disabled" });

  return PermitToken.create({
    permitId,
    token: "AZHASEC-" + crypto.randomUUID(),
    status: "active",
    regeneratedAt: new Date()
  });
}

/**
 * Find an active token by its value.
 */
async function findActiveToken(token) {
  return PermitToken.findOne({ token, status: "active" }).lean();
}

module.exports = { ensureToken, disableToken, regenerateToken, findActiveToken };
