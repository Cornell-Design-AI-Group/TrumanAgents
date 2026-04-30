const passport = require("passport");
const validator = require("validator");
const dotenv = require("dotenv");
dotenv.config({ path: ".env" }); // See the file .env.example for the structure of .env
const helpers = require("./helpers");
const { Actor, validateUsername } = require("../models/Actor");
const Agent = require("../models/Agent");
const User = require("../models/User");
const Session = require("../models/Session");
const Objective = require("../models/Objective");
const LevelOrder = require("../models/LevelOrder");
const Script = require("../models/Script");
const Comment = require("../models/Comment");

/**
 * Duplicate all base (ownerless) scripts/comments into user-owned copies.
 * - Leaves originals untouched.
 * - Skips if this user already has owned scripts.
 */
async function cloneBaseContentForUser(user) {
  const hasCopies = await Script.exists({ ownerUser: user._id });
  if (hasCopies) {
    console.log(
      `[Signup] Skip cloning: user ${user.username} already has owned posts.`,
    );
    return;
  }

  const baseFilter = {
    $or: [{ ownerUser: null }, { ownerUser: { $exists: false } }],
  };
  const basePosts = await Script.find(baseFilter).lean();
  console.log(
    `[Signup] Base posts (ownerUser null/missing): ${basePosts.length}`,
  );
  if (!basePosts.length) return;

  const basePostIds = basePosts.map((p) => p._id);

  // Clone posts without comments array contents
  const newPostDocs = basePosts.map((p) => {
    const { _id, __v, comments, ...rest } = p;
    return { ...rest, ownerUser: user._id, comments: [] };
  });
  const insertedPosts = await Script.insertMany(newPostDocs);

  const postIdMap = new Map();
  for (let i = 0; i < basePosts.length; i++) {
    postIdMap.set(String(basePosts[i]._id), insertedPosts[i]._id);
  }

  // Clone comments and rewire post references
  const baseComments = await Comment.find({
    ...baseFilter,
    post: { $in: basePostIds },
  }).lean();
  console.log(
    `[Signup] Base comments (ownerUser null/missing, linked to base posts): ${baseComments.length}`,
  );

  const commentDocs = baseComments.map((c) => {
    const { _id, __v, ...rest } = c;
    const newPostId = postIdMap.get(String(c.post));
    return { ...rest, post: newPostId, ownerUser: user._id };
  });

  const insertedComments = commentDocs.length
    ? await Comment.insertMany(commentDocs)
    : [];

  // Attach cloned comments to cloned posts
  const commentsByPost = new Map();
  for (const com of insertedComments) {
    const pid = com.post.toString();
    if (!commentsByPost.has(pid)) commentsByPost.set(pid, []);
    commentsByPost.get(pid).push(com._id);
  }

  for (const [pid, ids] of commentsByPost.entries()) {
    await Script.updateOne({ _id: pid }, { $set: { comments: ids } });
  }

  console.log(
    `[Signup] Cloned ${insertedPosts.length} posts and ${insertedComments.length} comments for user ${user.username} (${user._id})`,
  );
}

/**
 * GET /login
 * Render the login page.
 */
exports.getLogin = (req, res, next) => {
  try {
    if (req.user) {
      return res.redirect("/");
    }
    res.render("account/login", {
      title: "Login",
      site_picture: process.env.SITE_PICTURE,
      r_id: req.query.r_id,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /login
 * Handles user sign in using email and password.
 */
exports.postLogin = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: "Please enter a valid email address." });
  if (validator.isEmpty(req.body.password))
    validationErrors.push({ msg: "Password cannot be blank." });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/login");
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false,
  });
  passport.authenticate("local", (err, user, info) => {
    const study_length = 86400000 * process.env.NUM_DAYS; // Milliseconds in NUM_DAYS days
    const time_diff = Date.now() - user.createdAt; // Time difference between now and account creation.
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash("errors", info);
      return res.redirect("/login");
    }
    if (!user.active || (time_diff >= study_length && !user.isAdmin)) {
      const endSurveyLink = user.endSurveyLink;
      req.flash("final", { msg: endSurveyLink });
      return res.redirect("/login");
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      const time_now = Date.now();
      const userAgent = req.headers["user-agent"];
      const user_ip =
        req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      user.logUser(time_now, userAgent, user_ip);
      if (user.consent) {
        res.redirect(req.session.returnTo || "/");
      } else {
        res.redirect("/account/signup_info");
      }
    });
  })(req, res, next);
};

/**
 * GET /logout
 * Handles user log out.
 */
