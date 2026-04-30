require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const ScoreController = require("./ScoreController");
const { performFeedAction } = require("./script");
const Agent = require("../models/Agent");
const Session = require("../models/Session");
const Script = require("../models/Script");
const Objective = require("../models/Objective");
const LevelOrder = require("../models/LevelOrder");
const Solution = require("../models/Solution");
const { type } = require("os");
const { getUserLevel } = require("./multi_user");

const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * backup of a post's original body per level-> used when the system modified the post material
 */
const PostBackup =
  mongoose.models.PostBackup ||
  mongoose.model(
    "PostBackup",
    new Schema(
      {
        postId: {
          type: Schema.Types.ObjectId,
          required: true,
          unique: true,
          index: true,
        },
        level: { type: Number, required: true, index: true },
        originalBody: { type: String, required: true },
      },
      { timestamps: true },
    ),
  );

/**
 * post new comment
 */
async function pushComment({
  postId,
  text,
  author,
  sessionName,
  level,
  ownerUser,
}) {
  const session = await Session.findOne({ name: sessionName }).exec();
  const body = {
    action: "comment",
    postID: postId,
    new_comment: new Date().toISOString(),
    comment_text: text,
    sessionName,
    currentLevel: level,
    TrumanWorld: true,
    ownerUser: ownerUser ? ownerUser.toString() : undefined,
  };
  const { comment } = await performFeedAction(author, true, body, session);

  if (!comment?._id) {
    throw new Error(`pushComment failed for level ${level}`);
  }

  return comment._id.toString();
}

/**
 * - Overwrite the `body` field on the post 
 * - Backs up the original in PostBackup (upsert)
 */
