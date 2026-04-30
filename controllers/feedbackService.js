// services/impactService.js

const Agent = require("../models/Agent");
const ScoreController = require("../controllers/ScoreController");
const Grader = require("./Grader"); // assuming it's in services/

async function generateImpactSummary(actions) {
  const grader = new Grader("./solutions.json");

  const agentsBefore = await Agent.find().lean();
  const scoreBefore = ScoreController.computeScores(agentsBefore);

  const classified = await grader.classifyActionsWithLLM(actions);
  const fieldChanges = await grader.applyDeltas(classified);

  const agentsAfter = await Agent.find().lean();
  const scoreAfter = ScoreController.computeScores(agentsAfter);

  return {
    bystanderDelta: scoreAfter.bystanderScore - scoreBefore.bystanderScore,
    bullyDelta: scoreAfter.bullyScore - scoreBefore.bullyScore,
    healthDelta: scoreAfter.healthScore - scoreBefore.healthScore,
    scoreBefore,
    scoreAfter,
    actions: classified,
    fieldChanges,
  };
}

async function analyzeFailedLevelActions(userActions, user) {
  const agents = await Agent.find().lean();
  const harmfulSummaries = [];

  for (const action of userActions) {
    const impactSummary = await generateImpactSummary([action]);
    const harmList = analyzeNegativeActions(impactSummary, agents);

    if (harmList.length > 0) {
      const details = await getActionDetails(
        harmList[0].actionId,
        impactSummary,
        user,
      );
      harmfulSummaries.push({ ...details, harm: harmList[0].harm });
    }
  }

  return harmfulSummaries.sort((a, b) => b.harm - a.harm);
}

module.exports = {
  generateImpactSummary,
  analyzeFailedLevelActions,
};
