const router = require("express").Router();
const ctrl = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimiter");
const ah = require("../middleware/asyncHandler");

router.post("/login", loginLimiter, ah(ctrl.login));
router.get("/verify", requireAuth, ah(ctrl.verifySession));
router.post("/logout", requireAuth, ah(ctrl.logout));

module.exports = router;