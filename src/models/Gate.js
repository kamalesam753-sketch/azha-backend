const mongoose = require("mongoose");

const GateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    location: {
      type: String,
      default: "",
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Gate", GateSchema);
