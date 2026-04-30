function getUserLevel(user) {
  const lvl = Number(user?.levelState?.level);
  return Number.isFinite(lvl) && lvl > 0 ? lvl : 1;
}

function getLevelDuration(level) {
  return 480; //8 min for all levels
}

async function getCurrentLevel(user) {
  if (!user) throw new Error("getCurrentLevel requires a user");
  return getUserLevel(user);
}

async function setCurrentLevel(newLevel, user) {
  if (!user) throw new Error("setCurrentLevel requires a user");

  const levelInt = Number(newLevel);
  if (!Number.isFinite(levelInt) || levelInt < 1) {
    throw new Error(`Invalid level: ${newLevel}`);
  }

  const current = getUserLevel(user);
  if (current === levelInt) return current;

  user.levelState = user.levelState || {};
  user.levelState.level = levelInt;
  user.levelState.levelStartedAt = new Date();

  if (!Array.isArray(user.scores)) user.scores = [];
  if (!user.scores.find((s) => Number(s.level) === levelInt)) {
    user.scores.push({ level: levelInt, score: 0, updated: new Date() });
  }

  // ⭐ LOG THE CHANGE
  // console.log(
  //   `User "${u.username}" (${u._id}) levelState updated → level ${levelInt}`
  // );

  await user.save();
  return levelInt;
}

async function resetLevelStartTime(user) {
  if (!user) throw new Error("resetLevelStartTime requires a user");
  user.levelState = user.levelState || {};
  user.levelState.levelStartedAt = new Date();
  await user.save();
}

function ensureUserScore(user, level) {
  if (!user) throw new Error("ensureUserScore requires a user");
  if (!Array.isArray(user.scores)) user.scores = [];
  const lvl = Number(level) || getUserLevel(user);
  let entry = user.scores.find(
    (s) => Number.isFinite(s.level) && Number(s.level) === lvl,
  );
  if (!entry) {
    entry = { level: lvl, score: 0, updated: new Date() };
    user.scores.push(entry);
  }
  return entry;
}

async function getUserScore(user, level) {
  if (!user) throw new Error("getUserScore requires a user");
  const entry = ensureUserScore(user, level);
  return entry && typeof entry.score === "number" ? entry.score : 0;
}

async function setUserScore(user, level, score) {
  if (!user) throw new Error("setUserScore requires a user");
  const entry = ensureUserScore(user, level);
  entry.score = Number(score) || 0;
  entry.updated = new Date();
  await user.save();
  return entry.score;
}

async function resetUserScores(user, level) {
  if (!user) throw new Error("resetUserScores requires a user");
  const lvl = level ? Number(level) : null;
  if (!Array.isArray(user.scores)) user.scores = [];
  user.scores = user.scores.map((s) =>
    !lvl || Number(s.level) === lvl
      ? { ...(s.toObject?.() ?? s), score: 0, updated: new Date() }
      : s,
  );
  if (lvl && !user.scores.find((s) => Number(s.level) === lvl)) {
    user.scores.push({ level: lvl, score: 0, updated: new Date() });
  }
  await user.save();
}

async function getUserTimeLeft(user) {
  if (!user) throw new Error("getUserTimeLeft requires a user");
  const level = getUserLevel(user);
  const totalTime = getLevelDuration(level);
  const startedAt = user.levelState?.levelStartedAt
    ? new Date(user.levelState.levelStartedAt)
    : new Date();
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const timeLeft = Math.max(0, totalTime - elapsed);
  // console.log(
  //   `[TimeLeft] user=${user?.username || "unknown"} level=${level} total=${totalTime}s elapsed=${elapsed}s timeLeft=${timeLeft}s startedAt=${startedAt.toISOString()}`,
  // );
  return { timeLeft, totalTime, level };
}


module.exports = {
  getUserLevel,
  getCurrentLevel,
  setCurrentLevel,
  resetLevelStartTime,
  getLevelDuration,
  getUserTimeLeft,
  getUserScore,
  setUserScore,
  resetUserScores,
};
