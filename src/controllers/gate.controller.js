/**
 * Gate controller.
 */
const Gate = require("../models/Gate");
const { success, fail } = require("../utils/response");
const { logAction } = require("../services/audit.service");

async function getAll(req, res) {
  const gates = await Gate.find().sort({ createdAt: -1 }).lean();
  return success(res, gates);
}

async function create(req, res) {
  const { name, location, type, status } = req.body;
  if (!name) return fail(res, "Gate name is required", 400);
  const gate = await Gate.create({ name, location: location || "", type: type || "main", status: status || "active" });
  await logAction("gate_created", req.sessionData, { details: `Created gate ${name}` });
  return success(res, gate, "Gate created", 201);
}

async function update(req, res) {
  const gate = await Gate.findById(req.params.id);
  if (!gate) return fail(res, "Gate not found", 404);
  for (const f of ["name", "location", "type", "status"]) { if (req.body[f] !== undefined) gate[f] = req.body[f]; }
  await gate.save();
  await logAction("gate_updated", req.sessionData, { details: `Updated gate ${gate.name}` });
  return success(res, gate, "Gate updated");
}

async function remove(req, res) {
  const result = await Gate.deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) return fail(res, "Gate not found", 404);
  await logAction("gate_deleted", req.sessionData, { details: `Deleted gate ${req.params.id}` });
  return success(res, null, "Gate deleted");
}

module.exports = { getAll, create, update, remove };
