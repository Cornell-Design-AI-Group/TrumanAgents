/**
 * Module dependencies.
 */
require("dotenv").config();

const express = require("express");
const compression = require("compression");
const session = require("express-session");
const bodyParser = require("body-parser");
const logger = require("morgan");
const errorHandler = require("errorhandler");
const lusca = require("lusca");
const dotenv = require("dotenv");
const MongoStore = require("connect-mongo");
const flash = require("express-flash");
const path = require("path");
const mongoose = require("mongoose");
const passport = require("passport");
const schedule = require("node-schedule");
const multer = require("multer");
const fs = require("fs");
const util = require("util");
fs.readFileAsync = util.promisify(fs.readFile);
const http = require("http");
const { Server } = require("socket.io");

const Grader = require("./controllers/Grader");
const UserSession = require("./models/UserSession");
const SessionModel = require("./models/Session");
const sessionName = process.env.SESSION_NAME;
const pendingActions = [];
let backgroundUser = null; // set from authenticated requests for background jobs
/**
 * Multer storage
 */
const userpost_options = multer.diskStorage({
  destination: path.join(__dirname, "uploads/user_post"),
  filename: function (req, file, cb) {
    const lastsix = req.user.id.substr(req.user.id.length - 6);
    const prefix = lastsix + Math.random().toString(36).slice(2, 10);
    cb(null, prefix + file.originalname.replace(/[^A-Z0-9]+/gi, "_"));
  },
});
const useravatar_options = multer.diskStorage({
  destination: path.join(__dirname, "uploads/user_avatar"),
  filename: function (req, file, cb) {
    const prefix = req.user.id + Math.random().toString(36).slice(2, 10);
    cb(null, prefix + file.originalname.replace(/[^A-Z0-9]+/gi, "_"));
  },
});
const userpostupload = multer({ storage: userpost_options });
const useravatarupload = multer({ storage: useravatar_options });
const csrf = lusca.csrf();

/**
 * Load env
 */
dotenv.config({ path: ".env" });

/**
 * Controllers
 */
const actorsController = require("./controllers/actors");
const scriptController = require("./controllers/script");
const userController = require("./controllers/user");
const chatController = require("./controllers/chat");
const ScoreController = require("./controllers/ScoreController");
const scoreController = new ScoreController();
const {
  getUserLevel,
  resetLevelStartTime,
  getCurrentLevel,
  setCurrentLevel,
  getLevelDuration,
  getUserTimeLeft,
} = require("./controllers/multi_user");

/**
 * Models
 */
const Comment = require("./models/Comment");
const Objective = require("./models/Objective");
const Chat = require("./models/Chat.js");
const User = require("./models/User");

/**
 * Passport
 */
const passportConfig = require("./config/passport");

/**
 * App + server
 */
const app = express();
const server = http.createServer(app);
const io = new Server(server);

/**
 * Mongo
 */
mongoose.connect(process.env.MONGODB_URI, {});
mongoose.connection.once("open", () => {
  console.log("MongoDB connected, watching agents, chats, and comments…");
  const changeStream = mongoose.connection.db.watch(
    [{ $match: { "ns.coll": { $in: ["agents", "chats", "comments"] } } }],
    { fullDocument: "updateLookup" },
  );
  changeStream.on("change", (change) => {
    const entry = {
      op: change.operationType,
      coll: change.ns.coll,
      doc: change.fullDocument || change.documentKey,
    };
    pendingActions.push(entry);
    io.emit("db-change", entry);
  });
  changeStream.on("error", (err) => console.error("Change stream error:", err));
});
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});

/**
 * Cron: stillActive
 */
const rule1 = new schedule.RecurrenceRule();
rule1.hour = 4;
rule1.minute = 30;
const rule2 = new schedule.RecurrenceRule();
rule2.hour = 12;
rule2.minute = 30;
const rule3 = new schedule.RecurrenceRule();
rule3.hour = 20;
rule3.minute = 30;
schedule.scheduleJob(rule1, () => userController.stillActive());
schedule.scheduleJob(rule2, () => userController.stillActive());
schedule.scheduleJob(rule3, () => userController.stillActive());

