/**
 * User management controller.
 */
const User = require("../models/User");
const Session = require("../models/Session");
const { hashPassword } = require("../utils/hash");
const { success, fail } = require("../utils/response");
const { logAction } = require("../services/audit.service");

async function getAll(req, res) {
  const users = await User.find().select("-passwordHash").sort({ createdAt: -1 }).lean();
  return success(res, users);
}

async function create(req, res) {
  const { username, password, fullName, role, gateName, gateLocation, status } = req.body;
  if (!username || !password) return fail(res, "Username and password are required", 400);

  const exists = await User.findOne({ username: username.trim().toLowerCase() });
  if (exists) return fail(res, "Username already exists", 409);

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    username: username.trim().toLowerCase(), passwordHash,
    fullName: fullName || "", role: role || "guard",
    gateName: gateName || "", gateLocation: gateLocation || "",
    status: status || "active"
  });

  await logAction("user_created", req.sessionData, { details: `Created ${user.username}` });
  const { passwordHash: _, ...safe } = user.toObject();
  return success(res, safe, "User created", 201);
}

async function update(req, res) {
  const user = await User.findOne({ $or: [{ _id: isOid(req.params.id) ? req.params.id : null }, { username: req.params.id }] });
  if (!user) return fail(res, "User not found", 404);
  const fields = ["fullName", "role", "gateName", "gateLocation", "status"];
  for (const f of fields) { if (req.body[f] !== undefined) user[f] = req.body[f]; }
  await user.save();
  await logAction("user_updated", req.sessionData, { details: `Updated ${user.username}` });
  const { passwordHash: _, ...safe } = user.toObject();
  return success(res, safe, "User updated");
}

async function remove(req, res) {
  const result = await User.deleteOne({ $or: [{ _id: isOid(req.params.id) ? req.params.id : null }, { username: req.params.id }] });
  if (result.deletedCount === 0) return fail(res, "User not found", 404);
  await logAction("user_deleted", req.sessionData, { details: `Deleted ${req.params.id}` });
  return success(res, null, "User deleted");
}

async function resetPassword(req, res) {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return fail(res, "Password must be at least 4 characters", 400);
  const user = await User.findOne({ $or: [{ _id: isOid(req.params.id) ? req.params.id : null }, { username: req.params.id }] });
  if (!user) return fail(res, "User not found", 404);
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await Session.updateMany({ username: user.username, status: "active" }, { status: "ended" });
  await logAction("password_reset", req.sessionData, { details: `Reset for ${user.username}` });
  return success(res, null, "Password reset");
}

function isOid(v) { return /^[a-f0-9]{24}$/.test(String(v || "")); }
module.exports = { getAll, create, update, remove, resetPassword };
