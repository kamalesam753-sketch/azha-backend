/**
 * Centralized date utilities.
 * ALL date logic in the system goes through this module.
 * Uses Cairo timezone for all date comparisons.
 */

/**
 * Convert any date input to YYYY-MM-DD key string.
 */
function toDateKey(value) {
  if (!value) return "";
  const raw = String(value).trim();

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return pad(iso[1]) + "-" + pad(iso[2]) + "-" + pad(iso[3]);
  }

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    return pad(dmy[3]) + "-" + pad(dmy[2]) + "-" + pad(dmy[1]);
  }

  const parsed = new Date(raw);
  if (isNaN(parsed)) return "";
  return (
    pad(parsed.getFullYear()) +
    "-" +
    pad(parsed.getMonth() + 1) +
    "-" +
    pad(parsed.getDate())
  );
}

/**
 * Get today's date key in Cairo timezone.
 */
function todayCairo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const map = {};
  parts.forEach((p) => {
    if (p.type !== "literal") map[p.type] = p.value;
  });

  return map.year + "-" + map.month + "-" + map.day;
}

/**
 * Add days to a YYYY-MM-DD key and return new key.
 */
function addDays(key, days) {
  const p = key.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Start of today (local server time).
 */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * End of today (local server time).
 */
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Format a date value for display.
 */
function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

function pad(v) {
  return String(v).padStart(2, "0");
}

module.exports = {
  toDateKey,
  todayCairo,
  addDays,
  startOfToday,
  endOfToday,
  formatDateTime
};
