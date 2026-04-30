const Script = require("../models/Script.js");
const Comment = require("../models/Comment.js");
const Agent = require("../models/Agent");
const Session = require("../models/Session");
const User = require("../models/User");
const helpers = require("./helpers");
const _ = require("lodash");
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

/**
 * GET /
 * Fetch and render newsfeed.
 */
exports.getScript = async (req, res, next) => {
  try {
    const one_day = 86400000; // Number of milliseconds in a day.
    const time_now = Date.now(); // Current date.
    const time_diff = time_now - req.user.createdAt; // Time difference between now and user account creation, in milliseconds.

    const user = await User.findById(req.user.id).exec();

    // If the user is no longer active, sign the user out.
    if (!user.active) {
      req.logout((err) => {
        if (err) console.log("Error : Failed to logout.", err);
        req.session.destroy((err) => {
          if (err)
            console.log(
              "Error : Failed to destroy the session during logout.",
              err,
            );
          req.user = null;
          req.flash("errors", {
            msg: "Account is no longer active. Study is over.",
          });
          res.redirect(
            "/login" + (req.query.r_id ? `?r_id=${req.query.r_id}` : ""),
          );
        });
      });
    }

    // What day in the study is the user in?
    // Update study_days, which tracks the number of time user views feed.
    const current_day = Math.floor(time_diff / one_day);
    if (current_day < process.env.NUM_DAYS) {
      helpers.ensureDays(user.study_days, current_day);
      user.study_days[current_day] += 1;
      user.save();
    }
    const level = parseInt(req.query.level) || 1;
    // Get the newsfeed and render it.
    const finalfeed = await helpers.getFeed(
      user,
      process.env.FEED_ORDER,
      process.env.REMOVE_FLAGGED_CONTENT === "TRUE",
      true,
      null, // actor is null
      level,
    );
    res.render("script", { script: finalfeed, showNewPostIcon: true });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

/**
 * Helper for making Agent/User posts
 */
const makePost = async (user, time, body, session, file) => {
  const isAgent = user.isAdmin === undefined;

  let post = {
    postType: isAgent ? "Agent" : "User",
    poster: user.id,
    session: session._id,
    body: body,
    picture: file ? file.filename : "",
    actorLikes: 0, // This value will never change.
    absTime: time,
    updateTime: time,
    likes: 0,
  };

  //Add new post to Script
  const new_post = new Script(post);
  await new_post.save();
};

const performFeedAction = async (userId, isAgent, body, session) => {
  const user = await (
    isAgent ? Agent.findById(userId) : User.findById(userId).populate("session")
  )
    .populate("postAction")
    .populate("commentAction")
    .exec();

  // Retrieve post from database
  const post = await Script.findById(body.postID).populate("comments").exec();

  // Check if user has interacted with the post before.
  let postIndex = _.findIndex(user.postAction, function (o) {
    return o.post.equals(body.postID);
  });

  // If the user has not interacted with the post before, add the post to user.feedAction.
  if (postIndex == -1) {
    postIndex = user.postAction.push({ post: post._id }) - 1;
  }

  // User created a new comment on the post.
  if (body.new_comment) {
    // Add new comment to comment database
    const comment = new Comment({
      commentType: isAgent ? "Agent" : "User",
      commentor: userId,
      session: isAgent ? session.id : user.session.id,
      post: body.postID,
      level: body.currentLevel,
      body: body.comment_text,
      absTime: body.new_comment,
      updateTime: body.new_comment,
      comments: [],
      TrumanWorld: !!body.TrumanWorld,
      logs: body.logs || [], // Add the logs array from the request
    });
    await comment.save();

    // Add reference to comment to post it was made on
    post.updateTime = body.new_comment;
    post.comments.push(comment._id);
    await post.save();

    return { post, comment };
  }

  let target = post;
  let action = user.postAction[postIndex];
  if (body.commentID) {
    // Find comment
    const comment = await Comment.findById(body.commentID).exec();

    // Check if user has interacted with the comment before.
    let commentIndex = _.findIndex(user.commentAction, function (o) {
      return o.comment.equals(body.commentID);
    });

    // If the user has not interacted with the comment before, add the comment to user.commentActions
    if (commentIndex == -1) {
      user.commentAction.push({ comment: body.commentID });
      commentIndex = user.commentAction.length - 1;
    }

    target = comment;
    action = user.commentAction[commentIndex];
  }

  // User flagged the post or comment.
  const lastUpdateTime = target.updateTime;
  if (body.flag) {
    action.flagTime.push(body.flag);
    target.updateTime = body.flag;
    action.flagged = true;
  }
  // User unflagged the post or comment.
  else if (body.unflag) {
    action.unflagTime.push(body.unflag);
    target.updateTime = body.unflag;
    action.flagged = false;
  }

  // User liked the post or comment.
  if (body.like) {
    action.likeTime.push(body.like);
    target.updateTime = body.like;
    action.liked = true;
    target.likes++;
  }
  // User unliked the post or comment.
  else if (body.unlike) {
    action.unlikeTime.push(body.unlike);
    target.updateTime = body.unlike;
    action.liked = false;
    target.likes--;
  }

  // User shared the post or comment.
  if (body.share) {
    action.shareTime.push(body.share);
    target.updateTime = body.share;
    action.shared = true;
  }

  // User read the post or comment.
  if (body.viewed) {
    action.readTime.push({ time: body.viewed, duration: body.duration });
  }
  await target.save();
  await user.save();

  if (post === target) {
    return { post };
  }

  if (lastUpdateTime !== target.updateTime) {
    // If we updated the commen time, then update the post as well
    post.updateTime = target.updateTime;
    await post.save();
  }

  return { post, comment: target };
};

/**
 * POST /action
 * Processes model output and adds it to the feed.
 */
exports.postAction = async (req, res, next) => {
  try {
    const { action, author, actionObject, actionBody, timestamp, sessionName } =
      req.body;

    // Find the user corresponding to the author
    const user = await Agent.findOne({ username: author }).exec();
    const session = await Session.findOne({ name: sessionName }).exec();

    // Parse the time of the action
    const time = Date.parse(timestamp);

    // Map the action to the appropriate field
    if (action === "post") {
      await makePost(user, time, actionBody, session);
    } else {
      const body = {};
      const post = await Script.findById(actionObject).exec();
      if (!post) {
        // if post not found, then create a comment request
        const comment = await Comment.findById(actionObject).exec();
        body.postID = comment.post;
        body.commentID = actionObject;
      } else {
        body.postID = actionObject;
      }

      // Timestamp is sent in ISO 8601 format, so parse to get milliseconds
      if (action === "comment") {
        body.new_comment = time;
        body.comment_text = actionBody;
        body.currentLevel = 1;
      } else if (action === "like") {
        body.like = time;
      } else if (action === "flag") {
        body.flag = time;
      } else if (action === "share") {
        body.share = time;
      }
      await performFeedAction(user._id, true, body, session);
    }
    req.io.to(session._id.toString()).emit("timeline activity", time);
    res.send({ result: "success" });
  } catch (err) {
    next(err);
  }
};

/*
 * Post /post/new
 * Record a new user-made post. Include any actor replies (comments) that go along with it.
 */
exports.newPost = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).exec();
    await makePost(user, Date.now(), req.body.body, user.session, req.file);
    req.io
      .to(user.session._id.toString())
      .except(req.session.id)
      .emit("timeline activity");
    res.redirect("/");
  } catch (err) {
    console.log(err);
    next(err);
  }
};

/**
 * POST /feed/
 * Record user's actions on ACTOR/other USER's posts.
 */
exports.postUpdateFeedAction = async (req, res, next) => {
  try {
    const lastUpdateTime = (await Script.findById(req.body.postID).exec())
      .updateTime;
    const { post, comment } = await performFeedAction(
      req.user.id,
      false,
      req.body,
    );

    if (post.updateTime > lastUpdateTime) {
      // Notify client if the post was updated
      const user = await User.findById(req.user.id).exec();
      req.io
        .to(user.session._id.toString())
        .except(req.session.id)
        .emit("timeline activity");
    }
    res.send({ result: "success", postID: post._id, commentID: comment?._id });
  } catch (err) {
    next(err);
  }
};

module.exports.performFeedAction = performFeedAction;
