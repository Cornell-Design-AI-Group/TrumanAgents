// manual_checkoff.js
require("dotenv").config();
const mongoose = require("mongoose");

const Solution = require("./models/Solution");
const Objective = require("./models/Objective");
const User = require("./models/User");
const ScoreController = require("./controllers/ScoreController");
const Grader = require("./controllers/Grader"); // ⭐ so we can reuse processNextSteps

function args() {
  const out = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--")) {
      const [k, v] = a.replace(/^--/, "").split("=");
      out[k] = v === undefined ? true : v;
    }
  }
  return out;
}

(async () => {
  const { level, category, delta, userId } = args();
  if (!level || !category || !userId) {
    console.log(
      'Usage: node manual_checkoff.js --level=1 --category="YourCategory" --userId=<userId> [--delta=5]',
    );
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);

  if (!userId) {
    throw new Error("manual_checkoff requires --userId for a specific user");
  }

  const user = await User.findById(userId);
  if (!user) throw new Error(`No user found for manual checkoff: ${userId}`);

  // 1) load solution
  const sol = await Solution.findOne({ level: Number(level), category }).exec();
  if (!sol)
    throw new Error(`No Solution for level=${level}, category="${category}"`);

  if (typeof delta !== "undefined") {
    if (typeof sol.deltas !== "undefined") sol.deltas = Number(delta);
    else sol.delta = Number(delta);
  }

  // 2) mark solution done
  sol.done = true;
  await sol.save();
  console.log(
    `✔ Marked solution done: [L${level}] ${category}${
      delta !== undefined ? ` (delta=${Number(delta)})` : ""
    }`,
  );

  // 3) complete simple objectives that match this category (per-user progress only)
  const now = new Date();
  const objectives = await Objective.find({ level: Number(level) }).lean();

  const progressById = new Map();
  if (Array.isArray(user.objectiveProgress)) {
    for (const entry of user.objectiveProgress) {
      if (!entry?.objective) continue;
      if (Number(entry.level) !== Number(level)) continue;
      progressById.set(String(entry.objective), entry);
    }
  }

  const ensureProgress = (objId) => {
    const existing = progressById.get(String(objId));
    if (existing) return existing;
    const entry = {
      objective: objId,
      level: Number(level),
      completed: false,
      completedAt: null,
    };
    progressById.set(String(objId), entry);
    return entry;
  };

  for (const obj of objectives.filter((o) => o.goalCategory === category)) {
    const prog = ensureProgress(obj._id);
    if (!prog.completed) {
      prog.completed = true;
      prog.completedAt = now;
      console.log(`✅ Objective completed for user ${user.username}: ${obj.label}`);
    }
  }

  // 4) complete composite objectives if all required categories are already done
  const composites = objectives.filter((o) => o.isComposite);

  const doneSols = await Solution.find({ level: Number(level), done: true })
    .select("category")
    .lean();

  const doneSet = new Set(doneSols.map((s) => s.category));
  for (const obj of composites) {
    const reqs = Array.isArray(obj.requires) ? obj.requires : [];
    const allMet = reqs.length > 0 && reqs.every((c) => doneSet.has(c));
    if (allMet) {
      const prog = ensureProgress(obj._id);
      if (!prog.completed) {
        prog.completed = true;
        prog.completedAt = new Date();
        console.log(`🏁 Composite objective completed for user ${user.username}: ${obj.label}`);
      }
    }
  }

  // Persist per-user objective progress
  const otherLevels = (user.objectiveProgress || []).filter(
    (p) => Number(p.level) !== Number(level),
  );
  user.objectiveProgress = [...otherLevels, ...progressById.values()];
  await user.save();
  console.log(
    `💾 Saved objective progress for ${user.username} at level ${level}`,
  );

  // 5) ⭐ apply score delta like Grader
  const scoreController = new ScoreController(user);
  const currentScore = await scoreController.getHealthScore(Number(level));
  const deltaVal =
    delta !== undefined ? Number(delta) : (sol.deltas ?? sol.delta ?? 0);
  const newScore = currentScore + deltaVal;
  await scoreController.setHealthScore(Number(level), newScore);
  console.log(`💯 Health score updated: ${currentScore} → ${newScore}`);

  // 6) ⭐ run processNextSteps like Grader
  const grader = new Grader({ level: Number(level), scoreController, user });
  // ⭐ Force-load all solutions for this level, not just undone ones
  grader.solutions = await Solution.find({ level: Number(level) }).lean();
  await grader.processNextSteps([category]);

  await mongoose.disconnect();
  console.log("Done.");
})().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
