

/* ===== AZHA FINAL VALIDITY ENGINE ===== */
function azhaDateKey(value) {
  if (!value) return "";

  const raw = String(value).trim();
  let y, m, d;

  let iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    y = iso[1]; m = iso[2]; d = iso[3];
  } else {
    let dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dmy) return "";
    d = dmy[1]; m = dmy[2]; y = dmy[3];
  }

  return y + "-" + m.padStart(2,"0") + "-" + d.padStart(2,"0");
}

function todayKey() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date()).split("/").reverse().join("-");
}

function addDays(key, days) {
  const [y,m,d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y,m-1,d));
  dt.setUTCDate(dt.getUTCDate()+days);
  return dt.toISOString().slice(0,10);
}

function computePermitValidity(startDate, endDate, statusArabic, paymentArabic) {
  const start = azhaDateKey(startDate);
  const end = azhaDateKey(endDate);
  const today = todayKey();
  const tomorrow = addDays(today,1);

  if (!start || !end) {
    return { validityClass:"warning", validityText:"غير محدد", validityNote:"Undefined" };
  }

  if (start > today) {
    return { validityClass:"warning", validityText:"لم يبدأ", validityNote:"Not started" };
  }

  if (end < today) {
    return { validityClass:"invalid", validityText:"التصريح منتهي", validityNote:"Expired" };
  }

  if (end === today) {
    return { validityClass:"warning", validityText:"آخر يوم ساري", validityNote:"Last day" };
  }

  return { validityClass:"valid", validityText:"صالح للدخول", validityNote:"Valid" };
}
/* ===== END ENGINE ===== */


function parseDMY(dateStr){
  if(!dateStr) return null;
  const parts = String(dateStr).split("/");
  if(parts.length !== 3) return null;

  const [d,m,y] = parts.map(Number);
  if(!d || !m || !y) return null;

  return new Date(y, m-1, d);
}
require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./src/config/db");

const authRoutes = require("./src/routes/auth.routes");

const Session = require("./src/models/Session");
const Permit = require("./src/models/Permit");
const ScanLog = require("./src/models/ScanLog");
const SecurityAction = require("./src/models/SecurityAction");
const AuditLog = require("./src/models/AuditLog");
const PermitToken = require("./src/models/PermitToken");
const SystemSetting = require("./src/models/SystemSetting");
const User = require("./src/models/User");
const Gate = require("./src/models/Gate");
const { hashPassword } = require("./src/utils/hash");
const { getRolePermissions } = require("./src/middleware/auth.middleware");

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

