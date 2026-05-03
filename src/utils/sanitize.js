/**
 * Input sanitization utilities.
 */

function sanitizeRegex(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeString(value, maxLength) {
  const s = String(value || "").trim();
  return maxLength ? s.substring(0, maxLength) : s;
}

module.exports = { sanitizeRegex, sanitizeString };
