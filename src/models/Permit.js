const mongoose = require("mongoose");

const PermitSchema = new mongoose.Schema(
  {
    permitId: { type: String, required: true, unique: true, index: true },
    unit: { type: String, default: "", index: true },
    ownerName: { type: String, default: "" },
    tenant: { type: String, default: "", index: true },
    tenantCount: { type: String, default: "" },
    phone: { type: String, default: "", index: true },
    carPlate: { type: String, default: "", index: true },

    statusArabic: { type: String, default: "" },
    paymentArabic: { type: String, default: "" },

    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },

    validityClass: {
      type: String,
      enum: ["valid", "warning", "invalid"],
      default: "warning"
    },
    validityText: { type: String, default: "" },
    validityNote: { type: String, default: "" },

    clientUrl: { type: String, default: "" },
    source: { type: String, default: "manual" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Permit", PermitSchema);