/**
 * Grader (every 10s)
 */
schedule.scheduleJob("*/10 * * * * *", async () => {
  const toGrade = pendingActions.splice(0, pendingActions.length);
  if (toGrade.length === 0) return;
  try {
    const user = backgroundUser;
    if (!user) return;
    scoreController.setUser(user);
    const lvl = getUserLevel(user);
    const grader = new Grader({ level: lvl, scoreController, user });
    await grader.init();
    const { matched, unmatchedReasons } =
      await grader.classifyActionsWithLLM(toGrade);
    console.log("Classified categories:", matched);
    const newHealth = await grader.applyDeltas(matched);
    console.log(`Level ${lvl} health updated to ${newHealth}`);
    await grader.processNextSteps(matched);
    await grader.finalizeAfterGrading(matched, unmatchedReasons);

    const cat = grader.currentCategory;
    if (cat && unmatchedReasons && typeof unmatchedReasons === "object") {
      // normalize keys for case/space differences
      const norm = (s) => (s || "").trim().toLowerCase();
      const reason =
        unmatchedReasons[cat] ??
        unmatchedReasons[norm(cat)] ??
        Object.entries(unmatchedReasons).find(
          ([k]) => norm(k) === norm(cat),
        )?.[1];

      if (reason) {
        console.log("[Grader] Emitting objectiveFeedback:", {
          category: cat,
          reason,
        });
        io.emit("objectiveFeedback", {
          category: cat, // send explicit category
          unmatchedReasons: { [cat]: String(reason) },
        });
      }
    }
  } catch (err) {
    console.error("Grader job error:", err);
  }
});

/**
 * Express config
 */
app.set("port", process.env.PORT || 3000);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use(compression());
app.use(
  logger("dev", {
    skip: (req) => req.path.startsWith("/api/objectives"),
  }),
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Sessions (share with socket.io)
 */
const sessionMiddleware = session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  cookie: { path: "/", httpOnly: true, secure: false, maxAge: 86400000 },
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "express-sessions",
  }),
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

/**
 * Attach io to req
 */
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(passport.initialize());
app.use(passportConfig.authenticate);
app.use((req, res, next) => {
  if (req.user) backgroundUser = req.user;
  next();
});

/**
 * 🔰 LEVEL MIDDLEWARE
 * - Use authenticated user level; allow ?level override
 * - Expose to views as res.locals.level
 */
app.use(async (req, res, next) => {
  try {
    if (!req.user) {
      res.locals.currentLevel = 1;
      res.locals.level = 1;
      currentLevel = 1;
      return next();
    }

    const fromQuery = Number(req.query.level);
    if (Number.isFinite(fromQuery) && fromQuery > 0) {
      await setCurrentLevel(fromQuery, req.user);
    }

    const level = await getCurrentLevel(req.user);
    const effective =
      Number.isFinite(fromQuery) && fromQuery > 0 ? fromQuery : level || 1;

    res.locals.currentLevel = effective;
    res.locals.level = effective;

    // Keep legacy singleton in sync
    currentLevel = effective;

    next();
  } catch (err) {
    next(err);
  }
});

app.use(flash());

app.use(
  lusca.csrf({
    blocklist: [
      "/action",
      "/post/new",
      "/actors/new",
      "/account/profile",
      "/account/signup_info_post",
      "/signup",
      "/login",
      "/score/reset",
    ],
  }),
);
app.use(lusca.xframe("SAMEORIGIN"));
app.use(lusca.xssProtection(true));
app.disable("x-powered-by");

/**
 * Locals
 */
app.use((req, res, next) => {
  // Expose CSRF token to views that render forms
  if (typeof req.csrfToken === "function") {
    try {
      res.locals._csrf = req.csrfToken();
    } catch (err) {
      // Ignore token errors here; lusca middleware will handle invalid/missing cases
    }
  }
  res.locals.user = req.user;
  res.locals.cdn = process.env.CDN;
  const hideChatPages = new Set(["/login", "/signup", "/info"]);
  res.locals.showChat = !!req.user && !hideChatPages.has(req.path);
  next();
});

/**
 * Return-to middleware
 */
