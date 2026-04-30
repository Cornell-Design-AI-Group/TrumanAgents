document.addEventListener("DOMContentLoaded", () => {
  const totalTime = 480;

  // Create the outer container
  const timerBarContainer = document.createElement("div");
  timerBarContainer.style.position = "fixed";
  timerBarContainer.style.bottom = "50px";
  timerBarContainer.style.left = "40px";
  timerBarContainer.style.width = "300px";
  timerBarContainer.style.height = "24px";
  timerBarContainer.style.backgroundColor = "transparent";
  timerBarContainer.style.zIndex = "1000";
  timerBarContainer.style.display = "flex";
  timerBarContainer.style.alignItems = "center";
  timerBarContainer.style.justifyContent = "flex-start";
  timerBarContainer.style.fontFamily = "monospace";
  timerBarContainer.style.fontSize = "0.9rem";
  timerBarContainer.style.color = "#fff";
  timerBarContainer.style.gap = "6px";

  // Crosshair icon (match objectives)
  const timerIcon = document.createElement("div");
  timerIcon.style.width = "18px";
  timerIcon.style.height = "18px";
  timerIcon.style.position = "relative";
  timerIcon.style.backgroundColor = "transparent";
  timerIcon.style.border = "1px solid rgba(255,255,255,0.5)";
  timerIcon.style.boxSizing = "border-box";

  const iconInner = document.createElement("div");
  iconInner.style.position = "absolute";
  iconInner.style.inset = "2px";
  iconInner.style.background =
    "linear-gradient(#cfd6de, #cfd6de) center top/2px 40% no-repeat," +
    "linear-gradient(#cfd6de, #cfd6de) center bottom/2px 40% no-repeat," +
    "linear-gradient(#cfd6de, #cfd6de) left center/40% 2px no-repeat," +
    "linear-gradient(#cfd6de, #cfd6de) right center/40% 2px no-repeat";
  const iconRing = document.createElement("div");
  iconRing.style.position = "absolute";
  iconRing.style.inset = "4px";
  iconRing.style.border = "1px solid #cfd6de";
  iconRing.style.borderRadius = "50%";
  timerIcon.appendChild(iconInner);
  timerIcon.appendChild(iconRing);

  // Progress bar wrapper (shorter bar)
  const barWrapper = document.createElement("div");
  barWrapper.style.flex = "1";
  barWrapper.style.height = "16px";
  barWrapper.style.background = "rgba(255,255,255,0.25)";
  barWrapper.style.border = "1px solid rgba(255,255,255,0.5)";
  barWrapper.style.boxSizing = "border-box";
  barWrapper.style.overflow = "hidden";
  barWrapper.style.position = "relative";

  // Create the fill portion
  const timerFill = document.createElement("div");
  timerFill.style.height = "100%";
  timerFill.style.backgroundColor = "#cfd6de";
  timerFill.style.transition = "width 1s linear";
  timerFill.style.width = "0%";

  // Create the text element inside the bar
  const timerText = document.createElement("div");
  timerText.style.position = "absolute";
  timerText.style.left = "6px";
  timerText.style.top = "50%";
  timerText.style.transform = "translateY(-50%)";
  timerText.style.color = "#fff";
  timerText.style.fontWeight = "600";
  timerText.textContent = "08:00";

  // Assemble bar
  barWrapper.appendChild(timerFill);
  barWrapper.appendChild(timerText);

  // Add all to DOM
  timerBarContainer.appendChild(timerIcon);
  timerBarContainer.appendChild(barWrapper);
  document.body.appendChild(timerBarContainer);

  function renderTimer(timeLeft, totalTime) {
    const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const seconds = String(timeLeft % 60).padStart(2, "0");
    timerText.textContent = `${minutes}:${seconds}`;

    const percent = Math.max(0, Math.min(1, timeLeft / totalTime));
    timerFill.style.width = `${percent * 100}%`;
    console.log(
      "Checking if win condition function exists:",
      typeof window.checkWinCondition === "function",
    );
    if (typeof window.checkWinCondition === "function") {
      console.log(
        "Checking win condition with score:",
        window.currentScore || 0,
        "and time left:",
        timeLeft,
      );
      window.checkWinCondition(window.currentScore || 0, timeLeft);
    }
  }

  const socketURL = window.location.origin;
  window.socket = window.socket || io(socketURL);

  let isTimerFrozen = false;

  window.freezeTimer = function () {
    isTimerFrozen = true;
  };

  window.unfreezeTimer = function () {
    isTimerFrozen = false;
  };

  socket.on("scoreUpdate", (allScores) => {
    if (isTimerFrozen) return;

    if (
      typeof allScores.timeLeft === "number" &&
      typeof allScores.totalTime === "number"
    ) {
      renderTimer(allScores.timeLeft, allScores.totalTime);
    }
  });

  window.resetTimer = function () {
    renderTimer(totalTime);
  };
});
