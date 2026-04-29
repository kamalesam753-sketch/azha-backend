const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

/* ❌ احذف computePermitStatus بالكامل */
s = s.replace(/function computePermitStatus[\s\S]*?\n}\n/, "");

/* ✅ خلي mapPermitPayload يعتمد 100% على computePermitValidity */
s = s.replace(
/function mapPermitPayload[\s\S]*?return\s*\{[\s\S]*?\};\n}/,
`function mapPermitPayload(permit, secureToken) {

  const validity = computePermitValidity(
    permit.startDate || "",
    permit.endDate || "",
    permit.statusArabic || "",
    permit.paymentArabic || ""
  );

  return {
    permitId: permit.permitId || "",
    unit: permit.unit || "",
    tenant: permit.tenant || "",
    tenantCount: permit.tenantCount || "",
    phone: permit.phone || "",
    carPlate: permit.carPlate || "",
    startDate: permit.startDate || "",
    endDate: permit.endDate || "",
    paymentArabic: permit.paymentArabic || "",

    /* 👇 ده المهم */
    statusArabic: validity.validityText,
    validityClass: validity.validityClass,
    validityText: validity.validityText,
    validityNote: validity.validityNote,

    token: secureToken || ""
  };
}`
);

fs.writeFileSync("server.js", s, "utf8");
console.log("🔥 FULL STATUS ENGINE CLEANED (NO LEGACY CONFLICT)");
