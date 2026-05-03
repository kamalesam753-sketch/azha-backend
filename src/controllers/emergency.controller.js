/**
 * Emergency controller — lockdown enable/disable/status.
 */
const Emergency = require("../models/Emergency");
const { success, fail } = require("../utils/response");
const { logAction } = require("../services/audit.service");
const rt = require("../services/realtime.service");

async function getState() {
  let state = await Emergency.findOne().sort({ updatedAt: -1 }).lean();
  if (!state) state = { active: false };
  return state;
}

async function getStatus(req, res) {
  const state = await getState();
  return success(res, { active: !!state.active, activatedAt: state.activatedAt || null, reason: state.reason || "" });
}

async function activate(req, res) {
  const reason = req.body.reason || "Emergency lockdown activated";
  await Emergency.updateMany({}, { active: false });
  const state = await Emergency.create({
    active: true,
    activatedBy: req.sessionData?.username || "",
    reason,
    activatedAt: new Date()
  });
  await logAction("emergency_activated", req.sessionData, { details: reason });
  rt.emit(rt.events.EMERGENCY_ON, { reason, activatedBy: req.sessionData?.username || "" });
  rt.emit(rt.events.ALERT_NEW, { level: "critical", text: "EMERGENCY LOCKDOWN ACTIVATED: " + reason });
  return success(res, { active: true, reason }, "Emergency lockdown activated");
}

async function deactivate(req, res) {
  await Emergency.updateMany({ active: true }, {
    active: false,
    deactivatedBy: req.sessionData?.username || "",
    deactivatedAt: new Date()
  });
  await logAction("emergency_deactivated", req.sessionData, { details: "Lockdown lifted" });
  rt.emit(rt.events.EMERGENCY_OFF, { deactivatedBy: req.sessionData?.username || "" });
  return success(res, { active: false }, "Emergency lockdown deactivated");
}

module.exports = { getStatus, activate, deactivate, getState };
