const http = require("http");
const express = require("express");
const app = require("./app");
const { Server } = require("socket.io");

const levelState = require("./controllers/levelState");
const SessionModel = require("./models/Session");
const Chat = require("./models/Chat");
const User = require("./models/User");
const Grader = require("./controllers/Grader");
const ScoreController = require("./controllers/ScoreController");
const Comment = require("./models/Comment");
const {
  getCurrentLevel,
  setCurrentLevel,
} = require("./controllers/multi_user");
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});
const sessionName = process.env.SESSION_NAME;
const scoreController = new ScoreController();

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);
  socket.on("resetLevel", async ({ level }) => {
    try {
      //console.log(`🔄 Resetting level ${level} for session ${socket.request.sessionID}`);
      // Clear all scores and state

      const allComments = await Comment.find();
      console.log("📋 All comments:", allComments);

      const userComments = await Comment.find({ commentType: "User" });
      console.log("👤 User comments before deletion:", userComments);

      await Comment.deleteMany({
        commentType: "User",
      });

      const user = socket.request?.user;
      if (!user) {
        console.warn("socket resetLevel ignored: no authenticated user");
        return;
      }

      await setCurrentLevel(level, user);

      console.log(`✅ Reset level ${level}`);
    } catch (err) {
      console.error("⚠️ Error resetting level:", err);
    }
  });
});

let broadcastInterval = null;

function startScoreBroadcastLoop() {
  if (broadcastInterval) clearInterval(broadcastInterval);

  broadcastInterval = setInterval(async () => {
    const timeLeft = levelState.getTimeLeft();
    try {
      const scores = ScoreController.getAllScores
        ? await ScoreController.getAllScores()
        : [];
      io.emit("scoreUpdate", scores);
    } catch (err) {
      console.warn("scoreUpdate broadcast skipped:", err.message);
    }

    if (timeLeft <= 0) {
      clearInterval(broadcastInterval);
      broadcastInterval = null;
      console.log("[TIMER] Timer ended.");
    }
  }, 1000);
}

// Start when server boots
startScoreBroadcastLoop();

// Reset route to cleanly restart timer and score
app.get("/reset-level", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required to reset level" });
  }
  const requested = Number(req.query.level);
  const currentLevel = Number.isFinite(requested) && requested > 0 ? requested : 1;
  console.log(`[RESET] Resetting level ${currentLevel}`);
  await setCurrentLevel(currentLevel, req.user);

  // Archive chats
  const archivedChats = await Chat.updateMany(
    { level: currentLevel },
    { $set: { level: currentLevel + 8 } }
  );
  console.log(`[RESET] Archived ${archivedChats.modifiedCount} chat(s)`);

  // Archive user comments
  const archivedUserComments = await Comment.updateMany(
    { commentType: "User", level: currentLevel },
    { $set: { level: currentLevel + 8 } }
  );
  console.log(`[RESET] Archived ${archivedUserComments.modifiedCount} user comment(s)`);

  // Archive TrumanWorld comments
  const archivedTWComments = await Comment.updateMany(
    { level: currentLevel, TrumanWorld: true },
    { $set: { level: currentLevel + 8 } }
  );
  console.log(`[RESET] Archived ${archivedTWComments.modifiedCount} TrumanWorld comment(s)`);

  await User.updateMany(
    { "objectiveProgress.level": currentLevel },
    {
      $set: {
        "objectiveProgress.$[elem].completed": false,
        "objectiveProgress.$[elem].completedAt": null,
      },
    },
    { arrayFilters: [{ "elem.level": currentLevel }] }
  );

  levelState.resetLevelStartTime();
  scoreController.setUser(req.user);
  await scoreController.resetScores(currentLevel);
  const currentUserLevel = await getCurrentLevel(req.user);
  const grader = new Grader({
    level: currentUserLevel,
    scoreController,
    user: req.user,
  });
  await grader.resetLevel(currentUserLevel);

  setTimeout(() => res.redirect(`/feed?level=${currentLevel}`), 100);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`running on port ${PORT}`);
});
