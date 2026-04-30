const mongoose = require("mongoose");
const { Schema } = mongoose;

const objectiveSchema = new Schema({
  level: {
    type: Number,
    required: true,
  },
  goalCategory: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  hint: {
    type: String,
    default: null,
  },
  isRequired: {
    type: Boolean,
    default: false,
  },
  isComposite: {
    type: Boolean,
    default: false,
  },
  required: {
    type: [String],
    default: [],
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
  },
  order: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model("Objective", objectiveSchema);
