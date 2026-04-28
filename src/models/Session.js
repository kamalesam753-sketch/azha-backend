const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    sessionToken: {
      type: String,
      required: true,
      unique: true
    },
    username: String,
    role: String,
    fullName: String,
    gateName: String,
    gateLocation: String,
    deviceInfo: String,
    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active"
    },
    expiresAt: {
      type: Date,
      required: true
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", SessionSchema);