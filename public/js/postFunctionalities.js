function onBottomVisible(element) {
  const postParent = $(this).closest("[postID]");
  const commentParent = $(this).closest("[commentID]");

  const parent = commentParent.length ? commentParent : postParent;
  const timer = parent.children(".viewTimer");
  // Bottom of the element enters from bottom (scrolling down the feed; as normal)
  if (element.topVisible) {
    // Scrolling Down AND entire element is visible in the viewport
    // If this is the first time bottom is visible
    timer.text(parseInt(timer.text()) || Date.now());
  } else {
    // Scrolling up and this event does not matter, since entire photo isn't visible anyways.
    // Reset Timer
    timer.text("NaN");
  }
}

// Element's bottom edge has passed top of the screen (disappearing); happens only when Scrolling Up
function onBottomPassed(element) {
  const postParent = $(this).closest("[postID]");
  const commentParent = $(this).closest("[commentID]");
  const parent = commentParent.length ? commentParent : postParent;
  const timer = parent.children(".viewTimer");

  const endTime = Date.now();
  const startTime = parseInt(timer.text());
  const totalViewTime = endTime - startTime; // TOTAL TIME HERE

  const postID = postParent.attr("postID");
  const commentID = commentParent?.attr("commentID");

  // If user viewed it for less than 24 hours, but more than 1.5 seconds (just in case)
  if (totalViewTime < 86400000 && totalViewTime > 1500) {
    $.post("/feed", {
      postID: postID,
      commentID: commentID,
      viewed: startTime,
      duration: totalViewTime,
      _csrf: $('meta[name="csrf-token"]').attr("content"),
    });
  }

  // Reset Timer
  timer.text("NaN");
}

// Handling scrolling up
// Element's top edge has passed top of the screen (appearing); happens only when Scrolling Up
function onTopPassedReverse(element) {
  const postParent = $(this).closest("[postID]");
  const commentParent = $(this).closest("[commentID]");
  const parent = commentParent.length ? commentParent : postParent;
  const timer = parent.children(".viewTimer");

  if (element.bottomVisible) {
    // Scrolling Up AND entire post is visible on the viewport
    timer.text(parseInt(timer.text()) || Date.now());
  } else {
    // Scrolling down and this event does not matter, since entire photo isn't visible anyways.
    // Reset Timer
    timer.text("NaN");
  }
}

// Called when topVisible turns false (exits from top or bottom)
function onTopVisibleReverse(element) {
  const postParent = $(this).closest("[postID]");
  const commentParent = $(this).closest("[commentID]");
  const parent = commentParent.length ? commentParent : postParent;
  const timer = parent.children(".viewTimer");

  if (element.topPassed) {
    // Scrolling Down, disappears on top; this event doesn't matter (since it is when bottom disappears that time is stopped)
  } else {
    // False when Scrolling Up (the bottom of element exits screen.)
    const endTime = Date.now();
    const startTime = parseInt(timer.text());
    const totalViewTime = endTime - startTime;

    const postID = postParent.attr("postID");
    const commentID = commentParent?.attr("commentID");

    // If user viewed it for less than 24 hours, but more than 1.5 seconds (just in case)
    if (totalViewTime < 86400000 && totalViewTime > 1500) {
      $.post("/feed", {
        postID: postID,
        commentID: commentID,
        viewed: startTime,
        duration: totalViewTime,
        _csrf: $('meta[name="csrf-token"]').attr("content"),
      });
      // Reset Timer
      timer.text("NaN");
    }
  }
}

function likePost(e) {
  const target = $(e.target).closest(".ui.like.button");
  const label = target
    .closest(".ui.like.button")
    .next("a.ui.basic.red.left.pointing.label.count");
  const postID = target.closest(".ui.fluid.card").attr("postID");
  const currDate = Date.now();

  if (target.hasClass("red")) {
    // Unlike Post
    target.removeClass("red");
    label.html(function (i, val) {
      return val * 1 - 1;
    });

    $.post("/feed", {
      postID: postID,
      unlike: currDate,
      _csrf: $('meta[name="csrf-token"]').attr("content"),
    });
  } else {
    // Like Post
    target.addClass("red");
    label.html(function (i, val) {
      return val * 1 + 1;
    });

    $.post("/feed", {
      postID: postID,
      like: currDate,
      _csrf: $('meta[name="csrf-token"]').attr("content"),
    });
  }
}

