const { Actor } = require("../models/Actor.js");
const Agent = require("../models/Agent.js");
const User = require("../models/User.js");
const Script = require("../models/Script.js");
const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

require("dotenv").config();

/**
 * This is a helper function, called in .getScript() (./script.js controller file), .getActor() (./actors.js controller file).
 * It takes in a User document, and other parameters, and it processes and generates a final feed of posts for the user based on these parameters.
 * Parameters:
 *  - user: a User document
 *  - order: 'SHUFFLE', 'CHRONOLOGICAL', 'NEWEST'; indicates the order the posts in the final feed should be displayed in.
 *  - removedFlaggedContent (boolean): T/F; indicates if a flagged post should be removed from the final feed.
 *  - removeBlockedUserContent (boolean): T/F; indicates if posts from a blocked user should be removed from the final feed.
 *  - actor (Actor/Agent/User): if provided restrict the posts to those from the passed in actor.
 * Returns:
 *  - the processed final feed of posts for the user
 */
exports.getFeed = async function (
  user,
  order,
  removeFlaggedContent,
  removeBlockedUserContent,
  actor,
  level = 1,
) {
  const commonQuery = {
    $or: [{ session: null }, { session: user.session }],
    class: { $in: ["", user.experimentalCondition] },
    // absTime: { $lte: Date.now() },
  };
  const makeBlockedQuery = (field) => {
    return removeBlockedUserContent
      ? { [field]: { $nin: user.blocked.map(({ actorId }) => actorId) } }
      : {};
  };
  const flaggedPosts = removeFlaggedContent
    ? user.postAction
        .filter((action) => action.flagged)
        .map((action) => action.post)
    : [];
  const flaggedComments = removeFlaggedContent
    ? user.commentAction
        .filter((action) => action.flagged)
        .map((action) => action.comment)
    : [];

  // Array of actor and other user's posts that match the user's experimental condition, within the past 24 hours, sorted by time.
  const posts = await Script.find({
    level: level,
    _id: { $nin: flaggedPosts },
    ownerUser: user._id,
    ...(actor ? { poster: actor.id } : {}),
    ...makeBlockedQuery("poster"),
    ...commonQuery,
  })
    .populate("poster")
    .populate({
      path: "comments",
      populate: { path: "commentor" },
      match: {
        _id: { $nin: flaggedComments },
        ownerUser: user._id,
        ...makeBlockedQuery("commentor"),
        ...commonQuery,
      },
    })
    .sort("absTime")
    .exec();

  // Array of posts for the final feed
  const feed = [];

  // While there are posts to add to the feed
  while (posts.length) {
    const post = posts.pop();
    // Check if user has any interactions with comments
    for (const comment of post.comments) {
      // update comment likes with likes from actors
      comment.likes += comment.actorLikes;

      // Add user interactions with the comment
      const action = _.find(user.commentAction, { comment: comment._id });
      comment.liked = action?.liked;
      comment.flagged = action?.flagged;
    }

    // Sort the comments in the post from least to most recent.
    post.comments.sort(function (a, b) {
      return a.absTime - b.absTime;
    });

    // update post likes with likes from actors
    post.likes += post.actorLikes;

    // Add user interactions with the post
    const action = _.find(user.postAction, { post: post._id });
    post.liked = action?.liked;
    post.flagged = action?.flagged;
    post.read = !!action?.readTime[0];
    feed.push(post);
  }

  if (order === "SHUFFLE") {
    // Shuffle the feed, but keep unread posts first
    return _.sortBy(_.shuffle(feed), "read");
  }

  if (order === "NEWEST") {
    // Keep new posts and posts with recent updates (new comments, likes, shares) first
    return _.orderBy(feed, "updateTime", "desc");
  }

  return feed;
};

exports.ensureDays = function (day_array, current_day) {
  if (day_array.length <= current_day) {
    day_array.push(...Array(current_day - day_array.length + 1).fill(0));
  }
};

exports.lookupActorByName = async function (username) {
  // Sequentially find the actor as an Actor, Agent, or User, setting type accordingly
  const actor = await Actor.findOne({ username: username }).exec();
  if (actor) {
    return actor;
  }

  const agent = await Agent.findOne({ username: username }).exec();
  if (agent) {
    return agent;
  }

  const user = await User.findOne({ username: username }).exec();
  if (user) {
    return user;
  }

  throw new Error("Actor not found");
};


/**
 * Filter the full feed object down to only the posts, comments, and likes
 * related to a single actor.
 */
function getActorRelevantFeed(feed, actorId) {
  const relevantPosts = (feed.posts || []).filter(
    (post) => post.poster === actorId,
  );

  const relevantComments = (feed.comments || []).filter(
    (comment) => comment.commentor === actorId,
  );

  const relevantLikes = (feed.posts || []).flatMap((post) =>
    (post.liked || [])
      .filter((like) => like.username === actorId)
      .map((like) => ({
        postId: post.id,
        timestamp: like.timestamp,
      })),
  );

  return {
    posts: relevantPosts,
    comments: relevantComments,
    likes: relevantLikes,
  };
}

exports.getActorRelevantFeed = getActorRelevantFeed;
