const router = require("express").Router();
const ctrl = require("../controllers/emergency.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

router.get("/status", requireAuth, ah(ctrl.getStatus));
router.post("/activate", requireAuth, requireRole("admin", "supervisor"), ah(ctrl.activate));
router.post("/deactivate", requireAuth, requireRole("admin", "supervisor"), ah(ctrl.deactivate));

module.exports = router;
