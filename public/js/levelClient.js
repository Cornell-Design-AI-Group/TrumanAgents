// /public/js/levelClient.js (browser only)

// Socket bootstrap
const socketURL = window.location.origin;
window.socket = window.socket || io(socketURL);

// --- Level read/write helpers ---
function readLevelFromCarrier() {
  const el = document.getElementById("level-carrier");
  const v = el && Number(el.getAttribute("data-level"));
  return Number.isFinite(v) && v > 0 ? v : null;
}
function readLevelFromUrl() {
  const v = Number(new URLSearchParams(location.search).get("level"));
  return Number.isFinite(v) && v > 0 ? v : null;
}
function computeInitialLevel() {
  return readLevelFromCarrier() ?? readLevelFromUrl() ?? 1;
}

let currentLevel = computeInitialLevel();
writeLevel(currentLevel);

function writeLevel(lvl) {
  const el = document.getElementById("level-carrier");
  if (el) el.setAttribute("data-level", String(lvl));
  window.__LEVEL__ = lvl;
}

function setLevel(lvl) {
  const n = Number(lvl);
  if (!Number.isFinite(n) || n <= 0) return;
  currentLevel = n;
  writeLevel(n);
  // notify server so it can persist per-user level
  if (window.socket) {
    window.socket.emit("levelChanged", { level: n });
  }
}

// --- Public getter ---
window.getCurrentLevel = function () {
  return currentLevel;
};

// --- Navigation / level control (preserved functionality) ---
window.goToNextLevel = function () {
  const nextLevel = currentLevel + 1;

  // Notify server BEFORE redirecting
  window.socket.emit("levelChanged", { level: nextLevel });
  window.resetScore?.();
  window.resetObjectives?.();

  setLevel(nextLevel); // keep DOM/global in sync immediately

  // Keep your existing URL contract so server renders the right level
  window.location.href = `/feed?level=${nextLevel}`;
};

window.retryLevel = function () {
  const lvl = window.getCurrentLevel();
  window.socket.emit("resetLevel", { level: lvl });
  console.log("🔄 Level reset requested via socket.");
  setTimeout(() => {
    window.location.href = `/feed?level=${lvl}`;
  }, 300);
};

// --- Objectives wiring (unchanged behavior) ---
window.fetchAndRenderObjectives = async function () {
  const lvl = window.getCurrentLevel();
  try {
    const res = await fetch(`/api/objectives?level=${lvl}`);
    await res.json(); // we don't use it here because loadObjectives fetches/render itself
    window.loadObjectives?.(lvl);
  } catch (err) {
    console.error("Failed to load objectives:", err);
  }
};

// Initial objectives load (+ light refresh hooks)
function refreshObjectives() {
  window.fetchAndRenderObjectives?.();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", refreshObjectives, {
    once: true,
  });
} else {
  refreshObjectives();
}
window.addEventListener("level:changed", refreshObjectives);
window.addEventListener("objectives:changed", refreshObjectives);
window.addEventListener("pageshow", (e) => {
  if (e.persisted) refreshObjectives();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshObjectives();
});

// --- Win condition logic (preserved) ---
window.checkWinCondition = async function (score, remainingTime) {
  await window.fetchAndRenderObjectives();
  console.log("Checking win condition for level", currentLevel);

  if (score < 100 && remainingTime > 0) {
    console.log("⏸️ Not ready to win yet.");
    return;
  }

  if (currentLevel == 1 && score == 100) {
    console.log("Level 1 complete!");
    window.freezeScore?.();
    window.freezeTimer?.();
    showBullyingPopup();
  } else if (currentLevel == 2 && score >= 51) {
    console.log("Level 2 complete!");
    window.freezeScore?.();
    window.freezeTimer?.();
    showBullyingPopup();
  } else if (score >= 80) {
    console.log("Level complete!");
    window.freezeScore?.();
    window.freezeTimer?.();
    showBullyingPopup();
  } else if (remainingTime <= 0) {
    window.freezeScore?.();
    window.freezeTimer?.();
    console.log("Time's up! Checking for win condition.");
    window.showTransitionPopup("lose", score);
  }
};

