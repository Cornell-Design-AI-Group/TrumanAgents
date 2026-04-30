// createSession.js
// Usage: node createSession.js <sessionName>

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const mongoose = require("mongoose");

const Session = require("./models/Session"); // Mongoose model for sessions
const Scenario = require("./models/Scenario"); // Mongoose model for scenarios

async function main() {
  const sessionName = process.argv[2];
  if (!sessionName) {
    console.error("Usage: node createSession.js <sessionName>");
    process.exit(1);
  }

  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Fetch all scenario documents, sorted by their `level` field
  const scenarios = await Scenario.find({})
    .sort({ level: 1 })
    .select("_id")
    .lean();

  if (!scenarios.length) {
    console.error("No scenarios found in database.");
    process.exit(1);
  }

  // Build the session document
  const scenarioIds = scenarios.map((s) => s._id);
  const sessionDoc = new Session({
    name: sessionName,
    level: 1, // default starting level
    scenarios: scenarioIds, // ordered array of scenario _id's
  });

  // Insert or update existing session
  const existing = await Session.findOne({ name: sessionName });
  if (existing) {
    existing.level = sessionDoc.level;
    existing.scenarios = sessionDoc.scenarios;
    await existing.save();
    console.log(
      `Updated session '${sessionName}' with ${scenarioIds.length} scenarios.`,
    );
  } else {
    await sessionDoc.save();
    console.log(
      `Created session '${sessionName}' with ${scenarioIds.length} scenarios.`,
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
