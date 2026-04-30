// scripts/backfillUserSessions.js
require("dotenv").config();
const mongoose = require("mongoose");

const User = require("./models/User");
const UserSession = require("./models/UserSession");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {});
  console.log("Connected to Mongo");

  const cursor = User.find({
    role: { $ne: "admin" },
    session: { $exists: true },
  })
    .select("_id session")
    .cursor();

  let created = 0,
    seen = 0;
  for (let u = await cursor.next(); u != null; u = await cursor.next()) {
    seen++;
    const exists = await UserSession.findOne({
      userId: u._id,
      sessionId: u.session,
      status: "active",
    }).lean();

    if (!exists) {
      await UserSession.create({
        userId: u._id,
        sessionId: u.session,
        level: 1,
        scenarioIndex: 0,
        status: "active",
      });
      created++;
    }
  }

  console.log(`Scanned ${seen} users; created ${created} UserSession(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
