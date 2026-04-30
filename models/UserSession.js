const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },

    // Per-user progress (do NOT use Session.level anymore)
    level: { type: Number, default: 1 },
    scenarioIndex: { type: Number, default: 0 }, // pointer into Session.scenarios
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },

    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
  },
  { timestamps: true },
);

UserSessionSchema.index({ userId: 1, sessionId: 1, status: 1 });

module.exports = mongoose.model("UserSession", UserSessionSchema);
