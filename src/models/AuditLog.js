const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    actionType: { type: String, default: "", index: true },
    permitId: { type: String, default: "" },
    token: { type: String, default: "" },
    result: { type: String, default: "" },

    validityClass: { type: String, default: "" },
    validityText: { type: String, default: "" },

    unit: { type: String, default: "" },
    tenant: { type: String, default: "" },
    statusArabic: { type: String, default: "" },
    paymentArabic: { type: String, default: "" },

    username: { type: String, default: "" },
    role: { type: String, default: "" },
    gateName: { type: String, default: "" },
    gateLocation: { type: String, default: "" },

    durationMs: { type: Number, default: 0 },
    details: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);