function flagPost(e) {
  const target = $(e.target);
  const post = target.closest(".ui.fluid.card");
  const postID = post.attr("postID");
  const flag = Date.now();

  $.post("/feed", {
    postID: postID,
    flag: flag,
    _csrf: $('meta[name="csrf-token"]').attr("content"),
  });
  post.find(".ui.dimmer.flag").dimmer({ closable: true }).dimmer("show");
}

function unflagPost(e) {
  const target = $(e.target);
  const post = target.closest(".ui.fluid.card");
  const postID = post.attr("postID");
  const unflag = Date.now();

  $.post("/feed", {
    postID: postID,
    unflag: unflag,
    _csrf: $('meta[name="csrf-token"]').attr("content"),
  });
  target
    .closest(".ui.fluid.card")
    .find(".ui.dimmer.flag")
    .removeClass("active")
    .dimmer({ closable: true })
    .dimmer("hide");
}

function sharePost(e) {
  $("span.shareType").html(" post");
  $(".ui.small.basic.share.modal").modal("show");
  const target = $(e.target);
  const post = target.closest(".ui.fluid.card");
  const postID = post.attr("postID");
  const share = Date.now();

  $.post("/feed", {
    postID: postID,
    share: share,
    _csrf: $('meta[name="csrf-token"]').attr("content"),
  });
}

function likeComment(e) {
  const target = $(e.target);
  const comment = target.parents(".comment");
  const label = comment.find("span.num");

  const postID = target.closest(".ui.fluid.card").attr("postID");
  const commentID = comment.attr("commentID");
  const currDate = Date.now();

  if (target.hasClass("red")) {
    // Unlike comment
    target.removeClass("red");
    comment.find("i.heart.icon").removeClass("red");
    target.html("Like");
    label.html(function (i, val) {
      return val * 1 - 1;
    });

    $.post("/feed", {
      postID: postID,
      commentID: commentID,
      unlike: currDate,
      _csrf: $('meta[name="csrf-token"]').attr("content"),
    });
  } else {
    // Like comment
    target.addClass("red");
    comment.find("i.heart.icon").addClass("red");
    target.html("Unlike");
    label.html(function (i, val) {
      return val * 1 + 1;
    });

    $.post("/feed", {
      postID: postID,
      commentID: commentID,
      like: currDate,
      _csrf: $('meta[name="csrf-token"]').attr("content"),
    });
  }
}

function flagComment(e) {
  const target = $(e.target);
  const commentElement = target.parents(".comment");
  const postID = target.closest(".ui.fluid.card").attr("postID");
  const commentID = commentElement.attr("commentID");

  const comment_imageElement = commentElement.children("a.avatar");
  const comment_contentElement = commentElement.children(".content");
  const flaggedComment_contentElement =
    commentElement.children(".content.hidden");

  comment_imageElement.transition("hide");
  comment_contentElement.transition("hide");
  $(flaggedComment_contentElement).transition();
  const flag = Date.now();

  if (target.closest(".ui.fluid.card").attr("type") == "userPost")
    console.log("Should never be here.");
  else
    $.post("/feed", {
      postID: postID,
      commentID: commentID,
      flag: flag,
      _csrf: $('meta[name="csrf-token"]').attr("content"),
    });
}

function unflagComment(e) {
  const target = $(e.target);
  const commentElement = target.parents(".comment");
  const postID = target.closest(".ui.fluid.card").attr("postID");
  const commentID = commentElement.attr("commentID");

  const comment_imageElement = commentElement.children("a.avatar.hidden");
  const comment_contentElement = commentElement.children(".content.hidden");
  const flaggedComment_contentElement = commentElement.children(
    ".content:not(.hidden)",
  );

  $(flaggedComment_contentElement).transition("hide");
  comment_imageElement.transition();
  comment_imageElement.find("img").visibility("refresh");
  comment_contentElement.transition();
  const unflag = Date.now();

  if (target.closest(".ui.fluid.card").attr("type") == "userPost")
    console.log("Should never be here.");
  else
    $.post("/feed", {
      postID: postID,
      commentID: commentID,
      unflag: unflag,
      _csrf: $('meta[name="csrf-token"]').attr("content"),
    });
}

