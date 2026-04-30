const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Session Schema
 * Stores a sequence of scenarios to run for a given session.
 * Includes an ordered list of scenarios and the current level number.
 */
const SessionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // An ordered list of Scenario IDs for this session
    scenarios: [
      {
        type: Schema.Types.ObjectId,
        ref: "Scenario",
        required: true,
      },
    ],

    // Current level for this session; defaults to 1 and can be updated on level switch
    level: {
      type: Number,
      required: true,
      default: 1,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Session", SessionSchema);
