const router = require("express").Router();
const ctrl = require("../controllers/scan.controller");
const { requireAuth } = require("../middleware/auth");
const { scanLimiter } = require("../middleware/rateLimiter");
const ah = require("../middleware/asyncHandler");

router.post("/verify", requireAuth, scanLimiter, ah(ctrl.verifyToken));
router.get("/", requireAuth, ah(ctrl.getLog));
router.get("/latest", requireAuth, ah(ctrl.getLatest));

module.exports = router;