function shareComment(e) {
  $("span.shareType").html(" comment");
  $(".ui.small.basic.share.modal").modal("show");
  const target = $(e.target);
  const commentElement = target.parents(".comment");
  const postID = target.closest(".ui.fluid.card").attr("postID");
  const commentID = commentElement.attr("commentID");
  const share = Date.now();

  $.post("/feed", {
    postID: postID,
    commentID: commentID,
    share: share,
    _csrf: $('meta[name="csrf-token"]').attr("content"),
  });
}

// Track writing sessions
let currentLogs = [];
let previousText = ""; // Keep track of previous text to detect what was deleted

function addComment(e) {
  console.log("Clicked comment button at", new Date());

  e.preventDefault(); // Prevent default form/button behavior

  const target = $(e.target);
  const card = target.closest(".ui.fluid.card");
  const comments = card.find(".ui.comments").length
    ? card.find(".ui.comments")
    : $('<div class="content"><div class="ui comments"></div>')
        .insertAfter(card.find(".ui.bottom.attached.icon.buttons"))
        .find(".ui.comments");

  const textArea = target.siblings(".ui.form").find("textarea.newcomment");
  const text = textArea.val().trim();

  if (!text) return;

  const currDate = Date.now();
  const ava = target.siblings(".ui.label").find("img.ui.avatar.image");
  const ava_img = ava.attr("src");
  const ava_name = ava.attr("name");
  const postID = card.attr("postID");
  const urlParams = new URLSearchParams(window.location.search);
  const level = parseInt(urlParams.get("level")) || 1;
  console.log("Adding comment for postID:", postID, "at level:", level);

  target.prop("disabled", true); // disable the button

  $.post("/feed", {
    postID,
    new_comment: currDate,
    comment_text: text,
    logs: currentLogs,
    commentType: "User",
    currentLevel: level,
    _csrf: $('meta[name="csrf-token"]').attr("content"),
  })
    .then(function (json) {
      const mess = `
        <div class="comment" commentID=${json.commentID}>
            <a class="avatar"><img src="${ava_img}"></a>
            <div class="content"> 
                <a href="/user/${ava_name}">${ava_name}</a>
                <div class="metadata"> 
                    <span class="date">${humanized_time_span(currDate)}</span>
                    <i class="heart icon"></i> 
                    <span class="num"> 0 </span> Likes
                </div> 
                <div class="text">${text}</div>
                <div class="actions"> 
                    <a class="like comment" onClick="likeComment(event)">Like</a> 
                </div> 
            </div>
        </div>`;

      comments.append(mess);
      textArea.val(""); // clear input
      currentLogs = []; // reset logs
      target.prop("disabled", false); // re-enable button
    })
    .catch(function (err) {
      console.error("Comment submission failed", err);
      alert("Failed to submit comment. Please try again.");
      target.prop("disabled", false); // always re-enable
    });
}

function followUser(e) {
  const target = $(e.target);
  const username = target.attr("actor_un");
  if (target.text().trim() == "Follow") {
    // Follow Actor
    $(`.ui.basic.primary.follow.button[actor_un='${username}']`).each(
      function (i, element) {
        const button = $(element);
        button.text("Following");
        button.prepend("<i class='check icon'></i>");
      },
    );
    $.post("/user", {
      followed: username,
      _csrf: $('meta[name="csrf-token"]').attr("content"),
    });
  } else {
    // Unfollow Actor
    $(`.ui.basic.primary.follow.button[actor_un='${username}']`).each(
      function (i, element) {
        const button = $(element);
        button.text("Follow");
        button.find("i").remove();
      },
    );
    $.post("/user", {
      unfollowed: username,
      _csrf: $('meta[name="csrf-token"]').attr("content"),
    });
  }
}

function populatePost(e) {
  $.post("/action", {
    input: {
      action: "post",
      author: "user3",
      actionObject: null,
      actionBody: "This is a test post.",
      timestamp: "01/17/2025 14:00:00",
    },
    _csrf: $('meta[name="csrf-token"]').attr("content"),
  });
}

