const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

/* 🔥 امسح أي computePermitValidity قديم */
s = s.replace(/function\s+computePermitValidity[\s\S]*?\n}\n/g, "");

/* 🔥 احقن النسخة النهائية في أول الملف */
const cleanEngine = `

/* ===== AZHA FINAL VALIDITY ENGINE ===== */
function azhaDateKey(value) {
  if (!value) return "";

  const raw = String(value).trim();
  let y, m, d;

  let iso = raw.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/);
  if (iso) {
    y = iso[1]; m = iso[2]; d = iso[3];
  } else {
    let dmy = raw.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/);
    if (!dmy) return "";
    d = dmy[1]; m = dmy[2]; y = dmy[3];
  }

  return y + "-" + m.padStart(2,"0") + "-" + d.padStart(2,"0");
}

function todayKey() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date()).split("/").reverse().join("-");
}

function addDays(key, days) {
  const [y,m,d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y,m-1,d));
  dt.setUTCDate(dt.getUTCDate()+days);
  return dt.toISOString().slice(0,10);
}

function computePermitValidity(startDate, endDate, statusArabic, paymentArabic) {
  const start = azhaDateKey(startDate);
  const end = azhaDateKey(endDate);
  const today = todayKey();
  const tomorrow = addDays(today,1);

  if (!start || !end) {
    return { validityClass:"warning", validityText:"غير محدد", validityNote:"Undefined" };
  }

  if (start > today) {
    return { validityClass:"warning", validityText:"لم يبدأ", validityNote:"Not started" };
  }

  if (end < today) {
    return { validityClass:"invalid", validityText:"التصريح منتهي", validityNote:"Expired" };
  }

  if (end === today) {
    return { validityClass:"warning", validityText:"آخر يوم ساري", validityNote:"Last day" };
  }

  return { validityClass:"valid", validityText:"صالح للدخول", validityNote:"Valid" };
}
/* ===== END ENGINE ===== */

`;

s = cleanEngine + s;

fs.writeFileSync("server.js", s, "utf8");
console.log("🔥 CLEAN VALIDITY ENGINE INSTALLED (NO CONFLICT)");
