const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const scriptSchema = new mongoose.Schema(
  {
    session: { type: Schema.ObjectId, ref: "Session" }, // session the post was made in
    postType: {
      type: String,
      required: true,
      enum: ["Actor", "Agent", "User"],
    }, //Indicates whether an actor, agent, or user made a post
    poster: { type: Schema.ObjectId, refPath: "postType" }, // Indicates which actor/user made the post
    ownerUser: {
      type: Schema.ObjectId,
      ref: "User",
      index: true,
      default: null,
    }, // per-user copy owner (null for base content)
    body: { type: String, default: "", trim: true }, // Text(body) of post
    class: {
      type: String,
      default: "",
      trim: true,
    }, // For experimental use (If blank/null, this post is shown to all users. If defined, this post is only shown to users with the same value for their experimental condition)
    actorLikes: { type: Number, default: 0 }, // Indicates the # of likes on the comment by actors
    likes: { type: Number, default: 0 }, // Indicates the total # of likes on the post
    absTime: Date, // Absolute Time; Indicates the exact time the post was made
    updateTime: Date, // Update Time; Indicates the exact time the comment was last updated
    picture: String, // Picture (file path) for post
    comments: [{ type: Schema.ObjectId, ref: "Comment" }], // Comments on post
    level: { type: Number, required: true, index: true }, // ensures level is 1-5
    username: { type: String, index: true }, // denormalized poster username for quick lookups
    isRelevant: {
      type: Boolean,
      default: false,
    },
  },
  { versionKey: false },
);

const Script = mongoose.model("Script", scriptSchema);
module.exports = Script;