app.use((req, res, next) => {
  if (
    !req.user &&
    req.path !== "/login" &&
    req.path !== "/signup" &&
    req.path !== "/pageLog" &&
    req.path !== "/pageTimes" &&
    !req.path.match(/\./)
  ) {
    req.session.returnTo = req.originalUrl;
  }
  next();
});

/**
 * Static
 */
app.use(
  "/public",
  express.static(path.join(__dirname, "public"), { maxAge: 31557600000 }),
);
app.use(
  "/semantic",
  express.static(path.join(__dirname, "semantic"), { maxAge: 31557600000 }),
);
app.use(
  express.static(path.join(__dirname, "uploads"), { maxAge: 31557600000 }),
);
app.use(
  "/post_pictures",
  express.static(path.join(__dirname, "public", "post_pictures"), {
    maxAge: 31557600000,
  }),
);
app.use(
  "/profile_pictures",
  express.static(path.join(__dirname, "public", "profile_pictures"), {
    maxAge: 31557600000,
  }),
);
app.use(
  "/user_post",
  express.static(path.join(__dirname, "uploads", "user_post"), {
    maxAge: 31557600000,
  }),
);
app.use(
  "/user_avatar",
  express.static(path.join(__dirname, "public", "profile_pictures"), {
    maxAge: 31557600000,
  }),
);

async function loadUserSession(req, res, next) {
  try {
    // req.user.session is the assigned track/template (from User.js)
    const sessionId = req.user?.session;
    if (!sessionId) {
      return res
        .status(400)
        .json({ error: "User has no assigned session (track)." });
    }

    let us = await UserSession.findOne({
      userId: req.user._id,
      sessionId,
      status: "active",
    });

    if (!us) {
      us = await UserSession.create({
        userId: req.user._id,
        sessionId,
        level: 1,
        scenarioIndex: 0,
        status: "active",
      });
    }

    req.userSession = us;
    // convenience for templates
    res.locals.level = us.level;
    res.locals.currentLevel = us.level;
    next();
  } catch (err) {
    next(err);
  }
}
app.get(
  "/",
  passportConfig.isAuthenticated,
  loadUserSession,
  scriptController.getScript,
);

app.get("/chat", chatController.getChat);
app.post("/chat", chatController.postChatAction);

app.post(
  "/post/new",
  userpostupload.single("picinput"),
  csrf,
  scriptController.newPost,
);

// Feed page (per-user level already resolved by middleware)
app.get(
  "/feed",
  passportConfig.isAuthenticated,
  loadUserSession,
  scriptController.getScript,
);
app.post(
  "/pageLog",
  passportConfig.isAuthenticated,
  userController.postPageLog,
);
app.post(
  "/pageTimes",
  passportConfig.isAuthenticated,
  userController.postPageTime,
);

app.get("/com", (req, res) => {
  const feed = req.query.feed == "true";
  res.render("com", { title: "Community Rules", feed });
});

app.get("/info", passportConfig.isAuthenticated, (req, res) => {
  res.render("info", { title: "User Docs" });
});

app.get("/tos", (req, res) => res.render("tos", { title: "Terms of Service" }));

app.get(
  "/completed",
  passportConfig.isAuthenticated,
  userController.userTestResults,
);

app.get("/login", userController.getLogin);
app.post("/login", userController.postLogin);
app.get("/logout", userController.logout);
app.get("/forgot", userController.getForgot);
app.get("/signup", userController.getSignup);
app.post("/signup", userController.postSignup);

app.get("/account", passportConfig.isAuthenticated, userController.getAccount);
app.post(
  "/account/password",
  passportConfig.isAuthenticated,
  userController.postUpdatePassword,
);
app.post(
  "/account/profile",
  passportConfig.isAuthenticated,
  useravatarupload.single("picinput"),
  csrf,
  userController.postUpdateProfile,
);
app.get(
  "/account/signup_info",
  passportConfig.isAuthenticated,
  csrf,
  (req, res) => {
    res.render("account/signup_info", { title: "Add Information" });
  },
);
app.post(
  "/account/signup_info_post",
  passportConfig.isAuthenticated,
  useravatarupload.single("picinput"),
  csrf,
  userController.postSignupInfo,
);
app.post(
  "/account/consent",
  passportConfig.isAuthenticated,
  userController.postConsent,
);