async function modifyPost({ postId, newBody }) {
  const current = await Script.findById(postId).lean();
  if (!current) throw new Error(`modifyPost: post ${postId} not found`);

  // Store original body once per post (idempotent upsert)
  await PostBackup.updateOne(
    { postId: current._id },
    {
      $setOnInsert: {
        postId: current._id,
        level: Number(current.level),
        originalBody: current.body ?? "",
      },
    },
    { upsert: true },
  );

  // overwrite
  const updated = await Script.findByIdAndUpdate(
    postId,
    {
      $set: {
        body: newBody,
        updateTime: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new Error(`modifyPost: post ${postId} not found`);
  }

  console.log(`[Grader] modifyPost OK – new body is:\n${updated.body}`);
  return updated._id.toString();
}

/**
 * The Grader coordinates:
 *  - Loading level metadata (LevelOrder) and candidate solutions
 *  - Preprocessing user-facing actions (DMs, public comments)
 *  - Classifying actions vs. solution categories with an LLM
 *  - Applying score deltas
 *  - Triggering scripted next steps (comments / post modifications)
 *  - Finalizing solution and objective completion (including composites)
 *  - Resetting level state when requested
 */
class Grader {
  constructor({ level, scoreController, user } = {}) {
    this.level = Number(level);
    this.scoreController = scoreController;
    this.user = user || null; // optionally provided per grading tick
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    this.levelEntry = null;   // LevelOrder doc
    this.solutions = [];      // Incomplete solutions for this level
  }

  /**
   * Load level configuration and all not-done solutions for this level.
   * Throws if LevelOrder missing.
   */
  async init() {
    this.levelEntry = await LevelOrder.findOne({ level: this.level }).lean();
    if (!this.levelEntry)
      throw new Error(`No LevelOrder for level ${this.level}`);

    // Only consider solutions not yet marked "done"
    this.solutions = await Solution.find({
      level: this.level,
      $or: [{ done: false }, { done: { $exists: false } }],
    })
      .sort({ category: 1 })
      .lean();
  }

  /**
   * Extract @mentions (e.g., @alice_b) from a text body.
   */
  _extractMentions(text = "") {
    return [...text.matchAll(/@([A-Za-z0-9_.]+)/g)].map((m) => m[1]);
  }

  /**
   * Check if a chatId represents a 1:1 DM format ("userA-userB").
   */
  _isOneToOne(chatId = "") {
    return chatId.split("-").length === 2;
  }

  /**
   * Normalize a chat message into an action envelope.
   * - type: "direct_chat" or "chat"
   * - target: the other party in a DM
   * - mentioned: list of @handles
   */
  _makeActionFromChat(chatDoc, msg) {
    const chatId = chatDoc.chat_id || "";
    const direct = this._isOneToOne(chatId);
    return {
      id: msg._id,
      text: msg.body || "",
      type: direct ? "direct_chat" : "chat",
      chatId,
      postId: null,
      target: direct
        ? chatId.split("-").find((name) => name !== msg.senderUsername)
        : null,
      mentioned: this._extractMentions(msg.body),
    };
  }

  /**
   * Normalize a public comment doc into an action envelope.
   */
  _makeActionFromComment(doc) {
    return {
      id: doc._id,
      text: doc.body || "",
      type: "public_comment",
      chatId: null,
      postId: doc.post || null,
      target: null,
      mentioned: this._extractMentions(doc.body),
    };
  }

  /**
   * Convert raw update payloads (mixed chats/comments) to a flat list of actions.
   * - Only user-authored items are considered (messageType/commentType === "User").
   */
  preprocessActions(updates) {
    const actions = [];
    for (const u of updates) {
      if (u.coll === "chats" && u.doc?.messages) {
        for (const msg of u.doc.messages) {
          if (msg.messageType === "User") {
            actions.push(this._makeActionFromChat(u.doc, msg));
          }
        }
      }
      if (u.coll === "comments" && u.doc?.commentType === "User") {
        actions.push(this._makeActionFromComment(u.doc));
      }
    }
    return actions;
  }

  /**
   * LLM-based semantic matching of the current tick's actions to ONE best solution.
   *
   * Contract with the LLM:
   * - Provide actions (text + type) and eligible solutions (category/description/type)
   * - LLM returns:
   *    { matchedSolutions: ["CategoryX"], unmatchedReasons: { "CategoryY": "why not", ... } }
   * - We enforce at most one match, and merge in type-gating reasons.
   *
   * NOTE:
   *  - We do NOT mark solutions done here. This only classifies/filters;
   *    grading/finalization happens later.
   */
  async classifyActionsWithLLM(rawUpdates) {
    const actions = this.preprocessActions(rawUpdates);
    this.lastActions = actions; // stash for nextSteps
    const cats = this.solutions.map((s) => s.category);

    // Early exit if there is no action (change in dat)
    if (!actions.length || !this.solutions.length) {
      return { matched: [], unmatchedReasons: {} };
    }

    // Determine which solution "types" are matchable & filter
    const sawDM = actions.some((a) => a.type === "direct_chat");
    const sawComment = actions.some((a) => a.type === "public_comment");
    const eligible = this.solutions.filter((s) => {
      const t = String(s.type || "").toLowerCase(); // "dm" or "comment"
      return (t === "dm" && sawDM) || (t === "comment" && sawComment);
    });

    const typeGateReasons = {};
    for (const s of this.solutions) {
      if (!eligible.includes(s)) {
        const t = String(s.type || "").toLowerCase();
        typeGateReasons[s.category] =
          t === "dm"
            ? "No direct message observed this tick."
            : t === "comment"
              ? "No public comment observed this tick."
              : `Unsupported solution type "${t}".`;
      }
    }

    if (!eligible.length) {
      return { matched: [], unmatchedReasons: typeGateReasons };
    }

    const promptSystem = `
You are a semantic classifier.

INPUT:
- "actions": array of { text, type, mentioned }
- "solutions": array of { category, description, type, deltas, next_steps }

TASK:
1. Treat the entire actions list as one combined unit.
2. Identify the single best-fitting solution from the list, or none at all.
3. If a match is found, include its category in "matchedSolutions".
4. If no match is found, add an entry to "unmatchedReasons" for each solution explaining briefly why it was not matched.
5. Matching rules:
   • If type is "dm", they must be chatting with the target, not mentioning the target.
   • If the content partially fulfills the requirement but clearly shows correct intent, still align the solution.
6. There must be 0–1 matched solution. Never match more than one.
7. Be forgiving when the action matches the intent but not the exact wording.

OUTPUT FORMAT:
Return exactly one JSON object with two properties:
{
  "matchedSolutions": ["CategoryA"],
  "unmatchedReasons": {
    "CategoryB": "reason for B",
    "CategoryC": "reason for C"
  }
}
Do not emit any other text.
`.trim();

    const payload = {
      actions: actions.map((a) => ({
        text: a.text.slice(0, 800),
        type: a.type,
        mentioned: a.mentioned,
      })),
      categories: eligible.map((s) => ({
        name: s.category,
        description: s.description,
        type: s.type,
      })),
    };

    // Call OpenAI to autograde
    const resp = await this.openai.chat.completions.create({
      model: process.env.OPENAI_API_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: promptSystem.trim() },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const rawContent = resp.choices?.[0]?.message?.content ?? "";
    console.log("💡 LLM raw content:", rawContent);

    let result;
    try {
      result = JSON.parse(resp.choices[0].message.content.trim());
    } catch (e) {
      console.error("Failed to parse grouping output:", e);
      result = {
        matchedSolutions: [],
        unmatchedReasons: {},
      };
    }

    // Keep only categories that are actually eligible
    let matched = Array.isArray(result.matchedSolutions)
      ? result.matchedSolutions.filter((cat) =>
          eligible.some((s) => s.category === cat),
        )
      : [];

    // Enforce top-1 match
    if (matched.length > 1) matched = [matched[0]];

    // IMPORTANT: Do NOT mark solutions done here. Matching ≠ completion.

    const unmatchedReasons = {
      ...typeGateReasons,
      ...(result.unmatchedReasons || {}),
    };

    return {
      matched,
      unmatchedReasons,
    };
  }

  /**
   * Apply the sum of deltas for matched categories to the level's health score.
   * Does not mark solutions as done (pure scoring stage).
   * @param {string[]} categories
   * @returns {Promise<number>} updated health score for this level
   */
  async applyDeltas(categories, unmatchedReasons = {}) {
    const current = await this.scoreController.getHealthScore(this.level);
    const totalDelta = categories.reduce((sum, cat) => {
      if (cat === "none") return sum;
      const sol = this.solutions.find((s) => s.category === cat);
      return sol ? sum + (sol.deltas ?? sol.delta ?? 0) : sum;
    }, 0);

    const updated = current + totalDelta;
    await this.scoreController.setHealthScore(this.level, updated);

    // Do NOT mark objectives completed here; that happens after grading.
    return updated;
  }

  /**
   * Execute each matched solution's "next_steps" (if any).
   * Side effects:
   *  - Adds comments as specific agents
   *  - Modifies a relevant post body (with backup)
   * Finds one relevant post per scenario and applies steps in order.
   *
   * @param {string[]} categories  – Array of category names, same length as lastActions
   */
  async processNextSteps(categories) {
    // load session once (relies on SESSION_NAME)
    const session = await Session.findOne({
      name: process.env.SESSION_NAME,
    }).exec();
    if (!session)
      throw new Error(`Session "${process.env.SESSION_NAME}" not found`);

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      if (cat === "none") continue;

      const sol = this.solutions.find((s) => s.category === cat);
      if (!sol || !sol.next_steps || !sol.next_steps.length) continue;

      const stepType = sol.next_steps[0].type;
      console.log(`[Grader] Scenario "${sol.category}" -> ${stepType}`);

      // Pick a relevant post once per scenario (policy: the one with isRelevant: true)
      const post = await Script.findOne({
        level: this.level,
        isRelevant: true,
      }).exec();
      if (!post) break;
      console.log(`[Grader] Target post ID: ${post._id}`);

      for (const step of sol.next_steps) {
        if (step.type === "comment") {
          const actor = await Agent.findOne({ username: step.agent }).exec();
          if (!actor) break;

          console.log(
            `[Grader] Posting comment by ${actor.username} (${actor._id}) on post ${post._id}: "${step.content}"`,
          );
          const commentId = await pushComment({
            postId: post._id.toString(),
            text: step.content,
            author: actor._id.toString(),
            sessionName: process.env.SESSION_NAME,
            level: this.level,
            ownerUser: this.user?._id,
          });
          console.log(`[Grader] Comment posted with ID ${commentId}`);
        } else if (step.type === "modify post") {
          // Replace body content (with backup + revert path)
          console.log(
            `[Grader] Modifying post ${post._id} with new body: "${step.content}"`,
          );
          const modifiedId = await modifyPost({
            postId: post._id.toString(),
            newBody: step.content,
          });
          console.log(`[Grader] Post modified with ID ${modifiedId}`);
        }
      }
    }
  }

  /**
   * Call this AFTER your grading logic decides which categories truly passed.
   * - Marks those solutions as done
   * - Attempts composite/single objective completion based on type & requires
   *
   * @param {string[]} gradedCategories
   * @param {Record<string,string>} unmatchedReasons
   */
  async finalizeAfterGrading(gradedCategories, unmatchedReasons = {}) {
    for (const cat of gradedCategories) {
      if (!cat || cat === "none") continue;
      await Solution.updateOne(
        { level: this.level, category: cat },
        { $set: { done: true } },
      );
    }
    await this.markCompletedObjectives(gradedCategories, unmatchedReasons);
  }

  /**
   * Strict, type-aware objective completion:
   *  - Enforces DM vs public comment requirements
   *  - Limits to one objective per category this tick
   *  - Handles composite objectives (requires) only when:
   *      * all required categories are done (Solution.done = true)
   *      * at least one required category completed in THIS tick
   *
   * Also logs reasons for uncompleted objectives using unmatchedReasons where applicable.
   */
  async markCompletedObjectives(categories, unmatchedReasons = {}) {
    if (!this.user || typeof this.user.save !== "function") {
      throw new Error("Grader requires a user to mark objectives");
    }
    const userDoc = this.user;
    const lvl = getUserLevel(userDoc);

    // Pull objective definitions at this level (ignore global completed flags)
    const objectives = await Objective.find({ level: lvl }).lean();
    const objectiveById = new Map(
      objectives.map((o) => [String(o._id), o]),
    );

    const now = new Date();
    const matched = [];
    const completedCats = new Set(); // per-user completed categories (from objectiveProgress)

    // Track per-user progress (fallback to empty map if no user)
    const progressById = new Map();
    if (userDoc && Array.isArray(userDoc.objectiveProgress)) {
      for (const entry of userDoc.objectiveProgress) {
        if (!entry || !entry.objective) continue;
        if (Number(entry.level) !== lvl) continue;
        progressById.set(String(entry.objective), entry);
        if (entry.completed) {
          const def = objectiveById.get(String(entry.objective));
          if (def?.goalCategory) completedCats.add(def.goalCategory);
        }
      }
    }

    // What action types occurred this tick?
    const actions = Array.isArray(this.lastActions) ? this.lastActions : [];
    const sawDM = actions.some((a) => a.type === "direct_chat");
    const sawComment = actions.some((a) => a.type === "public_comment");

    // Track which categories were newly completed this tick
    const newlyCompletedCats = new Set(
      (categories || []).filter((c) => c && c !== "none"),
    );

    // === Mark single, type-correct objective per matched category ===
    for (const cat of categories) {
      if (cat === "none") continue;

      for (const obj of objectives) {
        if (obj.goalCategory !== cat) continue;

        // Enforce objective type: 'dm' or 'comment' (default: none)
        const reqType = String(obj.taskType || "").toLowerCase();
        if (reqType === "dm" && !sawDM) continue;
        if (reqType === "comment" && !sawComment) continue;

        const prog = progressById.get(String(obj._id)) || {
          objective: obj._id,
          level: lvl,
          completed: false,
          completedAt: null,
        };
        if (prog.completed) continue;

        prog.completed = true;
        prog.completedAt = now;
        progressById.set(String(obj._id), prog);
        completedCats.add(cat);

        matched.push({
          label: obj.label,
          goalCategory: obj.goalCategory,
          description:
            this.solutions.find((s) => s.category === cat)?.description || null,
        });

        // Only one objective per category in this tick
        break;
      }
    }

    // Log successful objective completions (if any)
    if (matched.length > 0) {
      console.log("🎯 Objectives completed:");
      for (const item of matched) {
        console.log(
          `→ ${item.label} (${item.goalCategory}): ${item.description || "No description"}`,
        );
      }

      // === Composite completion rules ===
      // Only complete if: requires are valid, ALL required categories are done,
      // and at least one was completed in THIS tick.
      const composites = objectives.filter((o) => o.isComposite);

      // Helper: resolve requires → category strings (supports ids or strings)
      const isHex24 = (v) =>
        typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v.trim());

      for (const obj of composites) {
        const rawReqs = Array.isArray(obj.requires) ? obj.requires : [];
        if (!rawReqs.length) {
          console.warn(
            `⏭️  Composite "${obj.label}" has empty requires; skipping auto-complete.`,
          );
          continue;
        }

        // Separate ObjectId-like vs string category requirements
        const idReqs = rawReqs.filter((r) => isHex24(String(r)));
        let reqCats = rawReqs
          .filter((r) => typeof r === "string")
          .map((s) => s.trim())
          .filter(Boolean);

        // Resolve any ObjectId requirements to their solution categories
        if (idReqs.length) {
          const reqSols = await Solution.find({ _id: { $in: idReqs } }).lean();
          reqCats.push(...reqSols.map((s) => s.category).filter(Boolean));
        }

        // Keep only categories that exist among this level's solutions
        const solutionCats = new Set(this.solutions.map((s) => s.category));
        reqCats = [...new Set(reqCats)].filter((c) => solutionCats.has(c));

        if (!reqCats.length) {
          console.warn(
            `⏭️  Composite "${obj.label}" has no resolvable requires for this level; skipping.`,
          );
          continue;
        }

        const allMet = reqCats.every((cat) => completedCats.has(cat));
        const thisTickContributed = reqCats.some((cat) =>
          newlyCompletedCats.has(cat),
        );

        if (allMet && thisTickContributed) {
          const prog = progressById.get(String(obj._id)) || {
            objective: obj._id,
            level: lvl,
            completed: false,
            completedAt: null,
          };
          prog.completed = true;
          prog.completedAt = new Date();
          progressById.set(String(obj._id), prog);
          console.log(`✅ Composite objective complete: ${obj.label}`);
        } else {
          if (!allMet) {
            console.log(
              `🧩 Composite "${obj.label}" pending: requires not all done →`,
              reqCats,
            );
          } else if (!thisTickContributed) {
            console.log(
              `🧩 Composite "${obj.label}" pending: this tick did not complete any of →`,
              reqCats,
            );
          }
        }
      }
    }

    // Log reasons for still-uncompleted objectives (scoped to category)
    const uncompleted = objectives
      .filter((o) => !progressById.get(String(o._id))?.completed)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    for (const obj of uncompleted) {
      let reason = unmatchedReasons[obj.goalCategory];

      // If category matched but type requirement blocked completion, surface that
      if (!reason && categories.includes(obj.goalCategory)) {
        const reqType = String(obj.taskType || "").toLowerCase();
        if (reqType === "dm" && !sawDM) {
          reason = "Awaiting a direct message for this objective.";
        } else if (reqType === "comment" && !sawComment) {
          reason = "Awaiting a public comment for this objective.";
        }
      }

      if (reason) {
        console.warn(
          `⚠️ Objective "${obj.label}" (category: ${obj.goalCategory}) was NOT completed.\nReason: ${reason}`,
        );
        // Optional: persist or surface this reason elsewhere
      }
    }

    // Persist per-user progress if available
    if (userDoc) {
      if (!Array.isArray(userDoc.objectiveProgress))
        userDoc.objectiveProgress = [];
      const otherLevels = userDoc.objectiveProgress.filter(
        (p) => Number(p.level) !== lvl,
      );
      userDoc.objectiveProgress = [
        ...otherLevels,
        ...Array.from(progressById.values()),
      ];
      await userDoc.save();
    }
  }

  /**
   * Fully reset a level's progress:
   * - Marks all solutions as not done
   * - Reverts any modified posts to their original bodies (from PostBackup)
   * - Clears PostBackup entries for the level
   * - Resets health score to 0 (if controller available)
   * - Clears transient in-memory state for the current Grader instance
   */
  async resetLevel(level) {
    const lvl = Number(level);
    if (!Number.isFinite(lvl))
      throw new Error(`Invalid level for reset: ${level}`);

    // Mark all solutions as NOT done (idempotent)
    const result = await Solution.updateMany(
      {
        $or: [{ level: lvl }, { level: String(lvl) }],
        $or: [{ done: { $exists: false } }, { done: { $ne: false } }],
      },
      { $set: { done: false } },
      { writeConcern: { w: "majority" } },
    );

    // Restore post bodies from backups
    const backups = await PostBackup.find({ level: lvl }).lean();
    for (const b of backups) {
      await Script.findByIdAndUpdate(
        b.postId,
        {
          $set: {
            body: b.originalBody,
            updateTime: new Date(),
          },
        },
        { new: false },
      );
    }
    if (backups.length) {
      console.log(
        `[Grader] Reverted ${backups.length} post(s) for level ${lvl}.`,
      );
    }
    await PostBackup.deleteMany({ level: lvl });

    // Reset level score in DB
    if (this.scoreController?.setHealthScore) {
      await this.scoreController.setHealthScore(lvl, 0);
      console.log(`[Grader] Health score reset to 0 for level ${lvl}.`);
    } else {
      console.warn("[Grader] scoreController.setHealthScore not available.");
    }

    // Clear transient class state for this level (safe to do)
    if (this.level === lvl) {
      this.levelEntry = null;
      this.currentCategory = null;
      this.solutions = [];
      this.lastActions = [];
    }
  }
}

module.exports = Grader;
