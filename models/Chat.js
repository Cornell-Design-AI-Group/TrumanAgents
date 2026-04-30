const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });
const chatMessageSchema = new Schema(
  {
    messageType: {
      type: String,
      required: true,
      enum: ["Actor", "Agent", "User", "ChatBot"],
    }, //Indicates whether an actor or user made a comment
    // Allow messenger to be optional for chatbot messages.
    messenger: {
      type: Schema.ObjectId,
      refPath: "messages.messageType",
      required: false,
    },
    // optional: Indicates which actor/user made the comment
    body: { type: String, default: "", trim: true }, // Body of the chat message
    absTime: Date, // The absolute date (time) of when the chat message was made,
  },
  { _id: true, versionKey: false },
);
const chatSchema = new mongoose.Schema(
  {
    // chat id’s is defined by who the 2 actors are of the chat: with format [USERNAME_A]-[USERNAME_B] where USERNAME_A and USERNAME_B are alphabetically sorted
    chat_id: { type: String, required: true },
    // Optional.
    isBot: { type: Boolean, default: false },
    messages: [chatMessageSchema],
    level: { type: Number, required: true, index: true },
  },
  { timestamps: true, versionKey: false },
);
const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;
