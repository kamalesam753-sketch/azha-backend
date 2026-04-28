const mongoose = require("mongoose");

const PermitTokenSchema = new mongoose.Schema(
  {
    permitId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true
    },
    regeneratedAt: { type: Date },
    disabledBy: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PermitToken", PermitTokenSchema);