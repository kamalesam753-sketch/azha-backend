const fs = require("fs");
let s = fs.readFileSync("server.js","utf8");

/* 🔥 دالة parsing صح لـ DD/MM/YYYY */
if (!s.includes("function parseDMY")) {
s = `
function parseDMY(dateStr){
  if(!dateStr) return null;
  const parts = String(dateStr).split("/");
  if(parts.length !== 3) return null;

  const [d,m,y] = parts.map(Number);
  if(!d || !m || !y) return null;

  return new Date(y, m-1, d);
}
` + s;
}

/* 🔥 استخدمها بدل new Date */
s = s.replace(
/new Date\(permit\.startDate\)/g,
"parseDMY(permit.startDate)"
);

s = s.replace(
/new Date\(permit\.endDate\)/g,
"parseDMY(permit.endDate)"
);

fs.writeFileSync("server.js",s,"utf8");
console.log("🔥 FIXED DATE PARSING (DD/MM/YYYY SAFE)");
