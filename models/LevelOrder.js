const mongoose = require("mongoose");

const LevelOrderSchema = new mongoose.Schema({
  level: { type: Number, required: true },
  folder: { type: String, required: true },
});

module.exports = mongoose.model("LevelOrder", LevelOrderSchema);
