const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

/* 🔥 خلي getClientPermit يعتمد مباشرة على computePermitValidity */

s = s.replace(
/return\s+res\.json\(\{\s*success:\s*true,\s*data:\s*mapPermitPayload\([\s\S]*?\)\s*\}\);/,
`const payload = mapPermitPayload(permit, secureToken);

const validity = computePermitValidity(
  payload.startDate,
  payload.endDate,
  payload.statusArabic,
  payload.paymentArabic
);

payload.validityClass = validity.validityClass;
payload.validityText = validity.validityText;
payload.validityNote = validity.validityNote;
payload.statusArabic = validity.validityText;

return res.json({ success: true, data: payload });`
);

fs.writeFileSync("server.js", s, "utf8");
console.log("🔥 FORCED getClientPermit to use computePermitValidity");

