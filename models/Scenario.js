const mongoose = require("mongoose");

const scenarioSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
});

const Scenario = mongoose.model("Scenario", scenarioSchema);
module.exports = Scenario;
