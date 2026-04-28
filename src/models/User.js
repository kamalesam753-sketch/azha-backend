const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "supervisor", "viewer", "guard", "scanner"],
      default: "guard"
    },
    fullName: {
      type: String,
      default: ""
    },
    gateName: {
      type: String,
      default: "Gate Security"
    },
    gateLocation: {
      type: String,
      default: "Main Gate"
    },
    status: {
      type: String,
      enum: ["active", "inactive", "disabled"],
      default: "active"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);