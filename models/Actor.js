const validator = require("validator");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const actorTypes = { type: String, enum: ["Actor", "Agent", "User"] };

const actorSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true },

    profile: {
      name: { type: String, default: "" },
      location: { type: String, default: "" },
      bio: { type: String, default: "" },
      picture: { type: String, default: "" },
    },

    actorType: { ...actorTypes, required: true },
    active: { type: Boolean, default: true }, // Indicates if the user is still active

    posts: [{ type: Schema.ObjectId, ref: "Script" }],
    comments: [{ type: Schema.ObjectId, ref: "Comment" }],

    createdAt: Date, // Absolute Time the user was created

    blocked: [
      {
        // List of actors the user has blocked
        actorType: { ...actorTypes, required: true },
        actorId: { type: Schema.ObjectId, refPath: "blocked.actorType" },
      },
    ],
    reported: [
      {
        // List of actors the user has reported
        actorType: { ...actorTypes, required: true },
        actorId: { type: Schema.ObjectId, refPath: "reported.actorType" },
      },
    ],
    followed: [
      {
        // List of actors the user has followed
        actorType: { ...actorTypes, required: true },
        actorId: { type: Schema.ObjectId, refPath: "followed.actorType" },
      },
    ],
    blockReportAndFollowLog: [
      new Schema({
        time: Date, // Absolute Time of action
        action: String, // Action taken. Values include: 'block', 'unblock', 'follow', 'unfollow', 'report'
        report_issue: String, // If action taken is 'report', indicates the reason given. Values include: 'interested', 'spam', 'bully', 'hacked'
        username: String, // Username action relates to
      }),
    ],

    postAction: [
      {
        post: { type: Schema.ObjectId, ref: "Script" },
        liked: { type: Boolean, default: false }, // Whether the user liked the post
        flagged: { type: Boolean, default: false }, // Whether the user flagged the post
        shared: { type: Boolean, default: false },
        likeTime: [Date], // List of absolute times when the user has liked the post
        unlikeTime: [Date], // List of absolute times when the user has unliked the post
        flagTime: [Date], // List of absolute times when the user has flagged the post
        unflagTime: [Date], // List of absolute times when the user has unflagged the post
        shareTime: [Date], // List of absolute times when the user has shared the post
        readTime: [
          new Schema({
            time: Date, // Absolute Time when the post was viewed
            duration: Number, // Duration the user spent looking at the post in milliseconds (we do not record times less than 1.5 seconds)
          }),
        ],
      },
    ],

    commentAction: [
      {
        comment: { type: Schema.ObjectId, ref: "Comment" },
        liked: { type: Boolean, default: false }, // Whether the user liked the comment
        flagged: { type: Boolean, default: false }, // Whether the user flagged the comment
        shared: { type: Boolean, default: false },
        likeTime: [Date], // List of absolute times when the user has liked the comment
        unlikeTime: [Date], // List of absolute times when the user has unliked the comment
        flagTime: [Date], // List of absolute times when the user has flagged the comment
        unflagTime: [Date], // List of absolute times when the user has unflagged the comment
        shareTime: [Date], // List of absolute times when the user has shared the comment
        readTime: [
          new Schema({
            time: Date, // Absolute Time when the comment was viewed
            duration: Number, // Duration the user spent looking at the comment in milliseconds (we do not record times less than 1.5 seconds)
          }),
        ],
      },
    ],

    chatAction: [{ type: Schema.ObjectId, ref: "Chat" }],
  },
  { timestamps: true, versionKey: false },
);

function validateUsername(username) {
  return validator.isAlphanumeric(username, "en-US", { ignore: "-_." });
}

const Actor = mongoose.model("Actor", actorSchema);
module.exports = {
  actorSchema,
  Actor,
  validateUsername,
};
