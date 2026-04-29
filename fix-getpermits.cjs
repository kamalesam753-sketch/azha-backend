const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

s = s.replace(
/case\s+["']getPermits["'][\s\S]*?break;/,
`case "getPermits": {
  const permits = await Permit.find({}).lean();

  return res.json({
    success: true,
    data: permits.map(p => {
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
    })
  });
}`
);

fs.writeFileSync("server.js", s, "utf8");
console.log("FORCED getPermits endpoint to use dynamic validity");
