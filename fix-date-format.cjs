const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

/* 🔥 نحول كل التواريخ لـ ISO */
s = s.replace(
/startDate:\s*permit\.startDate\s*\|\|\s*""/g,
`startDate: permit.startDate ? new Date(permit.startDate).toISOString().slice(0,10) : ""`
);

s = s.replace(
/endDate:\s*permit\.endDate\s*\|\|\s*""/g,
`endDate: permit.endDate ? new Date(permit.endDate).toISOString().slice(0,10) : ""`
);

fs.writeFileSync("server.js",s,"utf8");
console.log("🔥 DATE FORMAT FIXED TO ISO (YYYY-MM-DD)");
