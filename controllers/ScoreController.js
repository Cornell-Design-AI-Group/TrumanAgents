// controllers/ScoreController.js
const Agent = require("../models/Agent");
const {
  getUserLevel,
  getCurrentLevel,
  getUserScore,
  setUserScore,
  resetUserScores,
} = require("./multi_user");

class ScoreController {
  constructor(user = null) {
    this.user = user;
  }

  setUser(user) {
    this.user = user;
  }

  /** Set or overwrite the score for a level (per user) */
  async setHealthScore(level, score) {
    const user = this.user;
    if (!user) throw new Error("setHealthScore requires a user");

    const lvl = Number(level) || getUserLevel(user);
    await setUserScore(user, lvl, score);
  }

  /** Fetch the persisted score (or 0 if none) */
  async getHealthScore(level) {
    const user = this.user;
    if (!user) throw new Error("getHealthScore requires a user");

    const lvl = Number(level) || getUserLevel(user);
    return await getUserScore(user, lvl);
  }

  /** Reset scores to zero for the given level (per user) and restore agents */
  async resetScores(level) {
    const user = this.user;
    if (!user) throw new Error("resetScores requires a user");
    const lvl = level ? Number(level) : await getCurrentLevel(user);

    await resetUserScores(user, lvl);

    if (lvl) {
      const agents = await Agent.find({ level: lvl });
      for (const agent of agents) {
        if (agent.initialTraits) {
          Object.assign(agent, agent.initialTraits);
          await agent.save();
        } else {
          console.warn(`⚠️ Agent ${agent.username} has no initialTraits`);
        }
      }
    }
    console.log("[ScoreController] Reset complete (per-user).");
  }
}

module.exports = ScoreController;
