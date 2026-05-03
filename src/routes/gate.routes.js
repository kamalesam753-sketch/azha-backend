const router = require("express").Router();
const ctrl = require("../controllers/gate.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

router.get("/", requireAuth, ah(ctrl.getAll));
router.post("/", requireAuth, requireRole("admin"), ah(ctrl.create));
router.put("/:id", requireAuth, requireRole("admin"), ah(ctrl.update));
router.delete("/:id", requireAuth, requireRole("admin"), ah(ctrl.remove));

module.exports = router;
