/**
 * AZHA Permit Validity Engine — SINGLE SOURCE OF TRUTH.
 *
 * This is the ONE AND ONLY place where permit validity is computed.
 * All controllers, services, and API responses use this module.
 * No other file is allowed to duplicate this logic.
 */
const { toDateKey, todayCairo, addDays } = require("../utils/date");
const { isUnpaid } = require("../utils/arabic");

/**
 * Compute the validity status of a permit.
 *
 * @param {string} startDate - Permit start date (any parseable format)
 * @param {string} endDate - Permit end date (any parseable format)
 * @param {string} statusArabic - Original status text (unused for logic, kept for reference)
 * @param {string} paymentArabic - Payment status in Arabic
 * @returns {{ validityClass: string, validityText: string, validityNote: string }}
 */
function computePermitValidity(startDate, endDate, statusArabic, paymentArabic) {
  const start = toDateKey(startDate);
  const end = toDateKey(endDate);
  const today = todayCairo();
  const tomorrow = addDays(today, 1);

  let status = {
    validityClass: "warning",
    validityText: "غير محدد",
    validityNote: "Undefined dates"
  };

  if (start && end) {
    if (start === tomorrow) {
      status = { validityClass: "warning", validityText: "يبدأ غدًا", validityNote: "Starts tomorrow" };
    } else if (start > tomorrow) {
      status = { validityClass: "warning", validityText: "لم يبدأ", validityNote: "Not started yet" };
    } else if (end < today) {
      status = { validityClass: "invalid", validityText: "التصريح منتهي", validityNote: "Permit expired" };
    } else if (end === today) {
      status = { validityClass: "warning", validityText: "آخر يوم ساري", validityNote: "Last valid day" };
    } else {
      status = { validityClass: "valid", validityText: "صالح للدخول", validityNote: "Valid for entry" };
    }
  }

  if (isUnpaid(paymentArabic)) {
    return {
      validityClass: "warning",
      validityText: "مراجعة السداد",
      validityNote: "Payment review required"
    };
  }

  return status;
}

module.exports = { computePermitValidity };
