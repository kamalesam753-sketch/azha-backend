const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

function replaceFunction(src, name, replacement) {
  const marker = "function " + name + "(";
  const start = src.indexOf(marker);
  if (start === -1) throw new Error("Function not found: " + name);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") depth--;
    if (depth === 0) return src.slice(0, start) + replacement + src.slice(i + 1);
  }
  throw new Error("Function end not found: " + name);
}

const engine = `
function dateKey(value) {
  if (!value) return "";
  const raw = String(value).trim();
  let y, m, d;

  let a = raw.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/);
  if (a) {
    y = a[1]; m = a[2]; d = a[3];
  } else {
    a = raw.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/);
    if (a) {
      d = a[1]; m = a[2]; y = a[3];
    } else {
      const parsed = new Date(raw);
      if (isNaN(parsed)) return "";
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
    }
  }

  return String(y).padStart(4, "0") + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function todayCairoKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const map = {};
  parts.forEach(p => {
    if (p.type !== "literal") map[p.type] = p.value;
  });

  return map.year + "-" + map.month + "-" + map.day;
}

function addDaysKey(key, days) {
  const p = key.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computePermitValidity(startDate, endDate, statusArabic, paymentArabic) {
  const start = dateKey(startDate);
  const end = dateKey(endDate);
  const today = todayCairoKey();
  const tomorrow = addDaysKey(today, 1);

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
      validityNote: "Payment review required",
      computedStatusArabic: status.validityText,
      computedStatusEnglish: status.validityNote
    };
  }

  return {
    validityClass: status.validityClass,
    validityText: status.validityText,
    validityNote: status.validityNote,
    computedStatusArabic: status.validityText,
    computedStatusEnglish: status.validityNote
  };
}
`;

s = s.replace(/function dateKey[\s\S]*?function computePermitValidity[\s\S]*?\n}\n/g, "");
s = replaceFunction(s, "computePermitValidity", engine.trim());

s = replaceFunction(s, "mapPermitPayload", `function mapPermitPayload(permit, secureToken) {
  const validity = computePermitValidity(
    permit.startDate || "",
    permit.endDate || "",
    permit.statusArabic || "",
    permit.paymentArabic || ""
  );

  return {
    permitId: permit.permitId || "",
    unit: permit.unit || "",
    ownerName: permit.ownerName || "",
    tenant: permit.tenant || "",
    tenantCount: permit.tenantCount || "",
    phone: permit.phone || "",
    carPlate: permit.carPlate || "",
    startDate: permit.startDate || "",
    endDate: permit.endDate || "",
    paymentArabic: permit.paymentArabic || "",
    statusArabic: validity.validityText,
    validityClass: validity.validityClass,
    validityText: validity.validityText,
    validityNote: validity.validityNote,
    secureToken: secureToken || "",
    token: secureToken || "",
    clientUrl: typeof buildClientUrl === "function" ? buildClientUrl(secureToken) : ""
  };
}`);

fs.writeFileSync("server.js", s, "utf8");
console.log("AZHA backend validity engine fixed permanently.");
