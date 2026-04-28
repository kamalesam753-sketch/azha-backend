const mongoose = require("mongoose");

const ScanLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    permitId: { type: String, default: "", index: true },
    token: { type: String, default: "" },

    mode: { type: String, default: "scan" },
    result: { type: String, default: "success", index: true },

    validityClass: { type: String, default: "", index: true },
    validityText: { type: String, default: "" },

    unit: { type: String, default: "", index: true },
    tenant: { type: String, default: "", index: true },
    statusArabic: { type: String, default: "" },
    paymentArabic: { type: String, default: "" },

    securityUsername: { type: String, default: "" },
    role: { type: String, default: "" },
    gateName: { type: String, default: "" },
    gateLocation: { type: String, default: "" },

    durationMs: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ScanLog", ScanLogSchema);