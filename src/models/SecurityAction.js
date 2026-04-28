const mongoose = require("mongoose");

const SecurityActionSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    permitId: { type: String, default: "", index: true },
    decision: { type: String, default: "", index: true },
    notes: { type: String, default: "" },

    username: { type: String, default: "" },
    fullName: { type: String, default: "" },
    role: { type: String, default: "" },
    gateName: { type: String, default: "" },
    gateLocation: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SecurityAction", SecurityActionSchema);