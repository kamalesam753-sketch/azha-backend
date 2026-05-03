/**
 * Watchlist model — security flagging system.
 * Allows security admins to flag people, vehicles, or permits.
 */
const mongoose = require("mongoose");

const watchlistSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["person", "vehicle", "permit"],
      required: true,
      index: true
    },
    value: { type: String, required: true, index: true },
    reason: { type: String, default: "" },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },
    addedBy: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "resolved", "expired"],
      default: "active",
      index: true
    },
    notes: { type: String, default: "" },
    resolvedBy: { type: String, default: "" },
    resolvedAt: { type: Date }
  },
  { timestamps: true }
);

watchlistSchema.index({ type: 1, value: 1, status: 1 });

module.exports = mongoose.model("Watchlist", watchlistSchema);
