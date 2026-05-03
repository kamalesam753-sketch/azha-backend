/**
 * Emergency model — stores system-wide emergency lockdown state.
 */
const mongoose = require("mongoose");

const emergencySchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: false },
    activatedBy: { type: String, default: "" },
    deactivatedBy: { type: String, default: "" },
    reason: { type: String, default: "" },
    activatedAt: { type: Date },
    deactivatedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Emergency", emergencySchema);