$(window).on("load", () => {
  // add humanized time to all posts
  $(".right.floated.time.meta, .date").each(function () {
    const ms = parseInt($(this).text(), 10);
    const time = new Date(ms);
    $(this).text(humanized_time_span(time));
  });

  // ************ Actions on Main Post ***************
  // Focus new comment element if "Reply" button is clicked
  $(".reply.button").on("click", function () {
    let parent = $(this).closest(".ui.fluid.card");
    parent.find("textarea.newcomment").focus();
  });

  // Log each key press in comment textarea
  $("textarea.newcomment").on("keydown", function (e) {
    //console.log("Key pressed:", e.key);
  });

  // Press enter to submit a comment
  $("textarea.newcomment").keydown(function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      $(this).parents(".ui.form").siblings("i.big.send.link.icon").click();
    }
  });

  $(".generate.post.button").on("click", populatePost);

  // Create a new Comment
  $("i.big.send.link.icon").on("click", addComment);

  // Like/Unlike Post
  $(".like.button").on("click", likePost);

  // Flag Post
  $(".flag.button").on("click", flagPost);

  // Unflag Post
  $(".unflag.button").click(unflagPost);

  // Share Post
  $(".ui.share.button").on("click", sharePost);

  // ************ Actions on Comments***************
  // Like/Unlike comment
  $("a.like.comment").on("click", likeComment);

  // Flag comment
  $("a.flag.comment").on("click", flagComment);

  // Unflag comment
  $("a.unflag").click(unflagComment);

  // Share comment
  $("a.share").on("click", shareComment);

  // Follow button
  $(".ui.basic.primary.follow.button").on("click", followUser);

  // Track how long a post is on the screen
  // Start time: When the entire post is visible in the viewport.
  // End time: When the entire post is no longer visible in the viewport.
  $("[postID] .description").visibility({
    once: false,
    continuous: false,
    observeChanges: true,
    // throttle:100,
    initialCheck: true,
    offset: 50,

    onBottomVisible,
    onBottomPassed,
    onTopPassedReverse,
    onTopVisibleReverse,
  });

  // Track how long a comment is on the screen
  // Start time: When the entire comment is visible in the viewport.
  // End time: When the entire comment is no longer visible in the viewport.
  $("[commentID] .text:visible").visibility({
    once: false,
    continuous: false,
    observeChanges: true,
    // throttle:100,
    initialCheck: true,
    offset: 50,

    onBottomVisible,
    onBottomPassed,
    onTopPassedReverse,
    onTopVisibleReverse,
  });

  // Track comment writing sessions
  $("textarea.newcomment").on("input", function (e) {
    const inputType = e.originalEvent?.inputType;
    const currentText = this.value;
    const eventName = inputType?.startsWith("delete")
      ? "text-delete"
      : "text-insert";

    // Create text delta based on the operation
    let textDelta;
    if (eventName === "text-delete") {
      // Find what text was deleted by comparing with previous state
      const deletedText = previousText.slice(
        this.selectionStart,
        this.selectionStart + 1,
      );
      textDelta = {
        ops: [
          {
            delete: deletedText,
          },
        ],
      };
    } else {
      textDelta = {
        ops: [
          {
            insert: e.originalEvent?.data || "",
          },
        ],
      };
    }

    const logEntry = {
      eventName: eventName,
      eventTimestamp: Date.now(),
      textDelta: textDelta,
      currentCursor: this.selectionStart,
    };

    currentLogs.push(logEntry);
    console.log("Log entry:", logEntry); // Debug log

    // Update previous text for next comparison
    previousText = currentText;
  });
});

function bindCommentHandlers() {
  // Rebind send button
  $(document)
    .off("click", "i.big.send.link.icon")
    .on("click", "i.big.send.link.icon", addComment);

  // Rebind enter-to-submit on textarea
  $(document)
    .off("keydown", "textarea.newcomment")
    .on("keydown", "textarea.newcomment", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        $(this).parents(".ui.form").siblings("i.big.send.link.icon").click();
      }
    });

  console.log("✅ Comment event handlers bound via delegation");
}
