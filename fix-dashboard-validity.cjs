const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

s = s.replace(
/return\s+permits\s*;/,
`return permits.map(p => {
  const validity = computePermitValidity(
    p.startDate || "",
    p.endDate || "",
    p.statusArabic || "",
    p.paymentArabic || ""
  );

  return {
    ...p,
    statusArabic: validity.computedStatusArabic,
    validityClass: validity.validityClass,
    validityText: validity.validityText,
    validityNote: validity.validityNote
  };
});`
);

fs.writeFileSync("server.js", s, "utf8");
console.log("FORCED DASHBOARD TO USE DYNAMIC VALIDITY");
