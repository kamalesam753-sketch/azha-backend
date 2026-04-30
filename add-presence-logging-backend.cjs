const fs = require("fs");

const p = "server.js";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("AZHA_PRESENCE_LOGGING")) {
  const block = `

// AZHA_PRESENCE_LOGGING
const presenceLogPath = path.join(__dirname, "data", "presence-log.json");

function readPresenceLog() {
  try {
    return JSON.parse(fs.readFileSync(presenceLogPath, "utf8"));
  } catch (e) {
    return [];
  }
}

function writePresenceLog(list) {
  fs.mkdirSync(path.dirname(presenceLogPath), { recursive: true });
  fs.writeFileSync(presenceLogPath, JSON.stringify(list || [], null, 2), "utf8");
}

app.get("/api/presence", function(req, res) {
  const token = String(req.query.token || "").trim();
  const permitId = String(req.query.permitId || "").trim();

  const list = readPresenceLog().filter(x =>
    (token && x.token === token) || (permitId && x.permitId === permitId)
  );

  res.json({ success: true, data: list });
});

app.post("/api/presence", express.json(), function(req, res) {
  const body = req.body || {};
  const now = new Date().toISOString();

  const entry = {
    timestamp: now,
    token: String(body.token || ""),
    permitId: String(body.permitId || ""),
    unit: String(body.unit || ""),
    guestName: String(body.guestName || ""),
    present: !!body.present,
    action: body.present ? "guest_present" : "guest_unmarked",
    sessionToken: String(body.sessionToken || ""),
    securityUsername: String(body.securityUsername || ""),
    gateName: String(body.gateName || ""),
    source: "scanner_presence"
  };

  const list = readPresenceLog();
  list.push(entry);
  writePresenceLog(list);

  res.json({ success: true, data: entry });
});
`;

  const idx = s.search(/app\.listen\s*\(/);
  if (idx === -1) throw new Error("app.listen not found");

  s = s.slice(0, idx) + block + "\n" + s.slice(idx);
  fs.writeFileSync(p, s, "utf8");
}

console.log("✅ Backend presence logging endpoint added.");
