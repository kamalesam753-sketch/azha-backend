const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

s = s.replace(
/startDate:\s*permit\.startDate\s*\?\s*new Date\(permit\.startDate\)\.toISOString\(\)\.slice\(0,10\)\s*:\s*""/g,
`startDate: dateKey(permit.startDate || "") || ""`
);

s = s.replace(
/endDate:\s*permit\.endDate\s*\?\s*new Date\(permit\.endDate\)\.toISOString\(\)\.slice\(0,10\)\s*:\s*""/g,
`endDate: dateKey(permit.endDate || "") || ""`
);

fs.writeFileSync("server.js", s, "utf8");
console.log("Fixed backend 500 caused by unsafe date conversion.");
