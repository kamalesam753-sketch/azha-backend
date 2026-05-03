const router = require("express").Router();
const ctrl = require("../controllers/security.controller");
const { requireAuth } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

router.post("/decisions", requireAuth, ah(ctrl.submitDecision));
router.get("/decisions", requireAuth, ah(ctrl.getDecisions));

module.exports = router;
