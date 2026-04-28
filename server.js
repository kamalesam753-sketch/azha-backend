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

function mapPermitPayload(permit, secureToken) {
  return {
    permitId: permit.permitId || "",
    unit: permit.unit || "",
    ownerName: permit.ownerName || "",
    tenant: permit.tenant || "",
    tenantCount: permit.tenantCount || "",
    phone: permit.phone || "",
    carPlate: permit.carPlate || "",
    statusArabic: permit.statusArabic || "",
    paymentArabic: permit.paymentArabic || "",
    validityClass: permit.validityClass || "",
    validityText: permit.validityText || "",
    validityNote: permit.validityNote || "",
    startDate: permit.startDate || "",
    endDate: permit.endDate || "",
    secureToken: secureToken || "",
    clientUrl: buildClientUrl(secureToken)
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

function computePermitValidity(startDate, endDate, statusArabic, paymentArabic) {
  if (isUnpaid(paymentArabic)) {
    return {
      validityClass: "warning",
      validityText: "مراجعة السداد",
      validityNote: "Payment review required"
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (start && start > now) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (start.toDateString() === tomorrow.toDateString()) {
      return { validityClass: "warning", validityText: "يبدأ غداً", validityNote: "Starts tomorrow" };
    }
    return { validityClass: "warning", validityText: "لم يبدأ بعد", validityNote: "Not started yet" };
  }

  if (end && end < now) {
    return { validityClass: "invalid", validityText: "التصريح منتهي", validityNote: "Permit expired" };
  }

  if (end) {
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    if (diff === 0) {
      return { validityClass: "warning", validityText: "آخر يوم ساري", validityNote: "Last valid day" };
    }
  }

  return { validityClass: "valid", validityText: "صالح للدخول", validityNote: "Valid for entry" };
}

app.all("/api", async (req, res, next) => {
  try {
    const action = String(req.query.action || req.body.action || "").trim();

    if (!action) {
      return res.status(400).json({
        success: false,
        message: "Missing action"
      });
    }

    if (action === "ping") {
      return res.json({
        success: true,
        message: "AZHA Backend is running"
      });
    }

    if (action === "login") {
      return loginLimiter(req, res, () => {
        if (req.method !== "POST") {
          return res.status(405).json({
            success: false,
            message: "Login must use POST only"
          });
        }

        req.url = "/login";
        req.method = "POST";
        req.body = {
          username: req.body.username,
          password: req.body.password,
          deviceInfo: req.body.deviceInfo || ""
        };
        return authRoutes(req, res, next);
      });
    }

    if (action === "verifySession") {
      req.url = "/verify-session";
      req.method = "GET";
      req.headers.authorization =
        "Bearer " + (req.query.sessionToken || req.body.sessionToken || req.query.token || req.body.token || "");
      return authRoutes(req, res, next);
    }

    if (action === "logout") {
      req.url = "/logout";
      req.method = "POST";
      req.headers.authorization =
        "Bearer " + (req.query.sessionToken || req.body.sessionToken || req.query.token || req.body.token || "");
      return authRoutes(req, res, next);
    }

    const sessionToken = req.query.sessionToken || req.body.sessionToken || "";
    const session = await getSessionContext(sessionToken);

    const publicActions = ["getClientPermit"];

    if (!session && !publicActions.includes(action)) {
      return res.status(401).json({
        success: false,
        message: "Session expired or invalid"
      });
    }

    if (action === "dashboardBundle") {
      return res.json({
        success: true,
        data: await buildDashboardBundle(session)
      });
    }

    if (action === "getScanLog") {
      return res.json({
        success: true,
        data: await getScanLogPayload(req)
      });
    }

    if (action === "getReports") {
      return res.json({
        success: true,
        data: await getReportsPayload(req)
      });
    }

    if (action === "searchPermits") {
      return res.json({
        success: true,
        data: await searchPermits(req.query.query || req.body.query)
      });
    }

    if (action === "latestScan") {
      const latest = await ScanLog.findOne({}).sort({ timestamp: -1 }).lean();
      return res.json({
        success: true,
        data: latest ? mapScan(latest) : { found: false }
      });
    }

    if (action === "getTokenByPermit") {
      const permitId = req.query.id || req.body.id || "";
      const permit = await Permit.findOne({ permitId }).lean();

      if (!permit) {
        return res.status(404).json({
          success: false,
          message: "Permit not found"
        });
      }

      const tokenRow = await ensureTokenForPermit(permitId);

      return res.json({
        success: true,
        data: {
          permitId,
          secureToken: tokenRow.token,
          token: tokenRow.token,
          clientUrl: buildClientUrl(tokenRow.token)
        }
      });
    }
    if (action === "generateClientToken") {
      const permitId = req.query.id || req.body.id || "";

      if (!permitId) {
        return res.status(400).json({
          success: false,
          message: "Missing permit ID"
        });
      }

      const permit = await Permit.findOne({ permitId }).lean();

      if (!permit) {
        return res.status(404).json({
          success: false,
          message: "Permit not found"
        });
      }

      const tokenRow = await ensureTokenForPermit(permitId);

      await auditAction("generate_token", session, {
        permitId,
        result: "success",
        token: tokenRow.token
      });

      return res.json({
        success: true,
        data: {
          permitId,
          token: tokenRow.token,
          secureToken: tokenRow.token,
          clientUrl: buildClientUrl(tokenRow.token)
        }
      });
    }
    if (action === "getClientPermit") {
      const secureToken = req.query.token || req.body.token || "";
      const tokenRow = await PermitToken.findOne({ token: secureToken, status: "active" }).lean();

      if (!tokenRow) {
        return res.status(404).json({
          success: false,
          message: "Invalid token"
        });
      }

      const permit = await Permit.findOne({ permitId: tokenRow.permitId }).lean();

      if (!permit) {
        return res.status(404).json({
          success: false,
          message: "Permit not found"
        });
      }

      return res.json({
        success: true,
        data: mapPermitPayload(permit, secureToken)
      });
    }

    if (action === "scanToken") {
      const startedAt = Date.now();
      const secureToken = req.query.token || req.body.token || "";
      const mode = req.query.mode || req.body.mode || "gate";

      const tokenRow = await PermitToken.findOne({ token: secureToken, status: "active" }).lean();

      if (!tokenRow) {
        await ScanLog.create({
          timestamp: new Date(),
          permitId: "",
          token: secureToken,
          mode,
          validityClass: "not_found",
          validityText: "رمز غير صالح",
          result: "invalid_token",
          durationMs: Date.now() - startedAt,
          securityUsername: session?.username || "",
          role: session?.role || "",
          gateName: session?.gateName || "",
          gateLocation: session?.gateLocation || ""
        });

        return res.status(404).json({
          success: false,
          message: "Invalid token"
        });
      }

      const permit = await Permit.findOne({ permitId: tokenRow.permitId }).lean();

      if (!permit) {
        return res.status(404).json({
          success: false,
          message: "Permit not found"
        });
      }

      const payload = mapPermitPayload(permit, secureToken);

      await ScanLog.create({
        timestamp: new Date(),
        permitId: payload.permitId,
        token: secureToken,
        mode,
        validityClass: payload.validityClass,
        validityText: payload.validityText,
        unit: payload.unit,
        tenant: payload.tenant,
        statusArabic: payload.statusArabic,
        paymentArabic: payload.paymentArabic,
        result: "success",
        durationMs: Date.now() - startedAt,
        securityUsername: session?.username || "",
        role: session?.role || "",
        gateName: session?.gateName || "",
        gateLocation: session?.gateLocation || ""
      });

      await AuditLog.create({
        actionType: "scan_token",
        permitId: payload.permitId,
        token: secureToken,
        result: "success",
        validityClass: payload.validityClass,
        validityText: payload.validityText,
        unit: payload.unit,
        tenant: payload.tenant,
        statusArabic: payload.statusArabic,
        paymentArabic: payload.paymentArabic,
        username: session?.username || "",
        role: session?.role || "",
        gateName: session?.gateName || "",
        gateLocation: session?.gateLocation || "",
        durationMs: Date.now() - startedAt,
        details: mode
      });

      return res.json({
        success: true,
        data: payload
      });
    }

    if (action === "submitSecurityDecision" || action === "applySecurityDecision") {
      const permitId = req.query.id || req.body.id || "";
      const token = req.query.token || req.body.token || "";
      const decision = req.query.decision || req.body.decision || "";
      const notes = req.query.notes || req.body.notes || "";

      const actionRow = await SecurityAction.create({
        permitId,
        token,
        decision,
        notes,
        username: session.username,
        fullName: session.fullName,
        role: session.role,
        gateName: session.gateName,
        gateLocation: session.gateLocation
      });

      await AuditLog.create({
        actionType: action,
        permitId,
        token,
        result: "success",
        username: session.username,
        role: session.role,
        gateName: session.gateName,
        gateLocation: session.gateLocation,
        details: notes
      });

      return res.json({
        success: true,
        data: {
          id: actionRow._id,
          tokenEffect: "recorded"
        }
      });
    }

    if (action === "getPermits") {
      if (!requireRole(session, ["admin", "supervisor"])) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
      const permits = await Permit.find({}).sort({ updatedAt: -1 }).limit(500).lean();
      const result = [];
      for (const p of permits) {
        const tokenRow = await ensureTokenForPermit(p.permitId);
        result.push({ ...mapPermitPayload(p, tokenRow.token), _id: p._id });
      }
      return res.json({ success: true, data: result });
    }

    if (action === "createPermit") {
      if (!requireRole(session, ["admin", "supervisor"])) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
      const b = req.body;
      const err = validateString(b.unit, "Unit", 1, 200) || validateString(b.tenant, "Tenant", 1, 200);
      if (err) return res.status(400).json({ success: false, message: err });

      const paymentArabic = b.paymentArabic || "تم الدفع";
      const validity = computePermitValidity(b.startDate, b.endDate, b.statusArabic, paymentArabic);
      const permitId = "AZH-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7).toUpperCase();

      const permit = await Permit.create({
        permitId,
        unit: String(b.unit || "").trim(),
        tenant: String(b.tenant || "").trim(),
        phone: String(b.phone || "").trim(),
        carPlate: String(b.carPlate || "").trim(),
        startDate: b.startDate || "",
        endDate: b.endDate || "",
        statusArabic: b.statusArabic || validity.validityText,
        paymentArabic,
        validityClass: validity.validityClass,
        validityText: validity.validityText,
        validityNote: validity.validityNote,
        source: "admin_panel"
      });

      await ensureTokenForPermit(permitId);
      await auditAction("create_permit", session, { permitId, result: "success", details: "Created via admin panel" });

      return res.json({ success: true, data: { permitId: permit.permitId } });
    }

    if (action === "updatePermit") {
      if (!requireRole(session, ["admin", "supervisor"])) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
      const id = req.body.id || "";
      if (!id) return res.status(400).json({ success: false, message: "Missing permit ID" });

      const permit = await Permit.findOne({ permitId: id });
      if (!permit) return res.status(404).json({ success: false, message: "Permit not found" });

      const b = req.body;
      const nextPaymentArabic = b.paymentArabic !== undefined ? b.paymentArabic : permit.paymentArabic;
      const validity = computePermitValidity(
        b.startDate || permit.startDate,
        b.endDate || permit.endDate,
        b.statusArabic || permit.statusArabic,
        nextPaymentArabic
      );

      if (b.unit !== undefined) permit.unit = String(b.unit).trim();
      if (b.tenant !== undefined) permit.tenant = String(b.tenant).trim();
      if (b.phone !== undefined) permit.phone = String(b.phone).trim();
      if (b.carPlate !== undefined) permit.carPlate = String(b.carPlate).trim();
      if (b.startDate !== undefined) permit.startDate = b.startDate;
      if (b.endDate !== undefined) permit.endDate = b.endDate;
      if (b.statusArabic !== undefined) permit.statusArabic = b.statusArabic;
      if (b.paymentArabic !== undefined) permit.paymentArabic = b.paymentArabic;
      permit.validityClass = validity.validityClass;
      permit.validityText = validity.validityText;
      permit.validityNote = validity.validityNote;

      await permit.save();
      await auditAction("update_permit", session, { permitId: id, result: "success", details: "Updated via admin panel" });

      return res.json({ success: true, data: { permitId: id } });
    }

    if (action === "deletePermit") {
      if (!requireRole(session, ["admin"])) {
        return res.status(403).json({ success: false, message: "Access denied — admin only" });
      }
      const id = req.body.id || "";
      if (!id) return res.status(400).json({ success: false, message: "Missing permit ID" });

      const linkedScans = await ScanLog.countDocuments({ permitId: id });
      const linkedActions = await SecurityAction.countDocuments({ permitId: id });
      if (linkedScans > 0 || linkedActions > 0) {
        return res.status(400).json({
          success: false,
          message: "Permit has scan/action history and cannot be hard-deleted. Disable or expire it instead."
        });
      }

      const deleted = await Permit.findOneAndDelete({ permitId: id });
      if (!deleted) return res.status(404).json({ success: false, message: "Permit not found" });

      await PermitToken.deleteMany({ permitId: id });
      await auditAction("delete_permit", session, { permitId: id, result: "success", details: "Deleted via admin panel" });

      return res.json({ success: true, data: { permitId: id } });
    }

    if (action === "getUsers") {
      if (!requireRole(session, ["admin", "supervisor"])) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
      const users = await User.find({}).select("-passwordHash").sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: users });
    }

    if (action === "createUser") {
      if (!requireRole(session, ["admin"])) {
        return res.status(403).json({ success: false, message: "Access denied — admin only" });
      }
      const b = req.body;
      const err = validateString(b.username, "Username", 2, 50) || validateString(b.password, "Password", 8, 100);
      if (err) return res.status(400).json({ success: false, message: err });

      const existing = await User.findOne({ username: String(b.username).trim() });
      if (existing) return res.status(409).json({ success: false, message: "Username already exists" });

      const validRoles = ["admin", "supervisor", "viewer", "guard", "scanner"];
      const role = validRoles.includes(b.role) ? b.role : "guard";

      const passwordHash = await hashPassword(b.password);
      const user = await User.create({
        username: String(b.username).trim(),
        passwordHash,
        role,
        fullName: String(b.fullName || "").trim(),
        gateName: String(b.gateName || "Gate Security").trim(),
        gateLocation: String(b.gateLocation || "Main Gate").trim(),
        status: ["active", "inactive", "disabled"].includes(b.status) ? b.status : "active"
      });

      await auditAction("create_user", session, { result: "success", details: "Created user: " + user.username });
      return res.json({ success: true, data: { username: user.username } });
    }

    if (action === "updateUser") {
      if (!requireRole(session, ["admin"])) {
        return res.status(403).json({ success: false, message: "Access denied — admin only" });
      }
      const id = req.body.id || "";
      if (!id) return res.status(400).json({ success: false, message: "Missing user ID" });

      const user = await User.findById(id) || await User.findOne({ username: id });
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      const b = req.body;
      const validRoles = ["admin", "supervisor", "viewer", "guard", "scanner"];

      if (b.fullName !== undefined) user.fullName = String(b.fullName).trim();
      if (b.role !== undefined && validRoles.includes(b.role)) user.role = b.role;
      if (b.gateName !== undefined) user.gateName = String(b.gateName).trim();
      if (b.gateLocation !== undefined) user.gateLocation = String(b.gateLocation).trim();
      if (b.status !== undefined && ["active", "inactive", "disabled"].includes(b.status)) user.status = b.status;

      await user.save();
      await auditAction("update_user", session, { result: "success", details: "Updated user: " + user.username });
      return res.json({ success: true, data: { username: user.username } });
    }

    if (action === "deleteUser") {
      if (!requireRole(session, ["admin"])) {
        return res.status(403).json({ success: false, message: "Access denied — admin only" });
      }
      const id = req.body.id || "";
      if (!id) return res.status(400).json({ success: false, message: "Missing user ID" });

      const user = await User.findById(id) || await User.findOne({ username: id });
      if (!user) return res.status(404).json({ success: false, message: "User not found" });
      if (user.username === session.username) return res.status(400).json({ success: false, message: "Cannot delete your own account" });

      await User.deleteOne({ _id: user._id });
      await Session.updateMany({ username: user.username, status: "active" }, { status: "expired" });
      await auditAction("delete_user", session, { result: "success", details: "Deleted user: " + user.username });
      return res.json({ success: true, data: { username: user.username } });
    }

    if (action === "resetUserPassword") {
      if (!requireRole(session, ["admin"])) {
        return res.status(403).json({ success: false, message: "Access denied — admin only" });
      }
      const id = req.body.id || "";
      const newPassword = req.body.newPassword || "";
      const err = validateString(newPassword, "Password", 8, 100);
      if (err) return res.status(400).json({ success: false, message: err });

      const user = await User.findById(id) || await User.findOne({ username: id });
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      user.passwordHash = await hashPassword(newPassword);
      await user.save();
      await Session.updateMany({ username: user.username, status: "active" }, { status: "expired" });
      await auditAction("reset_password", session, { result: "success", details: "Password reset for: " + user.username });
      return res.json({ success: true, data: { username: user.username } });
    }

    if (action === "getGates") {
      if (!requireRole(session, ["admin", "supervisor"])) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
      const gates = await Gate.find({}).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: gates });
    }

    if (action === "createGate") {
      if (!requireRole(session, ["admin"])) {
        return res.status(403).json({ success: false, message: "Access denied — admin only" });
      }
      const b = req.body;
      const err = validateString(b.name, "Gate name", 1, 100);
      if (err) return res.status(400).json({ success: false, message: err });

      const existingGate = await Gate.findOne({ name: String(b.name).trim() });
      if (existingGate) return res.status(409).json({ success: false, message: "Gate already exists" });

      const gate = await Gate.create({
        name: String(b.name).trim(),
        location: String(b.location || "").trim(),
        description: String(b.description || "").trim(),
        status: ["active", "inactive", "maintenance"].includes(b.status) ? b.status : "active"
      });

      await auditAction("create_gate", session, { result: "success", details: "Created gate: " + gate.name });
      return res.json({ success: true, data: { id: gate._id, name: gate.name } });
    }

    if (action === "updateGate") {
      if (!requireRole(session, ["admin"])) {
        return res.status(403).json({ success: false, message: "Access denied — admin only" });
      }
      const id = req.body.id || "";
      if (!id) return res.status(400).json({ success: false, message: "Missing gate ID" });

      const gate = await Gate.findById(id);
      if (!gate) return res.status(404).json({ success: false, message: "Gate not found" });

      const oldName = gate.name;
      const b = req.body;
      if (b.name !== undefined) gate.name = String(b.name).trim();
      if (b.location !== undefined) gate.location = String(b.location).trim();
      if (b.description !== undefined) gate.description = String(b.description).trim();
      if (b.status !== undefined && ["active", "inactive", "maintenance"].includes(b.status)) gate.status = b.status;

      await gate.save();

      if (oldName !== gate.name) {
        await User.updateMany({ gateName: oldName }, { gateName: gate.name });
      }

      await auditAction("update_gate", session, { result: "success", details: "Updated gate: " + gate.name });
      return res.json({ success: true, data: { id: gate._id, name: gate.name } });
    }

    if (action === "deleteGate") {
      if (!requireRole(session, ["admin"])) {
        return res.status(403).json({ success: false, message: "Access denied — admin only" });
      }
      const id = req.body.id || "";
      if (!id) return res.status(400).json({ success: false, message: "Missing gate ID" });

      const gate = await Gate.findById(id);
      if (!gate) return res.status(404).json({ success: false, message: "Gate not found" });

      const linkedUsers = await User.countDocuments({ gateName: gate.name });
      const linkedSessions = await Session.countDocuments({ gateName: gate.name, status: "active" });
      const linkedScans = await ScanLog.countDocuments({ gateName: gate.name });

      if (linkedUsers > 0 || linkedSessions > 0 || linkedScans > 0) {
        return res.status(400).json({
          success: false,
          message: "Gate is linked to users/sessions/scan logs and cannot be deleted. Set it inactive instead."
        });
      }

      await Gate.deleteOne({ _id: gate._id });
      await auditAction("delete_gate", session, { result: "success", details: "Deleted gate: " + gate.name });
      return res.json({ success: true, data: { id: id } });
    }

    return res.status(404).json({
      success: false,
      message: "Action not supported: " + action
    });
  } catch (error) {
    console.error("API bridge error:", error);
    return res.status(500).json({
      success: false,
      message: "Backend API error"
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`AZHA backend running on port ${PORT}`);
});