app.get(
  "/user/:username",
  passportConfig.isAuthenticated,
  actorsController.getActor,
);
app.post(
  "/user",
  passportConfig.isAuthenticated,
  actorsController.postBlockReportOrFollow,
);

app.get("/actors", passportConfig.isAuthenticated, actorsController.getActors);
app.get(
  "/actors/new",
  passportConfig.isAuthenticated,
  csrf,
  actorsController.getNewActor,
);
app.post(
  "/actors/new",
  useravatarupload.single("picinput"),
  csrf,
  actorsController.postNewActor,
);

app.post(
  "/action",
  passportConfig.isAuthenticated,
  scriptController.postAction,
);
app.post(
  "/feed",
  passportConfig.isAuthenticated,
  scriptController.postUpdateFeedAction,
);

app.get("/test", passportConfig.isAuthenticated, (req, res) => {
  res.render("test", { title: "Test" });
});

app.get("/reset-level", async (req, res) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ error: "Authentication required to reset level" });
  }
  const requested = Number(req.query.level);
  await setCurrentLevel(requested, req.user);
  const level = await getCurrentLevel(req.user);
  console.log(`[RESET] Resetting level ${level}`);

  const targetLevel = level + 8;
  console.log(`[RESET] Resetting level ${level} (reinsert to ${targetLevel})`);

  const chatsToClone = await Chat.find({ level }).lean();
  const userCommentsToClone = await Comment.find({
    commentType: "User",
  }).lean();
  const twCommentsToClone = await Comment.find({
    level,
    TrumanWorld: true,
  }).lean();

  const allComments = await Comment.find();
  console.log("📋 All comments:", allComments);

  const userComments = await Comment.find({ commentType: "User" });
  console.log("👤 User comments before deletion:", userComments);

  const deletedChats = await Chat.deleteMany({ level });
  console.log(
    `[RESET] Deleted ${deletedChats.deletedCount} chat(s) for level ${level}`,
  );

  await Comment.deleteMany({ commentType: "User" });

  //Delete trumanworld comments
  const deletedTWComments = await Comment.deleteMany({
    level,
    TrumanWorld: true,
  });

  console.log(
    `[RESET] Deleted ${deletedTWComments.deletedCount} TrumanWorld comment(s) for level ${level}`,
  );

  const bumpLevel = (doc) => {
    const { _id, __v, ...rest } = doc;
    return { ...rest, level: targetLevel }; // <-- now in scope
  };

  if (chatsToClone.length) {
    const archivedChats = chatsToClone.map((doc) => {
      const { _id, __v, ...rest } = doc;
      return {
        ...rest,
        chat_id: rest.chat_id ? rest.chat_id + "_archive" : undefined,
        level: targetLevel,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    await Chat.insertMany(archivedChats);
    console.log(
      `[RESET] Archived ${archivedChats.length} chat(s) at level ${targetLevel}`,
    );
  }

  if (userCommentsToClone.length) {
    await Comment.insertMany(userCommentsToClone.map(bumpLevel));
    console.log(
      `[RESET] Reinserted ${userCommentsToClone.length} user comment(s) at level ${targetLevel}`,
    );
  }

  if (twCommentsToClone.length) {
    await Comment.insertMany(twCommentsToClone.map(bumpLevel));
    console.log(
      `[RESET] Reinserted ${twCommentsToClone.length} TrumanWorld comment(s) at level ${targetLevel}`,
    );
  }
  await User.updateMany(
    { "objectiveProgress.level": level },
    {
      $set: {
        "objectiveProgress.$[elem].completed": false,
        "objectiveProgress.$[elem].completedAt": null,
      },
    },
    { arrayFilters: [{ "elem.level": level }] },
  );

  await resetLevelStartTime(req.user);
  scoreController.setUser(req.user);
  await scoreController.resetScores(level);
  const grader = new Grader({ level, scoreController, user: req.user });
  await grader.resetLevel(level);

  setTimeout(() => res.redirect(`/feed?level=${level}`), 100);
});

app.get("/api/objectives", passportConfig.isAuthenticated, async (req, res) => {
  try {
    const level = parseInt(req.query.level, 10);
    if (!level)
      return res.status(400).json({ error: "Missing level query param" });

    const objectives = await Objective.find({ level }).lean();
    const response = objectives.map((obj) => ({
      _id: obj._id,
      label: obj.label,
      description: obj.description,
      completed: !!obj.completed,
      hint: obj.hint || "",
      order: obj.order ?? 0,
    }));
    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching objectives:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Errors
 */
app.use(errorHandler());
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});
app.use((err, req, res) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

/**
 * Socket
 */
io.on("connection", (socket) => {
  const req = socket.request;
  userController.joinRooms(socket);
  const passportSession = req.session?.passport;
  const userId = passportSession?.user;
  let userDoc = null;
  let scoreInterval = null;
  let userScoreController = null;

  const loadUser = async () => {
    if (!userId) return null;
    userDoc = await User.findById(userId);
    return userDoc;
  };

  const emitScoreForUser = async () => {
    try {
      const u = await loadUser();
      if (!u) return;
      if (!userScoreController) userScoreController = new ScoreController(u);
      userScoreController.setUser(u);
      const lvl = getUserLevel(u);
      const healthScore = await userScoreController.getHealthScore(lvl);
      const { timeLeft, totalTime } = await getUserTimeLeft(u);
      if (!(typeof healthScore === "number" && !isNaN(healthScore))) return;
      socket.emit("scoreUpdate", {
        healthScore,
        level: lvl,
        timeLeft,
        totalTime,
      });
    } catch (err) {
      console.error("Score update error (socket user):", err);
    }
  };

  // start per-user score/timer emitter (1s)
  emitScoreForUser();
  scoreInterval = setInterval(emitScoreForUser, 1000);

  socket.use((_, next) => {
    req.session.reload((err) => (err ? socket.disconnect() : next()));
  });

  socket.on("chat message", (msg) =>
    socket.broadcast.emit("chat message", msg),
  );
  socket.on("chat typing", (msg) => socket.broadcast.emit("chat typing", msg));

  socket.on("levelChanged", async ({ level }) => {
    const lv = Number(level) || 1;
    console.log(`📣 Level changed to ${lv}`);
    const user = await loadUser();
    if (!user) {
      console.warn("levelChanged ignored: no authenticated user on socket");
      return;
    }
    scoreController.setUser(user);
    await scoreController.resetScores(lv);
    await setCurrentLevel(lv, user);
    await resetLevelStartTime(user);
  });

  socket.on("resetLevel", async ({ level }) => {
    try {
      const lv = Number(level) || 1;
      console.log(`[RESET] (socket) Resetting level ${lv}`);

      const user = await loadUser();
      if (!user) {
        console.warn("resetLevel ignored: no authenticated user on socket");
        return;
      }

      await setCurrentLevel(lv, user);
      await SessionModel.findOneAndUpdate({ name: sessionName }, { level: lv });

      const allComments = await Comment.find();
      console.log("📋 All comments:", allComments);

      const userComments = await Comment.find({ commentType: "User" });
      console.log("👤 User comments before deletion:", userComments);

      await Comment.deleteMany({ commentType: "User" });

      const objectives = await Objective.find({ level: lv });
      for (const obj of objectives) {
        obj.completed = false;
        await obj.save();
      }

      await resetLevelStartTime(user);
      scoreController.setUser(user);
      await scoreController.resetScores(lv);

      console.log(`✅ Socket: Level ${lv} reset complete`);
      socket.emit("levelResetConfirmed", { level: lv });
    } catch (err) {
      console.error("❌ Socket: Failed to reset level:", err);
      socket.emit("levelResetFailed", { error: err.message });
    }
  });

  socket.on("error", (err) => console.log(err));

  socket.on("disconnect", () => {
    if (scoreInterval) clearInterval(scoreInterval);
  });
});

/**
 * Start
 */
server.listen(app.get("port"), () => {
  console.log(
    `App is running on http://localhost:${app.get("port")} in ${app.get("env")} mode.`,
  );
  console.log("  Press CTRL-C to stop\n");
});

module.exports = app;
