const toggleAmount = 300;

// Chats are saved in the MongoDB in the format [USERNAME_A]-[USERNAME_B], where USERNAME_A and USERNAME_B are the two actors in the chat.
// USERNAME_A and USERNAME_B are alphabetical.
function getChatFullId(usernameA, usernameB) {
  const sortedArray = [usernameA, usernameB].sort();
  return sortedArray[0] + "-" + sortedArray[1];
}

function toggleChatOpen() {
  const $chatBox = $(".actor-chat .chat");
  const $history = $(".actor-chat .chat .chat-history");
  const $composer = $(".actor-chat .chat .chat-message");
  const isVisible = $chatBox.is(":visible");
  const instance = $(".actor-chat.container.clearfix").data("chatInstance");

  // Do not open chat unless a target has been selected (e.g., via Message button)
  if (!instance || !instance.chatId) return;

  if (isVisible) {
    $history.slideUp(toggleAmount, "swing");
    $composer.slideUp(toggleAmount, "swing", function () {
      $chatBox.transition("fade down");
    });
    setChatToggleState(false);
    setChatArrow(false); // collapsed -> up
  } else {
    $chatBox.removeClass("hidden").show();
    $history.slideDown(toggleAmount, "swing");
    $composer.slideDown(toggleAmount, "swing");
    setChatToggleState(true);
    setChatArrow(true); // expanded -> down
  }
}

// Update the bottom-right toggle label
function updateChatToggleLabel(label) {
  const el = document.querySelector("#newPostButton .chat-toggle__label");
  if (el && typeof label === "string") el.textContent = label;
}

function setChatToggleState(isOpen) {
  const btn = document.getElementById("newPostButton");
  if (btn) {
    btn.classList.toggle("chat-open", !!isOpen);
  }
}

function setChatArrow(isOpen) {
  const $icon = $(".actor-chat .chat .chat-minimize");
  if ($icon.length) {
    $icon.toggleClass("angle-down", !!isOpen).toggleClass("angle-up", !isOpen);
  }
}

async function openActorChat(username) {
  // Update chat instance
  const chat = $(".actor-chat.container.clearfix").data("chatInstance");
  chat.chatId = username.trim();
  chat.userId = $(".actor-chat").attr("userId");
  chat.mostRecentMessenger = null;
  chat.typingTimeout = null;
  chat.resetChat();

  // Get previous messages in #USERNAME chat and update chat messages
  const data = await $.getJSON("/chat", {
    chatFullId: getChatFullId(username, chat.userId),
    chatId: username,
  });

  // Update chat header with given actor metadata
  $(".actor-chat").attr("id", data["username"]);
  const partnerImg = data["picture"] || "/public/person.svg";
  $(".actor-chat .chat").data("partnerImage", partnerImg);
  chat.partnerImage = partnerImg;
  $(".actor-chat .chat .chat-header .chat-about .chat-with").text(
    "Chat with " + (!data["name"] ? `@${data["username"]}` : data["name"]),
  );
  updateChatToggleLabel(
    !data["name"]
      ? `Messaging @${data["username"]}`
      : `Messaging ${data["name"]}`,
  );

  // Process messages and update metadata after data is fetched
  for (const msg of data["messages"]) {
    chat.addMessageExternal(msg.body, msg.absTime, msg.messenger.username);
  }

  const $chatBox = $(".actor-chat .chat");
  const $history = $(".actor-chat .chat-history");
  const $composer = $(".actor-chat .chat-message");
  const wasOpen =
    $chatBox.is(":visible") &&
    ($history.is(":visible") || $composer.is(":visible"));
  $chatBox.removeClass("hidden").show();
  if (wasOpen) {
    $history.show();
    $composer.show();
    setChatToggleState(true);
    setChatArrow(true);
  } else {
    $history.hide();
    $composer.hide();
    setChatToggleState(false);
    setChatArrow(false);
  }
}
function openChatbot() {
  console.log("opening chatbot");
  const id = "chatbot";
  const name = "ChatBot";
  openActorChat(id, name, true);
}
window.openChatbot = openChatbot;
window.toggleChatPanel = function () {
  toggleChatOpen();
};

// Handles clicking the "Message (actor)" button from username hover
function clickMessageUser(event) {
  const target = $(event.target);
  const username = target
    .parent()
    .siblings(".header")
    .attr("data-username")
    .trim();
  openActorChat(username);
}

// Handles clicking the "Message (actor)" button from actor's profile
function messageFromProfile(event) {
  const target = $(event.target);
  const username = target.attr("actor_un").trim();
  openActorChat(username);
}

