const Chat = require("../models/Chat.js");
const helpers = require("./helpers.js");
const { getActorRelevantFeed } = require("./helpers.js");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const Session = require("../models/Session");
const { getCurrentLevel } = require("../controllers/multi_user");

/**
 * GET /chat
 * Returns the list of messages of chat with chat_id value and the receiver's attributes
 */
exports.getChat = async (req, res, next) => {
  try {
    if (req.query.chatId === "chatbot") {
      //if chatbot, returns empty history chat
      return res.send({
        messages: [],
        actorType: "ChatBot",
        username: "chatbot",
        picture: "public/chatbot.png",
        name: "ChatBot",
      });
    } else {
      // Retrieve the chat by ID, populating messenger field in messages
      const chat = await Chat.findOne({ chat_id: req.query.chatFullId })
        .populate("messages.messenger")
        .exec();

      const actor = await helpers.lookupActorByName(req.query.chatId);

      // If actor or chat is not found, return an empty message array with the actor
      if (!actor) return next(new Error("Actor not found"));

      // Find profile photo of actor
      let picture;
      if (actor.actorType == "User" || actor.actorType == "Agent") {
        if (actor.profile.picture)
          picture = "/user_avatar/" + actor.profile.picture;
        else picture = actor.gravatar(60);
      } else {
        picture = "/profile_pictures/" + actor.profile.picture;
      }
      if (!chat) {
        return res.send({
          messages: [],
          actorType: actor.actorType,
          username: actor.username,
          picture: picture,
          name: actor.profile.name,
          isLLMDriven: actor.isLLMDriven,
        });
      }

      // Map messages to plain JavaScript objects
      const messages = chat.messages.length
        ? chat.messages.map((msg) => msg.toObject())
        : [];

      res.send({
        messages: messages,
        actorType: actor.actorType,
        username: actor.username,
        picture: picture,
        name: actor.profile.name,
        isLLMDriven: actor.isLLMDriven,
      });
    }
  } catch (err) {
    console.error(err);
    next(err);
  }
};

/**
 * POST /chat
 * Add actions with chats.
 */
exports.postChatAction = async (req, res, next) => {
  try {
    const sender = await helpers.lookupActorByName(req.body.username);

    //loads feed
    const sessionDoc = await Session.findById(sender.session).exec();
    const sessionName = sessionDoc.name;
    const { feed, state } = { feed: [], state: {} };
    const feedContext = JSON.stringify(feed, null, 2);

    if (req.body.chatFullId.startsWith("chatbot")) {
      //find existing chatbot
      const lvl = Number(await getCurrentLevel(sender)) || 1;
      let chat = await Chat.findOne({ chat_id: req.body.chatFullId }).exec();
      if (!chat)
        chat = new Chat({
          chat_id: req.body.chatFullId,
          level: lvl,
          messages: [],
        });
      //add this chat id to the sender's chatAction array
      sender.chatAction.push(chat.id);
      //add the message of this chat created with the specific chat_id
      chat.messages.push({
        messageType: sender.actorType,
        messenger: sender._id,
        body: req.body.body,
        absTime: req.body.absTime,
      });
      //save the changes to mongoDB
      await chat.save();
      await sender.save();

      // Generate chatbot response
      const userMsg = req.body.body;
      const messages = [
        {
          role: "system",
          content:
            "You are a helpful chatbot assistant to a social media simulation. Here is the current feed context:\n" +
            feedContext,
        },
        { role: "user", content: userMsg },
      ];

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_API_MODEL || "gpt-4o-mini",
        messages,
        max_tokens: 300,
        temperature: 0.7,
      });
      const reply = completion.choices[0].message.content.trim();

      // Save chatbot reply
      const recipient = sender; // for chatbot, recipient is placeholdered as sender
      recipient.chatAction.push(chat.id);
      chat.messages.push({
        messageType: "ChatBot",
        messenger: recipient._id,
        body: reply,
        absTime: new Date(),
      });
      await chat.save();
      await recipient.save();

      return res.send({ result: "success", reply });
    }
    // regular user-agent chat
    const lvl = Number(await getCurrentLevel(sender)) || 1;
    let chat = await Chat.findOne({ chat_id: req.body.chatFullId }).exec();
    if (!chat)
      chat = new Chat({
        chat_id: req.body.chatFullId,
        level: lvl,
        messages: [],
      });

    // Push & save the USER message
    const senderAction = req.body.body;
    sender.chatAction.push(chat.id);
    chat.messages.push({
      messageType: sender.actorType,
      messenger: sender._id,
      body: senderAction,
      absTime: req.body.absTime,
    });
    await chat.save();
    await sender.save();

    // Determine recipient
    const [a, b] = req.body.chatFullId.split("-");
    const otherUsername = a === req.body.username ? b : a;
    const recipient = await helpers.lookupActorByName(otherUsername);

    // If recipient is LLM-driven, generate response
    if (recipient.isLLMDriven) {
      // console.log("speaking with LLM agent");
      const relevantFeed = getActorRelevantFeed(feed, recipient.username);
      const actorContext = JSON.stringify(relevantFeed, null, 2);

      const behavior = recipient.behaviorPrompt || "";
      const systemPrompt = `You are now role-playing as ${otherUsername}:\n${behavior} in a social media simulation like Instagram. You should talk like the character, not like an AI. The conversations are generally short, reflecting that of a teenager in social media feed. \n\nHere is your activity history in the simulation so far:\n${actorContext}`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_API_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: req.body.body },
        ],
        max_tokens: 300,
        temperature: 0.5,
      });
      const reply = completion.choices[0].message.content.trim();

      // Save recipient reply
      recipient.chatAction.push(chat.id);
      chat.messages.push({
        messageType: recipient.actorType,
        messenger: recipient._id,
        body: reply,
        absTime: new Date(),
      });
      await chat.save();
      await recipient.save();
      return res.send({ result: "success", reply });
    }

    // Not LLM-driven -> just return success
    return res.send({ result: "success", reply: "look somewhere else" });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
