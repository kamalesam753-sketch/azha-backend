const fs = require("fs");

const p = "server.js";
let s = fs.readFileSync(p, "utf8");

if (!s.includes('const path = require("path");') && !s.includes("const path = require('path');")) {
  if (s.includes('const fs = require("fs");')) {
    s = s.replace('const fs = require("fs");', 'const fs = require("fs");\nconst path = require("path");');
  } else if (s.includes("const fs = require('fs');")) {
    s = s.replace("const fs = require('fs');", "const fs = require('fs');\nconst path = require('path');");
  } else {
    s = 'const fs = require("fs");\nconst path = require("path");\n' + s;
  }
}

fs.writeFileSync(p, s, "utf8");
console.log("✅ Added missing path import.");
