// services/impactService.js

exports.analyzeFailedLevelActions = async (actions, score) => {
  const impact = await generateImpactSummary(actions);
  const harmful = analyzeNegativeActions(impact);
  return { summary: "Level analysis completed", harmfulActions: harmful };
};

async function generateImpactSummary(actions) {
  const grader = new Grader("./scenarios/jessie-level1/solutions.json");

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
