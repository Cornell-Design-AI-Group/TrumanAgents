document.addEventListener("DOMContentLoaded", () => {
  const scoreAudio = new Audio("/public/sounds/score-up.mp3");
  scoreAudio.volume = 0.3; // soft, not intrusive

  const MAX_SCORE = 100;
  const SEGMENTS = 10;

  const scoreContainer = document.createElement("div");
  Object.assign(scoreContainer.style, {
    position: "fixed",
    bottom: "80px",
    left: "40px",
    zIndex: "1000",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  });

  const peopleBar = document.createElement("div");
  Object.assign(peopleBar.style, {
    display: "flex",
    gap: "6px",
  });

  const fillRects = [];

  for (let i = 0; i < SEGMENTS; i++) {
    const svgNS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "48");
    svg.setAttribute("viewBox", "0 0 24 48");
    svg.style.display = "block";
    svg.style.overflow = "visible";

    // Define clip path (moving fill block)
    const clipId = `clip-${i}`;
    const defs = document.createElementNS(svgNS, "defs");
    const clipPath = document.createElementNS(svgNS, "clipPath");
    clipPath.setAttribute("id", clipId);
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", "24");
    rect.setAttribute("height", "48");
    clipPath.appendChild(rect);
    defs.appendChild(clipPath);
    svg.appendChild(defs);
    fillRects.push(rect);

    // Filled shape (background fill color)
    const bodyFill = document.createElementNS(svgNS, "path");
    bodyFill.setAttribute(
      "d",
      "M12 2c1.6 0 3 1.4 3 3s-1.4 3-3 3-3-1.4-3-3 1.4-3 3-3zm-4 9h8l1 4v10h-2v12h-2V25h-2v12H9V25H7V15l1-4z",
    );
    bodyFill.setAttribute("fill", "#ffffff");
    bodyFill.setAttribute("clip-path", `url(#${clipId})`);

    // Outline path (always visible)
    const outline = document.createElementNS(svgNS, "path");
    outline.setAttribute(
      "d",
      "M12 2c1.6 0 3 1.4 3 3s-1.4 3-3 3-3-1.4-3-3 1.4-3 3-3zm-4 9h8l1 4v10h-2v12h-2V25h-2v12H9V25H7V15l1-4z",
    );
    outline.setAttribute("fill", "none");
    outline.setAttribute("stroke", "#ffffff");
    outline.setAttribute("stroke-width", "1.5");

    svg.appendChild(bodyFill);
    svg.appendChild(outline);
    peopleBar.appendChild(svg);
  }

  scoreContainer.appendChild(peopleBar);
  document.body.appendChild(scoreContainer);

  window.currentScore = parseInt(sessionStorage.getItem("currentScore")) || 0;

  window.updateScore = function (score) {
    const clamped = Math.max(0, Math.min(100, score));
    if (clamped !== window.currentScore) {
      // Play sound only when score changes
      scoreAudio.currentTime = 0;
      scoreAudio.play();
    }

    window.currentScore = clamped;
    console.log("Updating score:", clamped);
    sessionStorage.setItem("currentScore", clamped);

    const segmentsToEmpty = Math.floor((clamped / MAX_SCORE) * SEGMENTS);

    for (let i = 0; i < SEGMENTS; i++) {
      fillRects[i].setAttribute(
        "height",
        i < SEGMENTS - segmentsToEmpty ? "48" : "0",
      );
    }

    if (
      typeof window.getLevelThreshold === "function" &&
      typeof window.increaseLevel === "function" &&
      clamped >= window.getLevelThreshold(window.currentLevel || 1)
    ) {
      window.increaseLevel();
    }
  };

  window.freezeScore = function () {
    window.levelOver = true;
    console.log(
      "Score freezing enabled. No further updates will be processed.",
    );
  };

  const socketURL = window.location.origin;
  window.socket = window.socket || io(socketURL);

  window.resetScore = function () {
    window.currentScore = 0;
    sessionStorage.setItem("currentScore", "0");

    window.socket.emit("resetScore");
  };

  socket.on("scoreUpdate", (allScores) => {
    /*if (
      typeof window.currentScore !== "number" ||
      isNaN(window.currentScore) ||
      allScores.healthScore !== window.currentScore
    ) {
      console.log("Initializing score:", allScores.healthScore);
      if (!window.levelOver) window.updateScore(allScores.healthScore);
    }*/
    if (typeof allScores.healthScore === "number") {
      console.log("Updating score from socket:", allScores.healthScore);
      window.updateScore(allScores.healthScore);
    }
    console.log("is function:", typeof window.loadObjectives);
    if (typeof window.loadObjectives === "function") {
      console.log("Loading objectives for level:", allScores.level);
      const urlParams = new URLSearchParams(window.location.search);
      const currentLevel = urlParams.get("level") || 1;
      window.loadObjectives(currentLevel);
    }
  });
});
