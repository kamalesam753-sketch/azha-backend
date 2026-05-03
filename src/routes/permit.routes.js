const router = require("express").Router();
const ctrl = require("../controllers/permit.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

// Public endpoint — PII-safe
router.get("/client", ah(ctrl.getClientCard));

// Authenticated endpoints
router.get("/", requireAuth, ah(ctrl.getAll));
router.get("/search", requireAuth, ah(ctrl.search));
router.post("/", requireAuth, requireRole("admin", "supervisor"), ah(ctrl.create));
router.put("/:id", requireAuth, requireRole("admin", "supervisor"), ah(ctrl.update));
router.delete("/:id", requireAuth, requireRole("admin"), ah(ctrl.remove));
router.post("/:id/token", requireAuth, requireRole("admin", "supervisor"), ah(ctrl.generateToken));
router.post("/:id/revoke", requireAuth, requireRole("admin", "supervisor"), ah(ctrl.revokePermit));

module.exports = router;