$(window).on("load", function () {
  // Socket listening to broadcasts
  // Incoming messages
  // TO DO: Revisit if socket.io is the best way to handle messaging (especially with large amounts of users)
  socket.on("chat message", async function (msg) {
    // Check if incoming message is for you
    if (msg.chatId == $(".actor-chat").attr("userId")) {
      const chat = $(".actor-chat.container.clearfix").data("chatInstance");
      if (chat) {
        //- If message received is to a new actor
        if (chat.chatId != msg.senderUsername) {
          await openActorChat(
            msg.senderUsername,
            msg.senderName,
            msg.senderSrc,
          );
        } else {
          chat.addMessageExternal(msg.body, msg.absTime, msg.senderUsername);
        }
      }
    }
  });

  // Incoming typing
  socket.on("chat typing", async function (msg) {
    // Check if incoming message is for you
    if (msg.chatId == $(".actor-chat").attr("userId")) {
      const chat = $(".actor-chat.container.clearfix").data("chatInstance");
      if (chat) {
        //- If message received is to current chat opened
        if (
          msg.senderUsername == chat.chatId &&
          $(".actor-chat .chat .chat-history").is(":visible")
        ) {
          chat.addTypingAnimationExternal(msg.senderUsername);
        }
      }
    }
  });

  // Enable popups over usernames
  $(".username").popup({
    hoverable: true,
    onShow: function (el) {
      const name = $(el).text();
      const username = $(el).parent().attr("href").replace("/user/", "");
      //- HTML structure for post and comment is different
      const picture =
        $(el).parent().siblings(".avatar").find("img").attr("src") ||
        $(el).parents(".content").siblings(".avatar").find("img").attr("src");
      const isSelf = $(el).attr("data-self") == "true";
      if (!isSelf) {
        $(this)
          .html(`<div class='header' data-username=${username}><img class='ui avatar image' src='${picture}'/>${name}</div>
                        <div class='content'>
                          <button class='ui small button basic message-button' onClick="clickMessageUser(event)">Message</button>
                        </div>`);
      }
    },
  });

  // Message button
  $(".ui.basic.primary.message-user.button").on("click", messageFromProfile);

  // Define and initiate chats
  $(".container.clearfix").each(function () {
    const chatId = this.id; // The username of the person the user is chatting with
    const userId = this.userId; // The username of the user
    const chat = {
      mostRecentMessenger: null, // Username of the person who sent message last in the chat
      chatId: chatId,
      userId: userId,
      typingTimeout: null,
      init: function () {
        this.cacheDOM();
        this.bindEvents();
        $(this.$chatHistory)
          .closest(".container.clearfix")
          .data("chatInstance", this); // Store instance
      },
      cacheDOM: function () {
        this.$chatHistory = $(".actor-chat .chat-history");
        this.$button = $(".actor-chat button");
        this.$textarea = $(".actor-chat #message-to-send");
        this.partnerImage =
          $(".actor-chat .chat").data("partnerImage") ||
          "/public/profile_pictures/person.svg";
        this.$chatHistoryList = this.$chatHistory.find("ul");
        this.$profile = $("img.mini.spaced.circular.image").attr("src"); // Grabbing user's profile photo from header.
      },
      bindEvents: function () {
        this.$button.on("click", this.addMessage.bind(this));
        this.$textarea.on("keydown", this.addMessageTyping.bind(this));
      },
      // Renders a message
      render: function (
        body,
        absTime,
        username,
        isExternalMessage,
        isTypingAnimation,
      ) {
        const absTimeFormatted = new Date(absTime).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
        if (this.typingTimeout != null) {
          clearTimeout(this.typingTimeout);
          this.typingTimeout = null;
          this.removeTypingAnimationExternal();
        }
        if (isTypingAnimation || body.trim() !== "") {
          let messageContent;
          // User's own message
          if (this.userId == username) {
            messageContent = `
                                                <li class="clearfix">
                                                  <div class="ui grid centered">
                                                    <div class="thirteen wide right aligned column padding-right-small my-message-div">
                                                      <div class="my-message align-right">
                                                        ${body}
                                                      </div>
                                                      <span class="message-data-time align-right">${absTimeFormatted}</span>
                                                    </div>
                                                    <div class="three wide column padding-right-small">
                                                      <div class="align-center">
                                                        ${this.mostRecentMessenger != username ? `<img class="message-avatar ui avatar image" src="${this.$profile}"/>` : ""}
                                                      </div>
                                                    </div>
                                                  </div> 
                                                </li>`;
          } // Other user's messages
          else {
            messageContent = `
                                                <li class="clearfix">
                                                  <div class="ui grid centered">
                                                    <div class="three wide column padding-right-small">
                                                      <div class="align-center">
                                                        ${this.mostRecentMessenger != username ? `<img class="message-avatar ui avatar image" src="${this.partnerImage}"/>` : ""}
                                                      </div>
                                                    </div>
                                                    <div class="thirteen wide right aligned column padding-left-small other-message-div">
                                                      <div class="other-message align-left">
                                                        ${isTypingAnimation ? '<img src="/public/typing.gif"/>' : body}
                                                      </div>
                                                      ${isTypingAnimation ? "" : `<span class="message-data-time align-left">${absTimeFormatted}</span>`}
                                                    </div>
                                                  </div>
                                                </li>`;
          }

          if (!isTypingAnimation) {
            this.mostRecentMessenger = username;
          }
          this.$chatHistoryList.append(messageContent);
        }
        // Scroll to the bottom of the chat. If it is the user's own message, clear the textarea.
        this.scrollToBottom();
        if (!isExternalMessage) {
          this.$textarea.val("");
        }
      },

      // Handles the addition of outgoing message (by the user) to chat history
      addMessage: async function () {
        const username = this.userId;
        const message = this.$textarea.val();
        const absTime = Date.now();

        this.render(message, absTime, username, false, false);
        socket.emit("chat message", {
          chatId: this.chatId, // To whom is the message for
          body: message,
          absTime: absTime,
          senderUsername: username, // From whom is the message from
        });
        this.addTypingAnimationExternal(this.chatId);

        // Save the message to the database
        const json = await $.post("/chat", {
          chatFullId: getChatFullId(this.chatId, username),
          body: message,
          absTime: absTime,
          username: username,
          _csrf: $('meta[name="csrf-token"]').attr("content"),
        });

        if (json.reply) {
          this.render(json.reply, Date.now(), this.chatId, true, false);
        }
      },

      // Handles the addition of an incoming message to chat history
      addMessageExternal: function (body, absTime, username) {
        this.render(body, absTime, username, true, false);
      },

      // Handles typing events in the textarea of chats
      addMessageTyping: function (event) {
        const username = this.userId;
        if (event.keyCode == 13 && !event.ctrlKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.addMessage();
        } else {
          event.stopImmediatePropagation();

          socket.emit("chat typing", {
            chatId: this.chatId, // To whom is the message for
            senderUsername: username, // From whom is the message from
          });
        }
      },

      // Adds typing animation
      addTypingAnimationExternal: function (username) {
        if (this.typingTimeout == null) {
          this.render(undefined, undefined, username, true, true);
        } else {
          clearTimeout(this.typingTimeout);
        }
        this.typingTimeout = setTimeout(() => {
          this.typingTimeout = null;
          this.removeTypingAnimationExternal();
        }, 3000);
      },

      // Removes typing animation
      removeTypingAnimationExternal: function (name) {
        this.$chatHistoryList.find(".ui.grid.centered:last").remove();
      },

      scrollToBottom: function () {
        if (this.$chatHistory[0]) {
          this.$chatHistory.scrollTop(this.$chatHistory[0].scrollHeight);
        }
      },

      resetChat: function () {
        this.$chatHistoryList.empty();
      },
    };
    chat.init();
  });

  // Minimize chat box (toggle arrow direction)
  $(".chat-minimize, .chat-header").click(function (e) {
    e.stopImmediatePropagation();
    const $chat = $(this).closest(".chat");
    const $history = $chat.children(".chat-history");
    const $composer = $chat.children(".chat-message");
    const $icon = $chat.find(".chat-minimize");
    $history.add($composer).slideToggle(toggleAmount, "swing", function () {
      const isHidden = !$history.is(":visible") && !$composer.is(":visible");
      $icon
        .toggleClass("angle-down", !isHidden)
        .toggleClass("angle-up", isHidden);
    });
  });

  // Close chat box
  $(".chat-close").click(function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    $(".actor-chat .chat").transition("fade down");
  });

  // Start collapsed on page/level load
  const $chatBox = $(".actor-chat .chat");
  const $history = $chatBox.children(".chat-history");
  const $composer = $chatBox.children(".chat-message");
  const $icon = $chatBox.find(".chat-minimize");
  $history.hide();
  $composer.hide();
  $chatBox.removeClass("hidden").show(); // show header, keep content collapsed
  setChatArrow(false);
  setChatToggleState(false);
  $icon.removeClass("angle-down").addClass("angle-up");
});