app.use(cors({
  origin: [
    process.env.FRONTEND_BASE_URL,
    "http://127.0.0.1:5500",
    "http://localhost:5500"
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json({ limit: "1mb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again shortly."
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later."
  }
});

app.use("/api", apiLimiter);

connectDB();

app.get("/api/ping", (req, res) => {
  res.json({
    success: true,
    message: "AZHA Backend is running"
  });
});

app.use("/api/auth", authRoutes);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function sanitizeRegex(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeArabic(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function isUnpaid(paymentArabic) {
  const v = normalizeArabic(paymentArabic);
  return (
    v.includes("لم يتم الدفع") ||
    v.includes("غير مدفوع") ||
    v.includes("غير مسدد") ||
    v.includes("لم يتم السداد") ||
    v.includes("unpaid")
  );
}

function requireRole(session, allowedRoles) {
  if (!session) return false;
  return Array.isArray(allowedRoles) && allowedRoles.includes(session.role);
}

async function auditAction(type, session, extra) {
  try {
    await AuditLog.create({
      actionType: type,
      username: session?.username || "",
      role: session?.role || "",
      gateName: session?.gateName || "",
      gateLocation: session?.gateLocation || "",
      ...(extra || {})
    });
  } catch (e) {
    console.error("Audit log error:", e.message);
  }
}

function validateString(val, name, minLen, maxLen) {
  const s = String(val || "").trim();
  if (minLen && s.length < minLen) return `${name} must be at least ${minLen} characters`;
  if (maxLen && s.length > maxLen) return `${name} must be at most ${maxLen} characters`;
  return null;
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

async function getSessionContext(token) {
  if (!token) return null;

  const session = await Session.findOne({
    sessionToken: token,
    status: "active",
    expiresAt: { $gt: new Date() }
  });

  if (!session) return null;

  session.lastActivity = new Date();
  await session.save();

  return session.toObject();
}

function buildScanQuery(q) {
  const query = {};

  if (q.dateFrom || q.dateTo) {
    query.timestamp = {};
    if (q.dateFrom) query.timestamp.$gte = new Date(q.dateFrom + "T00:00:00");
    if (q.dateTo) query.timestamp.$lte = new Date(q.dateTo + "T23:59:59");
  }

  if (q.gateName) query.gateName = q.gateName;
  if (q.permitId) query.permitId = new RegExp(sanitizeRegex(q.permitId), "i");
  if (q.validityClass) query.validityClass = q.validityClass;
  if (q.result) query.result = q.result;

  const tenant = q.tenant || q.unit || "";
  if (tenant) {
    const safeTenant = sanitizeRegex(tenant);
    query.$or = [
      { tenant: new RegExp(safeTenant, "i") },
      { unit: new RegExp(safeTenant, "i") }
    ];
  }

  return query;
}

function mapScan(row) {
  return {
    found: true,
    timestamp: formatDateTime(row.timestamp),
    permitId: row.permitId || "",
    gateName: row.gateName || "",
    gateLocation: row.gateLocation || "",
    securityUsername: row.securityUsername || "",
    role: row.role || "",
    mode: row.mode || "",
    tenant: row.tenant || "",
    unit: row.unit || "",
    statusArabic: row.statusArabic || "",
    paymentArabic: row.paymentArabic || "",
    validityClass: row.validityClass || "",
    validityText: row.validityText || "",
    result: row.result || "",
    durationMs: row.durationMs || ""
  };
}

function mapAudit(row) {
  return [
    formatDateTime(row.timestamp),
    row.actionType || "",
    row.permitId || "",
    row.token || "",
    row.result || "",
    row.validityClass || "",
    row.validityText || "",
    row.unit || "",
    row.tenant || "",
    row.statusArabic || "",
    row.paymentArabic || "",
    row.username || "",
    row.role || "",
    row.gateName || "",
    row.gateLocation || "",
    row.durationMs || "",
    row.details || ""
  ];
}

function mapAction(row) {
  return [
    formatDateTime(row.timestamp),
    row.permitId || "",
    row.decision || "",
    row.notes || "",
    row.username || "",
    row.fullName || "",
    row.role || "",
    row.gateName || "",
    row.gateLocation || ""
  ];
}

function buildClientUrl(token) {
  return `client.html?token=${encodeURIComponent(token || "")}`;
}


function toDateKey(value) {
  if (!value) return "";
  const raw = String(value).trim();
  let y, m, d;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    y = iso[1]; m = iso[2]; d = iso[3];
  } else {
    const dmY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
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


function dateKey(value) {
  if (!value) return "";
  const raw = String(value).trim();
  let y, m, d;

  let a = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (a) {
    y = a[1]; m = a[2]; d = a[3];
  } else {
    a = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (a) {
      d = a[1]; m = a[2]; y = a[3];
    } else {
      const parsed = new Date(raw);
      if (isNaN(parsed)) return "";
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
    }
  }

  return String(y).padStart(4, "0") + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function todayCairoKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const map = {};
  parts.forEach(p => {
    if (p.type !== "literal") map[p.type] = p.value;
  });

  return map.year + "-" + map.month + "-" + map.day;
}

function addDaysKey(key, days) {
  const p = key.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}


function mapPermitPayload(permit, secureToken) {
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
    startDate: dateKey(permit.startDate || "") || "",
    endDate: dateKey(permit.endDate || "") || "",
    paymentArabic: permit.paymentArabic || "",
    statusArabic: validity.validityText,
    validityClass: validity.validityClass,
    validityText: validity.validityText,
    validityNote: validity.validityNote,
    secureToken: secureToken || "",
    token: secureToken || "",
    clientUrl: typeof buildClientUrl === "function" ? buildClientUrl(secureToken) : ""
  };
}

async function ensureTokenForPermit(permitId) {
  let tokenRow = await PermitToken.findOne({ permitId });

  if (!tokenRow) {
    tokenRow = await PermitToken.create({
      permitId,
      token: "AZHASEC-" + crypto.randomUUID(),
      status: "active"
    });
  }

  return tokenRow;
}

async function buildDashboardBundle(session) {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [
    total,
    active,
    warning,
    expired,
    todayScans,
    invalidToday,
    invalidScans,
    mainGateScans,
    beachGateScans,
    approvedCount,
    rejectedCount,
    reviewCount,
    paymentIssueCount,
    activeSessions,
    latestScan,
    auditLogs,
    securityActions,
    sessions,
    permitTokens,
    systemSettings,
    auditCountToday,
    actionCountToday
  ] = await Promise.all([
    Permit.countDocuments({}),
    Permit.countDocuments({ validityClass: "valid" }),
    Permit.countDocuments({ validityClass: "warning" }),
    Permit.countDocuments({ validityClass: "invalid" }),

    ScanLog.countDocuments({ timestamp: { $gte: todayStart, $lte: todayEnd } }),
    ScanLog.countDocuments({
      timestamp: { $gte: todayStart, $lte: todayEnd },
      validityClass: { $in: ["invalid", "not_found"] }
    }),

    ScanLog.countDocuments({ validityClass: { $in: ["invalid", "not_found"] } }),
    ScanLog.countDocuments({ gateName: /main/i }),
    ScanLog.countDocuments({ gateName: /beach/i }),

    SecurityAction.countDocuments({ decision: "approved" }),
    SecurityAction.countDocuments({ decision: "rejected" }),
    SecurityAction.countDocuments({ decision: "review_required" }),
    SecurityAction.countDocuments({ decision: "payment_issue" }),

    Session.countDocuments({ status: "active", expiresAt: { $gt: new Date() } }),

    ScanLog.findOne({}).sort({ timestamp: -1 }).lean(),
    AuditLog.find({}).sort({ timestamp: -1 }).limit(30).lean(),
    SecurityAction.find({}).sort({ timestamp: -1 }).limit(30).lean(),
    Session.find({ status: "active", expiresAt: { $gt: new Date() } }).sort({ lastActivity: -1 }).limit(30).lean(),
    PermitToken.find({}).sort({ updatedAt: -1 }).limit(50).lean(),
    SystemSetting.find({}).sort({ key: 1 }).lean(),

    AuditLog.countDocuments({ timestamp: { $gte: todayStart, $lte: todayEnd } }),
    SecurityAction.countDocuments({ timestamp: { $gte: todayStart, $lte: todayEnd } })
  ]);

  return {
    dashboard: {
      total,
      active,
      warning,
      expired,
      todayScans,
      invalidScansToday: invalidToday
    },
    summary: {
      invalidScans,
      approvedCount,
      rejectedCount,
      reviewCount,
      paymentIssueCount,
      mainGateScans,
      beachGateScans,
      activeSessions
    },
    latest: latestScan ? mapScan(latestScan) : { found: false },
    operations: {
      auditCountToday,
      actionCountToday
    },
    auditLogs: auditLogs.map(mapAudit),
    securityActions: securityActions.map(mapAction),
    activeSessions: sessions.map((s) => ({
      username: s.username || "",
      role: s.role || "",
      fullName: s.fullName || "",
      gateName: s.gateName || "",
      gateLocation: s.gateLocation || "",
      createdAt: formatDateTime(s.createdAt),
      expiresAt: formatDateTime(s.expiresAt),
      lastActivity: formatDateTime(s.lastActivity)
    })),
    permitTokens: permitTokens.map((t) => ({
      permitId: t.permitId || "",
      token: t.token || "",
      status: t.status || "",
      createdAt: formatDateTime(t.createdAt),
      regeneratedAt: formatDateTime(t.regeneratedAt || t.updatedAt),
      disabledBy: t.disabledBy || ""
    })),
    systemSettings: systemSettings.map((s) => ({
      key: s.key,
      value: s.value
    })),
    userContext: {
      username: session?.username || "",
      role: session?.role || "",
      permissions: getRolePermissions(session?.role || ""),
      generatedAt: new Date().toISOString()
    }
  };
}

async function getScanLogPayload(req) {
  const query = buildScanQuery(req.query);
  const limit = Math.min(Number(req.query.limit || 100), 300);
  const rows = await ScanLog.find(query).sort({ timestamp: -1 }).limit(limit).lean();

  return {
    totalMatched: rows.length,
    rows: rows.map(mapScan)
  };
}

async function getReportsPayload(req) {
  const query = buildScanQuery(req.query);
  const limit = Math.min(Number(req.query.limit || 200), 500);
  const rows = await ScanLog.find(query).sort({ timestamp: -1 }).limit(limit).lean();

  const summary = {
    totalMatchedRows: rows.length,
    validCount: rows.filter((r) => r.validityClass === "valid").length,
    warningCount: rows.filter((r) => r.validityClass === "warning").length,
    invalidCount: rows.filter((r) => r.validityClass === "invalid").length,
    notFoundCount: rows.filter((r) => r.validityClass === "not_found").length,
    paymentReviewCount: rows.filter((r) => isUnpaid(r.paymentArabic)).length,
    expiredCount: rows.filter((r) => normalizeArabic(r.statusArabic).includes("انته")).length,
    upcomingCount: rows.filter((r) => normalizeArabic(r.statusArabic).includes("لم يبدا")).length,
    byDecision: {
      approved: await SecurityAction.countDocuments({ decision: "approved" }),
      rejected: await SecurityAction.countDocuments({ decision: "rejected" }),
      review_required: await SecurityAction.countDocuments({ decision: "review_required" }),
      payment_issue: await SecurityAction.countDocuments({ decision: "payment_issue" })
    }
  };

  return {
    summary,
    rows: rows.map(mapScan)
  };
}

async function searchPermits(queryText) {
  const q = String(queryText || "").trim();
  if (!q) return [];

  const safeQ = sanitizeRegex(q);
  const rows = await Permit.find({
    $or: [
      { permitId: new RegExp(safeQ, "i") },
      { unit: new RegExp(safeQ, "i") },
      { tenant: new RegExp(safeQ, "i") },
      { phone: new RegExp(safeQ, "i") },
      { carPlate: new RegExp(safeQ, "i") }
    ]
  }).sort({ updatedAt: -1 }).limit(50).lean();

  const result = [];

  for (const p of rows) {
    const tokenRow = await ensureTokenForPermit(p.permitId);
    result.push({
      ...mapPermitPayload(p, tokenRow.token),
      token: tokenRow.token
    });
  }

  return result;
}


function azhaTodayCairoKey() {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  return azhaDateKey(formatted);
}

function azhaAddDaysKey(key, days) {
  const p = key.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

computePermitValidity = function (startDate, endDate, statusArabic, paymentArabic) {
  const start = azhaDateKey(startDate);
  const end = azhaDateKey(endDate);
  const today = azhaTodayCairoKey();
  const tomorrow = azhaAddDaysKey(today, 1);

  let result;

  if (!start || !end) {
    result = {
      validityClass: "warning",
      validityText: "غير محدد",
      validityNote: "Undefined dates"
    };
  } else if (start === tomorrow) {
    result = {
      validityClass: "warning",
      validityText: "يبدأ غدًا",
      validityNote: "Starts tomorrow"
    };
  } else if (start > tomorrow) {
    result = {
      validityClass: "warning",
      validityText: "لم يبدأ",
      validityNote: "Not started yet"
    };
  } else if (end < today) {
    result = {
      validityClass: "invalid",
      validityText: "التصريح منتهي",
      validityNote: "Permit expired"
    };
  } else if (end === today) {
    result = {
      validityClass: "warning",
      validityText: "آخر يوم ساري",
      validityNote: "Last valid day"
    };
  } else {
    result = {
      validityClass: "valid",
      validityText: "صالح للدخول",
      validityNote: "Valid for entry"
    };
  }

  if (typeof isUnpaid === "function" && isUnpaid(paymentArabic)) {
    return {
      validityClass: "warning",
      validityText: "مراجعة السداد",
      validityNote: "Payment review required",
      computedStatusArabic: result.validityText,
      computedStatusEnglish: result.validityNote
    };
  }

  return {
    validityClass: result.validityClass,
    validityText: result.validityText,
    validityNote: result.validityNote,
    computedStatusArabic: result.validityText,
    computedStatusEnglish: result.validityNote
  };
};
/* ===== END AZHA FORCE VALIDITY OVERRIDE ===== */
