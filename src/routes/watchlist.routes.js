const router = require("express").Router();
const ctrl = require("../controllers/watchlist.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

router.get("/", requireAuth, requireRole("admin", "supervisor"), ah(ctrl.getAll));
router.post("/", requireAuth, requireRole("admin", "supervisor"), ah(ctrl.create));
router.put("/:id/resolve", requireAuth, requireRole("admin", "supervisor"), ah(ctrl.resolve));
router.delete("/:id", requireAuth, requireRole("admin"), ah(ctrl.remove));

module.exports = router;
