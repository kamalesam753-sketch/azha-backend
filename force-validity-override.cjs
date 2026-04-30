const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

s = s.replace(/\/\* ===== AZHA FORCE VALIDITY OVERRIDE ===== \*\/[\s\S]*?\/\* ===== END AZHA FORCE VALIDITY OVERRIDE ===== \*\//g, "");

const block = `

/* ===== AZHA FORCE VALIDITY OVERRIDE ===== */
function azhaDateKey(value) {
  if (!value) return "";

  const raw = String(value).trim();
  let y, m, d;

  let iso = raw.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/);
  if (iso) {
    y = iso[1];
    m = iso[2];
    d = iso[3];
  } else {
    let dmy = raw.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/);
    if (dmy) {
      d = dmy[1];
      m = dmy[2];
      y = dmy[3];
    } else {
      return "";
    }
  }

  return String(y).padStart(4, "0") + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function azhaTodayCairoKey() {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  return azhaDateKey(formatted);
}

function azhaAddDaysKey(key, days) {
  const p = key.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

computePermitValidity = function (startDate, endDate, statusArabic, paymentArabic) {
  const start = azhaDateKey(startDate);
  const end = azhaDateKey(endDate);
  const today = azhaTodayCairoKey();
  const tomorrow = azhaAddDaysKey(today, 1);

  let result;

  if (!start || !end) {
    result = {
      validityClass: "warning",
      validityText: "غير محدد",
      validityNote: "Undefined dates"
    };
  } else if (start === tomorrow) {
    result = {
      validityClass: "warning",
      validityText: "يبدأ غدًا",
      validityNote: "Starts tomorrow"
    };
  } else if (start > tomorrow) {
    result = {
      validityClass: "warning",
      validityText: "لم يبدأ",
      validityNote: "Not started yet"
    };
  } else if (end < today) {
    result = {
      validityClass: "invalid",
      validityText: "التصريح منتهي",
      validityNote: "Permit expired"
    };
  } else if (end === today) {
    result = {
      validityClass: "warning",
      validityText: "آخر يوم ساري",
      validityNote: "Last valid day"
    };
  } else {
    result = {
      validityClass: "valid",
      validityText: "صالح للدخول",
      validityNote: "Valid for entry"
    };
  }

  if (typeof isUnpaid === "function" && isUnpaid(paymentArabic)) {
    return {
      validityClass: "warning",
      validityText: "مراجعة السداد",
      validityNote: "Payment review required",
      computedStatusArabic: result.validityText,
      computedStatusEnglish: result.validityNote
    };
  }

  return {
    validityClass: result.validityClass,
    validityText: result.validityText,
    validityNote: result.validityNote,
    computedStatusArabic: result.validityText,
    computedStatusEnglish: result.validityNote
  };
};
/* ===== END AZHA FORCE VALIDITY OVERRIDE ===== */
`;

s += block;

fs.writeFileSync("server.js", s, "utf8");
console.log("AZHA forced validity override installed.");