// --- Bullying review popup (preserved) ---
function showBullyingPopup() {
  const popup = document.createElement("div");
  popup.id = "bullyingPopup";
  popup.style.position = "fixed";
  popup.style.bottom = "20px";
  popup.style.left = "50%";
  popup.style.transform = "translateX(-50%)";
  popup.style.background = "#ffdddd";
  popup.style.padding = "20px";
  popup.style.border = "1px solid #ff0000";
  popup.style.borderRadius = "10px";
  popup.style.zIndex = "9999";
  popup.innerHTML = `
    <strong>🎯 Great job!</strong><br>
    Before completing this level, please review the bullying post.<br><br>
    <button id="reviewBullyingBtn" class="ui red button">Review Now</button>
  `;
  document.body.appendChild(popup);

  document
    .getElementById("reviewBullyingBtn")
    .addEventListener("click", async () => {
      popup.remove();
      try {
        const res = await fetch(
          `/api/bullying-post?level=${window.getCurrentLevel()}`,
        );
        const { bullyingPostId } = await res.json();
        if (!bullyingPostId) throw new Error("No bullying post ID");

        const bullyingPost = document.querySelector(
          `[postid="${bullyingPostId}"]`,
        );
        if (bullyingPost) {
          bullyingPost.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            window.showTransitionPopup("win");
          }, 10000);
        } else {
          console.warn("⚠️ Bullying post not found in DOM. Completing anyway.");
          window.showTransitionPopup("win");
        }
      } catch (err) {
        console.error("❌ Failed to load bullying post:", err);
        window.showTransitionPopup("win");
      }
    });
}

// --- Keyboard shortcut (preserved) ---
document.addEventListener("keydown", function (e) {
  if (e.key === "r" || e.key === "R") {
    const a = document.activeElement;
    const isTyping =
      a &&
      (a.tagName === "INPUT" ||
        a.tagName === "TEXTAREA" ||
        a.isContentEditable);

    if (!isTyping) {
      const confirmReset = confirm(
        "🔁 Are you sure you want to restart this level?",
      );
      if (confirmReset) {
        const currentLevel =
          typeof window.getCurrentLevel === "function"
            ? window.getCurrentLevel()
            : 1;
        window.resetScore?.();
        window.location.href = `/reset-level?level=${currentLevel}`;
      }
    }
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "n" || e.key === "N") {
    const a = document.activeElement;
    const isTyping =
      a &&
      (a.tagName === "INPUT" ||
        a.tagName === "TEXTAREA" ||
        a.isContentEditable);

    if (!isTyping) {
      const confirmNext = confirm(
        "➡️ Do you want to move onto the next level?",
      );
      if (confirmNext) {
        window.goToNextLevel?.();
        window.resetScore?.();
      }
    }
  }
});

window.socket.on("objectiveFeedback", ({ unmatchedReasons }) => {
  if (!unmatchedReasons) return;
  const [category, reason] = Object.entries(unmatchedReasons)[0] || [];
  console.log("✅ Objective feedback received:", category, reason);
  if (category && reason) showObjectiveFeedbackPopup(category, reason);
});

function showObjectiveFeedbackPopup(category, reason) {
  const old = document.getElementById("objective-feedback-popup");
  if (old) old.remove();

  const popup = document.createElement("div");
  popup.id = "objective-feedback-popup";
  popup.style.position = "fixed";
  popup.style.bottom = "30px";
  popup.style.left = "50%";
  popup.style.transform = "translateX(-50%)";
  popup.style.maxWidth = "400px";
  popup.style.padding = "20px";
  popup.style.backgroundColor = "#ffe0e0";
  popup.style.border = "2px solid #ff0000";
  popup.style.borderRadius = "10px";
  popup.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
  popup.style.zIndex = "10000";
  popup.style.fontFamily = "sans-serif";

  popup.innerHTML = `
    <strong>Objective Feedback</strong><br>
    <em>${category}</em><br>
    ${reason}
    <div style="margin-top:10px;text-align:right;">
      <button id="closeFeedbackBtn" style="
        background: #ff5555;
        border: none;
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        cursor: pointer;">Dismiss</button>
    </div>
  `;

  document.body.appendChild(popup);
  document.getElementById("closeFeedbackBtn").onclick = () => popup.remove();
}
