const mongoose = require("mongoose");

const NextStepSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    agent: { type: String, default: "" },
    content: { type: String, required: true },
  },
  { _id: false },
);

const SolutionSchema = new mongoose.Schema({
  level: { type: Number, required: true, index: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  deltas: { type: Number, default: 0 },
  type: { type: [String], default: "" },
  next_steps: { type: [NextStepSchema], default: [] },
  done: { type: Boolean, default: false },
});

module.exports = mongoose.model("Solution", SolutionSchema);
