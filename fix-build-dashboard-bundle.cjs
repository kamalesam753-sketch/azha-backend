const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");

s = s.replace(
/async function buildDashboardBundle\(session\) \{[\s\S]*?\n}\n\nasync function getScanLogPayload/,
`async function buildDashboardBundle(session) {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [
    permitsRaw,
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
    Permit.find({}).lean(),

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

  const permitsComputed = permitsRaw.map((p) => {
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
  });

  const total = permitsComputed.length;
  const active = permitsComputed.filter((p) => p.validityClass === "valid").length;
  const warning = permitsComputed.filter((p) => p.validityClass === "warning").length;
  const expired = permitsComputed.filter((p) => p.validityClass === "invalid").length;

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

async function getScanLogPayload`
);

fs.writeFileSync("server.js", s, "utf8");
console.log("buildDashboardBundle now uses computed permit validity.");
