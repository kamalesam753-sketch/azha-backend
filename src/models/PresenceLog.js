/**
 * PresenceLog model — replaces ephemeral JSON file logging.
 * Stores all visitor presence events in MongoDB.
 */
const mongoose = require("mongoose");

const presenceLogSchema = new mongoose.Schema(
  {
    guestName: { type: String, default: "" },
    permitId: { type: String, index: true },
    unit: { type: String, default: "" },
    tenant: { type: String, default: "" },
    gateName: { type: String, default: "", index: true },
    gateLocation: { type: String, default: "" },
    securityUsername: { type: String, default: "" },
    present: { type: Boolean, default: true },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

presenceLogSchema.index({ gateName: 1, timestamp: -1 });
presenceLogSchema.index({ permitId: 1, timestamp: -1 });

module.exports = mongoose.model("PresenceLog", presenceLogSchema);
