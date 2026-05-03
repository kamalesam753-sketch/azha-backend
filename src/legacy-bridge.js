/**
 * Legacy Bridge — maps old /api?action=XXX calls to new controllers.
 * TEMPORARY: Remove once all frontend pages are updated to use REST v1 endpoints.
 */
const authCtrl = require("./controllers/auth.controller");
const permitCtrl = require("./controllers/permit.controller");
const scanCtrl = require("./controllers/scan.controller");
const presenceCtrl = require("./controllers/presence.controller");
const securityCtrl = require("./controllers/security.controller");
const dashboardCtrl = require("./controllers/dashboard.controller");
const gateCtrl = require("./controllers/gate.controller");
const userCtrl = require("./controllers/user.controller");
const watchlistCtrl = require("./controllers/watchlist.controller");
const emergencyCtrl = require("./controllers/emergency.controller");
const { requireAuth } = require("./middleware/auth");
const asyncHandler = require("./middleware/asyncHandler");

async function legacyBridge(req, res, next) {
  const action = req.query.action || req.body?.action || "";

  if (!action) {
    return res.status(400).json({ success: false, message: "Missing action parameter" });
  }

  // Inject auth for actions that need it
  const authActions = [
    "verifySession", "logout", "getPermits", "createPermit", "updatePermit",
    "deletePermit", "generateClientToken", "searchPermits", "scanToken",
    "latestScan", "getScanLog", "getUsers", "createUser", "updateUser",
    "deleteUser", "resetUserPassword", "getGates", "createGate", "updateGate",
    "deleteGate", "submitDecision", "getSecurityActions", "dashboardBundle",
    "getTokenByPermit", "revokePermit",
    "getWatchlist", "addWatchlist", "resolveWatchlist", "deleteWatchlist",
    "emergencyStatus", "emergencyActivate", "emergencyDeactivate"
  ];

  if (authActions.includes(action)) {
    // Map sessionToken from query/body to header for auth middleware
    const st = req.query.sessionToken || req.body?.sessionToken || "";
    if (st) req.headers["x-session-token"] = st;

    try {
      await new Promise((resolve, reject) => {
        requireAuth(req, res, (err) => err ? reject(err) : resolve());
      });
    } catch (err) {
      return res.status(401).json({ success: false, message: err.message || "Authentication required" });
    }
  }

  // Map legacy actions to new controllers
  try {
    switch (action) {
      case "ping":
        return res.json({ success: true, message: "AZHA API is running" });

      case "login":
        return await authCtrl.login(req, res);

      case "verifySession":
        return await authCtrl.verifySession(req, res);

      case "logout":
        return await authCtrl.logout(req, res);

      case "getPermits":
        return await permitCtrl.getAll(req, res);

      case "createPermit":
        return await permitCtrl.create(req, res);

      case "updatePermit":
        req.params.id = req.query.id || req.body?.id || "";
        return await permitCtrl.update(req, res);

      case "deletePermit":
        req.params.id = req.query.id || req.body?.id || "";
        return await permitCtrl.remove(req, res);

      case "generateClientToken":
        req.params.id = req.query.id || req.body?.id || "";
        return await permitCtrl.generateToken(req, res);

      case "getTokenByPermit":
        req.params.id = req.query.id || req.body?.id || "";
        return await permitCtrl.generateToken(req, res);

      case "getClientPermit":
        req.query.token = req.query.token || req.body?.token || "";
        return await permitCtrl.getClientCard(req, res);

      case "searchPermits":
        req.query.q = req.query.query || req.body?.query || "";
        return await permitCtrl.search(req, res);

      case "scanToken":
        req.body.token = req.query.token || req.body?.token || "";
        return await scanCtrl.verifyToken(req, res);

      case "latestScan":
        return await scanCtrl.getLatest(req, res);

      case "getScanLog":
        return await scanCtrl.getLog(req, res);

      case "submitDecision":
        return await securityCtrl.submitDecision(req, res);

      case "getSecurityActions":
        return await securityCtrl.getDecisions(req, res);

      case "dashboardBundle":
        return await dashboardCtrl.getDashboard(req, res);

      case "getUsers":
        return await userCtrl.getAll(req, res);

      case "createUser":
        return await userCtrl.create(req, res);

      case "updateUser":
        req.params.id = req.query.id || req.body?.id || "";
        return await userCtrl.update(req, res);

      case "deleteUser":
        req.params.id = req.query.id || req.body?.id || "";
        return await userCtrl.remove(req, res);

      case "resetUserPassword":
        req.params.id = req.query.id || req.body?.id || "";
        return await userCtrl.resetPassword(req, res);

      case "getGates":
        return await gateCtrl.getAll(req, res);

      case "createGate":
        return await gateCtrl.create(req, res);

      case "updateGate":
        req.params.id = req.query.id || req.body?.id || "";
        return await gateCtrl.update(req, res);

      case "deleteGate":
        req.params.id = req.query.id || req.body?.id || "";
        return await gateCtrl.remove(req, res);

      case "revokePermit":
        req.params.id = req.query.id || req.body?.id || "";
        return await permitCtrl.revokePermit(req, res);

      case "getWatchlist":
        if (req.body?.status) req.query.status = req.body.status;
        if (req.body?.type) req.query.type = req.body.type;
        return await watchlistCtrl.getAll(req, res);

      case "addWatchlist":
        return await watchlistCtrl.create(req, res);

      case "resolveWatchlist":
        req.params.id = req.query.id || req.body?.id || "";
        return await watchlistCtrl.resolve(req, res);

      case "deleteWatchlist":
        req.params.id = req.query.id || req.body?.id || "";
        return await watchlistCtrl.remove(req, res);

      case "emergencyStatus":
        return await emergencyCtrl.getStatus(req, res);

      case "emergencyActivate":
        return await emergencyCtrl.activate(req, res);

      case "emergencyDeactivate":
        return await emergencyCtrl.deactivate(req, res);

      default:
        return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("Legacy bridge error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

module.exports = asyncHandler(legacyBridge);
