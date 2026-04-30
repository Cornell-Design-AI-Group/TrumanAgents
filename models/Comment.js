const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

const logSchema = new mongoose.Schema(
  {
    eventName: String,
    eventTimestamp: Number,
    textDelta: {
      ops: [
        {
          insert: String,
          delete: String,
        },
      ],
    },
    currentCursor: Number,
  },
  { _id: true },
);

const commentSchema = new mongoose.Schema(
  {
    session: { type: Schema.ObjectId, ref: "Session" }, // session the post was made in
    post: { type: Schema.ObjectId, ref: "Script" }, // Indicates the post that the comment was made on
    commentType: {
      type: String,
      required: true,
      enum: ["Actor", "Agent", "User"],
    }, //Indicates whether an actor or user made a comment
    commentor: { type: Schema.ObjectId, refPath: "commentType" }, // Indicates which actor/user made the comment
    ownerUser: {
      type: Schema.ObjectId,
      ref: "User",
      index: true,
      default: null,
    }, // per-user copy owner (null for base content)
    username: { type: String, index: true }, // denormalized commenter username for quick lookups
    body: { type: String, default: "", trim: true }, // Text(body) of comment
    class: {
      type: String,
      default: "",
      trim: true,
    }, // For experimental use (If blank/null, this comment is shown to all users. If defined, this comment is only shown to users with the same value for their experimental condition)
    actorLikes: { type: Number, default: 0 }, // Indicates the # of likes on the comment by actors
    likes: { type: Number, default: 0 }, // Indicates the total # of likes on the comment
    absTime: Date, // Absolute Time; Indicates the exact time the comment was made on the post
    updateTime: Date, // Update Time; Indicates the exact time the comment was last updated
    logs: [logSchema],
    level: { type: Number, required: true, index: true }, 
    TrumanWorld: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, versionKey: false },
);

const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;
