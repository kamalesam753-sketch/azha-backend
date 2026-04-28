const express = require("express");
const { v4: uuidv4 } = require("uuid");

const User = require("../models/User");
const Session = require("../models/Session");
const AuditLog = require("../models/AuditLog");
const { comparePassword } = require("../utils/hash");
const { requireSession, getRolePermissions } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password, deviceInfo } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "اسم المستخدم أو كلمة المرور غير موجودة"
      });
    }

    const user = await User.findOne({
      username: username.trim(),
      status: "active"
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "بيانات الدخول غير صحيحة"
      });
    }

    const matched = await comparePassword(password, user.passwordHash);

    if (!matched) {
      return res.status(401).json({
        success: false,
        message: "بيانات الدخول غير صحيحة"
      });
    }

    const sessionHours = Number(process.env.SESSION_HOURS || 12);
    const expiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000);
    const sessionToken = uuidv4() + "-" + Date.now();

    const session = await Session.create({
      sessionToken,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      gateName: user.gateName,
      gateLocation: user.gateLocation,
      deviceInfo: deviceInfo || "",
      expiresAt
    });

    const permissions = getRolePermissions(user.role);

    res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      data: {
        token: session.sessionToken,
        username: session.username,
        role: session.role,
        fullName: session.fullName,
        gateName: session.gateName,
        gateLocation: session.gateLocation,
        expiresAt: session.expiresAt,
        permissions,
        defaultRoute: permissions.defaultRoute
      }
    });

    AuditLog.create({
      actionType: "login",
      username: user.username,
      role: user.role,
      gateName: user.gateName,
      gateLocation: user.gateLocation,
      result: "success",
      details: deviceInfo || ""
    }).catch(() => {});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء تسجيل الدخول"
    });
  }
});

router.get("/verify-session", requireSession, async (req, res) => {
  res.json({
    success: true,
    message: "الجلسة صالحة",
    data: {
      username: req.session.username,
      role: req.session.role,
      fullName: req.session.fullName,
      gateName: req.session.gateName,
      gateLocation: req.session.gateLocation,
      expiresAt: req.session.expiresAt,
      permissions: req.permissions,
      defaultRoute: req.permissions.defaultRoute
    }
  });
});

router.post("/logout", requireSession, async (req, res) => {
  req.session.status = "expired";
  req.session.lastActivity = new Date();
  await req.session.save();

  AuditLog.create({
    actionType: "logout",
    username: req.session.username,
    role: req.session.role,
    gateName: req.session.gateName,
    gateLocation: req.session.gateLocation,
    result: "success"
  }).catch(() => {});

  res.json({
    success: true,
    message: "تم تسجيل الخروج بنجاح"
  });
});

module.exports = router;