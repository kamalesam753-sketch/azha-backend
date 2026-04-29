const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

const engine = `
function toDateKey(value) {
  if (!value) return "";
  const raw = String(value).trim();
  let y, m, d;

  const iso = raw.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/);
  if (iso) {
    y = iso[1]; m = iso[2]; d = iso[3];
  } else {
    const dmY = raw.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/);
    if (dmY) {
      d = dmY[1]; m = dmY[2]; y = dmY[3];
    } else {
      const parsed = new Date(raw);
      if (isNaN(parsed)) return "";
      y = String(parsed.getFullYear());
      m = String(parsed.getMonth() + 1);
      d = String(parsed.getDate());
    }
  }

  return String(y).padStart(4, "0") + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function getTodayKey() {
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

function addDaysToKey(key, days) {
  const p = key.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computePermitStatus(startDate, endDate) {
  const start = toDateKey(startDate);
  const end = toDateKey(endDate);
  const today = getTodayKey();
  const tomorrow = addDaysToKey(today, 1);

  if (!start || !end) return { statusArabic: "غير محدد", statusEnglish: "Undefined", statusClass: "warning" };
  if (start === tomorrow) return { statusArabic: "يبدأ غدًا", statusEnglish: "Starts tomorrow", statusClass: "warning" };
  if (start > tomorrow) return { statusArabic: "لم يبدأ", statusEnglish: "Not started", statusClass: "warning" };
  if (start === today) return { statusArabic: "ساري", statusEnglish: "Active", statusClass: "valid" };
  if (end === today) return { statusArabic: "آخر يوم ساري", statusEnglish: "Last valid day", statusClass: "warning" };
  if (end < today) return { statusArabic: "انتهى", statusEnglish: "Expired", statusClass: "invalid" };

  return { statusArabic: "ساري", statusEnglish: "Active", statusClass: "valid" };
}

function computePermitValidity(startDate, endDate, statusArabic, paymentArabic) {
  const status = computePermitStatus(startDate, endDate);

  if (isUnpaid(paymentArabic)) {
    return {
      validityClass: "warning",
      validityText: "مراجعة السداد",
      validityNote: "Payment review required",
      computedStatusArabic: status.statusArabic,
      computedStatusEnglish: status.statusEnglish
    };
  }

  return {
    validityClass: status.statusClass,
    validityText: status.statusArabic,
    validityNote: status.statusEnglish,
    computedStatusArabic: status.statusArabic,
    computedStatusEnglish: status.statusEnglish
  };
}
`;

s = s.replace(/function computePermitValidity[\s\S]*?\n}\n/, engine + "\n");

s = s.replace(/function mapPermitPayload\(permit, secureToken\) \{[\s\S]*?\n}\n/, `function mapPermitPayload(permit, secureToken) {
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
    statusArabic: validity.computedStatusArabic || "",
    paymentArabic: permit.paymentArabic || "",
    validityClass: validity.validityClass || "",
    validityText: validity.validityText || "",
    validityNote: validity.validityNote || "",
    startDate: permit.startDate || "",
    endDate: permit.endDate || "",
    secureToken: secureToken || "",
    clientUrl: buildClientUrl(secureToken)
  };
}
`);

fs.writeFileSync("server.js", s, "utf8");
console.log("VALIDITY ENGINE FORCE REPLACED");
