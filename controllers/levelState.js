let levelStartTime = Date.now();
function resetLevelStartTime() {
  levelStartTime = Date.now();
}

function getLevelStartTime() {
  return levelStartTime;
}

// 💡 Dynamic duration based on level
function getTotalDuration() {
  return 480;
}

function getTimeLeft() {
  const elapsed = Math.floor((Date.now() - levelStartTime) / 1000);
  return Math.max(0, getTotalDuration() - elapsed);
}

module.exports = {
  getTimeLeft,
  getLevelStartTime,
  resetLevelStartTime,
  getTotalDuration,
};