exports.logout = (req, res, next) => {
  try {
    req.logout((err) => {
      if (err) console.log("Error : Failed to logout.", err);
      // Extract the Express session id
      const sessionId = req.session.id;
      req.session.destroy((err) => {
        if (err)
          console.log(
            "Error : Failed to destroy the session during logout.",
            err,
          );
        req.user = null;
        // disconnect all sockets linked to the Express session id
        req.io.in(sessionId).disconnectSockets();
        res.redirect("/");
      });
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /signup
 * Render the signup page.
 */
exports.getSignup = (req, res, next) => {
  try {
    if (req.user) {
      return res.redirect("/");
    }
    res.render("account/signup", {
      title: "Create Account",
      r_id: req.query.r_id,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /signup
 * Handles user sign up and creation of a new account.
 */
exports.postSignup = async (req, res, next) => {
  const validationErrors = [];
  if (!validateUsername(req.body.username)) {
    validationErrors.push({
      msg: "Invalid username. Must contain only letters, numbers, or the following symbols: .-_",
    });
  }
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: "Please enter a valid email address." });
  if (!validator.isLength(req.body.password, { min: 4 }))
    validationErrors.push({
      msg: "Password must be at least 4 characters long.",
    });
  if (
    validator.escape(req.body.password) !==
    validator.escape(req.body.confirmPassword)
  )
    validationErrors.push({ msg: "Passwords do not match." });
  if (validator.isEmpty(req.body.sessionName, { ignore_whitespace: true }))
    validationErrors.push({ msg: "Must specify session ID." });
  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/signup");
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false,
  });

  try {
    const session = await Session.findOne({
      name: req.body.sessionName,
    }).exec();
    if (!session) {
      req.flash("errors", [
        {
          msg: `Unknown session ${req.body.sessionName}.`,
        },
      ]);
      return res.redirect("/signup");
    }

    const existingActor = await Actor.findOne({
      username: req.body.username,
    }).exec();
    const existingAgent = await Agent.findOne({
      username: req.body.username,
    }).exec();
    const existingUser = await User.findOne({
      $or: [
        { username: req.body.username },
        { email: req.body.email },
        { mturkID: req.body.mturkID },
      ],
    }).exec();
    if (existingActor || existingAgent || existingUser) {
      if (
        existingActor ||
        existingAgent ||
        existingUser.username === req.body.username
      ) {
        req.flash("errors", {
          msg: "An account with that username already exists.",
        });
      } else if (existingUser.email === req.body.email) {
        req.flash("errors", {
          msg: "An account with that email address already exists.",
        });
      } else {
        req.flash("errors", {
          msg: "An account with that MTurkID already exists.",
        });
      }
      return res.redirect("/signup");
    }
    /*###############################
        Place Experimental Varibles Here!
        ###############################*/
    const numConditions = process.env.NUM_EXP_CONDITIONS;
    const experimentalConditionNames =
      process.env.EXP_CONDITIONS_NAMES.split(",");
    const experimentalCondition =
      experimentalConditionNames[Math.floor(Math.random() * numConditions)];

    const surveyLink = process.env.POST_SURVEY
      ? process.env.POST_SURVEY +
        (process.env.POST_SURVEY_WITH_QUALTRICS == "TRUE" &&
        process.env.POST_SURVEY.includes("?r_id=") &&
        req.query.r_id != "null" &&
        req.query.r_id &&
        req.query.r_id != "undefined"
          ? req.query.r_id
          : "")
      : "";

    const currDate = Date.now();
    // Derive level order and objectives for initialization
    const levelDocs = await LevelOrder.find().sort({ level: 1 }).lean();
    const levelNumbers =
      levelDocs.length > 0 ? levelDocs.map((l) => l.level) : [1];
    const initialLevel = levelNumbers[0] || 1;

    const initialScores = levelNumbers.map((level) => ({
      level,
      score: 0,
      updated: currDate,
    }));

    const objectives = await Objective.find({
      level: { $in: levelNumbers },
    })
      .select("_id level")
      .lean();

    const initialObjectiveProgress = objectives.map((obj) => ({
      objective: obj._id,
      level: obj.level,
      completed: false,
      completedAt: null,
    }));

    const user = new User({
      actorType: "User",
      email: req.body.email,
      password: req.body.password,
      mturkID: req.body.mturkID,
      session: session.id,
      username: req.body.username,
      experimentalCondition: experimentalCondition,
      endSurveyLink: surveyLink,
      active: true,
      createdAt: currDate,
      levelState: {
        level: initialLevel,
        levelStartedAt: currDate,
      },
      scores: initialScores,
      objectiveProgress: initialObjectiveProgress,
    });
    if (req.query.r_id) {
      user.ResponseID = req.query.r_id;
    }
    await user.save();
    await cloneBaseContentForUser(user);
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      const userAgent = req.headers["user-agent"];
      const user_ip =
        req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      user.logUser(currDate, userAgent, user_ip);
      res.redirect("/account/signup_info");
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /account/profile
 * Update user's profile information during the sign up process.
 */
exports.postSignupInfo = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).exec();
    user.profile.name = req.body.name.trim() || "";
    user.profile.location = req.body.location.trim() || "";
    user.profile.bio = req.body.bio.trim() || "";
    if (req.file) {
      user.profile.picture = req.file.filename;
    }

    await user.save();
    req.flash("success", { msg: "Profile information has been updated." });
    return res.redirect("/com");
  } catch (err) {
    next(err);
  }
};

/**
 * POST /account/consent
 * Update user's consent.
 */
exports.postConsent = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).exec();
    user.consent = true;
    await user.save();
    res.set("Content-Type", "application/json; charset=UTF-8");
    res.send({ result: "success" });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /account
 * Render user's Update My Profile page.
 */
exports.getAccount = (req, res, next) => {
  try {
    res.render("account/profile", {
      title: "Account Management",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /account/profile
 * Update user's profile information.
 */
exports.postUpdateProfile = async (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: "Please enter a valid email address." });
  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/account");
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false,
  });
  try {
    const user = await User.findById(req.user.id).exec();
    user.email = req.body.email || "";
    user.profile.name = req.body.name.trim() || "";
    user.profile.location = req.body.location.trim() || "";
    user.profile.bio = req.body.bio.trim() || "";
    if (req.file) {
      user.profile.picture = req.file.filename;
    }

    await user.save();
    req.flash("success", { msg: "Profile information has been updated." });
    res.redirect("/account");
  } catch (err) {
    if (err.code === 11000) {
      req.flash("errors", {
        msg: "The email address you have entered is already associated with an account.",
      });
      return res.redirect("/account");
    }
    next(err);
  }
};

/**
 * POST /account/password
 * Update user's current password.
 */
exports.postUpdatePassword = async (req, res, next) => {
  const validationErrors = [];
  if (!validator.isLength(req.body.password, { min: 4 }))
    validationErrors.push({
      msg: "Password must be at least 4 characters long.",
    });
  if (
    validator.escape(req.body.password) !==
    validator.escape(req.body.confirmPassword)
  )
    validationErrors.push({ msg: "Passwords do not match." });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/account");
  }
  try {
    const user = await User.findById(req.user.id).exec();
    user.password = req.body.password;
    await user.save();
    req.flash("success", { msg: "Password has been changed." });
    res.redirect("/account");
  } catch (err) {
    next(err);
  }
};

/**
 * POST /pageLog
 * Record user's page visit to pageLog.
 */
exports.postPageLog = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).exec();
    user.logPage(Date.now(), req.body.path);
    res.set("Content-Type", "application/json; charset=UTF-8");
    res.send({ result: "success" });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /pageTimes
 * Record user's time on site to pageTimes.
 */
