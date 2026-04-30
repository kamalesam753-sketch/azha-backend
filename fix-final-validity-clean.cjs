const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

/* 🔥 1. امسح كل computePermitValidity */
s = s.replace(/function\s+computePermitValidity[\s\S]*?\n}\n/g, "");

/* 🔥 2. امسح أي override في آخر الملف */
s = s.replace(/\/\* ===== AZHA FORCE VALIDITY OVERRIDE ===== \*\/[\s\S]*?END AZHA FORCE VALIDITY OVERRIDE ===== \*\//g, "");

/* 🔥 3. احقن نسخة واحدة نظيفة */

const clean = `

/* ===== AZHA FINAL VALIDITY ENGINE (SINGLE SOURCE OF TRUTH) ===== */
function computePermitValidity(startDate, endDate, statusArabic, paymentArabic) {

  const start = dateKey(startDate);
  const end = dateKey(endDate);
  const today = todayCairoKey();

  if (!start || !end) {
    return { validityClass:"warning", validityText:"غير محدد", validityNote:"Undefined" };
  }

  if (start > today) {
    return { validityClass:"warning", validityText:"لم يبدأ", validityNote:"Not started yet" };
  }

  if (end < today) {
    return { validityClass:"invalid", validityText:"التصريح منتهي", validityNote:"Expired" };
  }

  if (end === today) {
    return { validityClass:"warning", validityText:"آخر يوم ساري", validityNote:"Last day" };
  }

  return { validityClass:"valid", validityText:"صالح للدخول", validityNote:"Valid for entry" };
}
/* ===== END ENGINE ===== */

`;

s = clean + s;

fs.writeFileSync("server.js", s, "utf8");
console.log("🔥 CLEAN SINGLE VALIDITY ENGINE APPLIED");

