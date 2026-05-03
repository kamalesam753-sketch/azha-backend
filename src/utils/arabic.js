/**
 * Arabic text normalization and payment detection utilities.
 * Centralized — used by validity service, search, and controllers.
 */

function normalizeArabic(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function isUnpaid(paymentArabic) {
  const v = normalizeArabic(paymentArabic);
  return (
    v.includes("لم يتم الدفع") ||
    v.includes("غير مدفوع") ||
    v.includes("غير مسدد") ||
    v.includes("لم يتم السداد") ||
    v.includes("unpaid")
  );
}

module.exports = { normalizeArabic, isUnpaid };