exports.postPageTime = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).exec();
    // What day in the study is the user in?
    const one_day = 86400000; // number of milliseconds in a day
    const time_diff = Date.now() - user.createdAt; // Time difference between now and account creation.
    const current_day = Math.floor(time_diff / one_day);
    helpers.ensureDays(user.pageTimes, current_day);
    user.pageTimes[current_day] += parseInt(req.body.time);
    await user.save();
    res.set("Content-Type", "application/json; charset=UTF-8");
    res.send({ result: "success" });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /forgot
 * Render Forgot Password page.
 */
exports.getForgot = (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  try {
    res.render("account/forgot", {
      title: "Forgot Password",
      email: process.env.RESEARCHER_EMAIL,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Deactivate accounts who are completed with the study, except for admin accounts. Called 3 times a day. Scheduled via CRON jobs in app.js
 */
exports.stillActive = async () => {
  try {
    const activeUsers = await User.find().where("active").equals(true).exec();
    for (const user of activeUsers) {
      const study_length = 86400000 * process.env.NUM_DAYS; // Milliseconds in NUM_DAYS days
      const time_diff = Date.now() - user.createdAt; // Time difference between now and account creation.
      if (time_diff >= study_length && !user.isAdmin) {
        user.active = false;
        user.logPostStats();
        await user.save();
      }
    }
  } catch (err) {
    console.error(err);
  }
};

/**
 * GET /completed
 * Render Admin Dashboard: Basic information on users currrently in the study
 */
exports.userTestResults = async (req, res, next) => {
  if (!req.user.isAdmin) {
    res.redirect("/");
  } else {
    try {
      const users = await User.find().where("isAdmin").equals(false).exec();
      for (const user of users) {
        const study_length = 86400000 * process.env.NUM_DAYS; // Milliseconds in NUM_DAYS days
        const time_diff = Date.now() - user.createdAt; // Time difference between now and account creation.
        if (time_diff >= study_length && !user.isAdmin) {
          user.active = false;
          user.logPostStats();
          await user.save();
        }
      }
      res.render("completed", { users: users });
    } catch (err) {
      next(err);
    }
  }
};

exports.joinRooms = async (socket) => {
  const req = socket.request;

  // Use the socket session id as a Socket.io room that links Express with Socket.io
  socket.join(req.session.id);

  const passport = req.session.passport;
  if (passport) {
    const user = await User.findById(passport.user).exec();
    if (!user) {
      console.warn("joinRooms called with null user");
      return; // avoid crashing the server
    }
    if (user.session) {
      // Join a socket.io room for the session the user is in
      socket.join(user.session._id.toString());
    }
  }
};
