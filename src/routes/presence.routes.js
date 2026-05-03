const router = require("express").Router();
const ctrl = require("../controllers/presence.controller");
const { requireAuth } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

router.get("/", requireAuth, ah(ctrl.getAll));
router.post("/", requireAuth, ah(ctrl.create));

module.exports = router;
