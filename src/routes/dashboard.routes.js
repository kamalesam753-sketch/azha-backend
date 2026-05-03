const router = require("express").Router();
const ctrl = require("../controllers/dashboard.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

router.get("/", requireAuth, requireRole("admin", "supervisor", "viewer"), ah(ctrl.getDashboard));

module.exports = router;
