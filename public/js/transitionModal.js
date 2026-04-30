const levelStats = {
  1: "67% of adolescents and emerging adults (age 16-25) have experienced cyberbullying, such as hazing, offensive name-calling, purposeful embarrassment, physical threats, and sexual harassment",
  2: "This alarming prevalence of cyberbullying is concerning, because it is associated with young people's depression, self-harm, and even suicide attempts.",
  3: "Public, prosocial bystander interventions (e.g., bystanders confronting the bully, comforting the victim) can effectively reduce cyberbullying prevalence and mitigate its negative impact on victims.",
  4: "However, bystanders on social media tend to intervene indirectly (e.g., flag the abusive post), and often lack the knowledge of how to intervene publicly.",
  5: "As a result, the lack of bystander intervention often makes bad actors feel less inhibited to escalate abuse, causing a downward spiral of increasing toxicity and aggression on social media",
  // Add more levels and stats as needed
};

window.showTransitionPopup = function (
  result = "lose",
  //feedback = [],
  finalScore = null,
) {
  console.log("Showing transition popup:", result);

  const file =
    result === "win"
      ? "/public/js/win_screen.json"
      : "/public/js/lose_screen.json";

  fetch(file)
    .then((res) => res.json())
    .then((json) => {
      const root = json.contents.children;

      const modalOverlay = document.createElement("div");
      modalOverlay.style.position = "fixed";
      modalOverlay.style.top = 0;
      modalOverlay.style.left = 0;
      modalOverlay.style.width = "100vw";
      modalOverlay.style.height = "100vh";
      modalOverlay.style.backgroundColor = "rgba(0,0,0,0.6)";
      modalOverlay.style.display = "flex";
      modalOverlay.style.justifyContent = "center";
      modalOverlay.style.alignItems = "center";
      modalOverlay.style.zIndex = "9999";

      const modalBox = document.createElement("div");
      modalBox.style.backgroundColor = result === "lose" ? "#8b0000" : "#fff";
      modalBox.style.padding = "30px";
      modalBox.style.borderRadius = "15px";
      modalBox.style.color = "#fff";
      modalBox.style.width = "400px";
      modalBox.style.boxShadow = "0 0 20px rgba(0,0,0,0.5)";
      modalBox.style.textAlign = "center";
      modalBox.style.fontFamily = "monospace";

      if (result === "lose") {
        const title = document.createElement("h1");
        title.innerText = "You Failed";
        title.style.fontSize = "2em";
        modalBox.appendChild(title);

        // Score circle
        const scoreCircle = document.createElement("div");
        const scoreValue = finalScore ?? 0;
        console.log("Final score:", scoreValue);

        scoreCircle.innerHTML = `
          <svg viewBox="0 0 36 36" width="100" height="100" style="margin: 10px auto; display: block;">
            <path
              fill="none"
              stroke="#333"
              stroke-width="3.8"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              fill="none"
              stroke="#00ff00"
              stroke-width="2.8"
              stroke-dasharray="${scoreValue}, 100"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <text x="18" y="20.35" fill="#fff" font-size="6" text-anchor="middle">${scoreValue}</text>
          </svg>
        `;
        modalBox.appendChild(scoreCircle);

        // Statistic
        const stat = document.createElement("p");
        stat.style.marginTop = "20px";
        stat.style.fontStyle = "italic";
        stat.style.fontSize = "0.9em";
        stat.style.color = "#f0f0f0";

        const currentLevel = window.getCurrentLevel
          ? window.getCurrentLevel()
          : 1;
        stat.innerText =
          levelStats[currentLevel] ||
          "Keep going – each level teaches something new.";
        modalBox.appendChild(stat);

        // Button container
        const btnContainer = document.createElement("div");
        btnContainer.style.display = "flex";
        btnContainer.style.justifyContent = "center";
        btnContainer.style.gap = "20px";
        btnContainer.style.marginTop = "20px";

        // Retry button
        const retryBtn = document.createElement("button");
        retryBtn.innerText = "↻";
        retryBtn.title = "Retry level";
        retryBtn.style.fontSize = "1.5em";
        retryBtn.style.background = "none";
        retryBtn.style.color = "#fff";
        retryBtn.style.border = "2px solid #fff";
        retryBtn.style.borderRadius = "50%";
        retryBtn.style.padding = "10px 14px";
        retryBtn.style.cursor = "pointer";

        retryBtn.onclick = () => {
          const currentLevel = window.getCurrentLevel
            ? window.getCurrentLevel()
            : 1;
          window.resetScore?.();
          window.location.href = `/reset-level?level=${currentLevel}`;
        };

        // Next level button
        const nextBtn = document.createElement("button");
        nextBtn.innerText = "➔";
        nextBtn.title = "Skip to next level";
        nextBtn.style.fontSize = "1.5em";
        nextBtn.style.background = "none";
        nextBtn.style.color = "#fff";
        nextBtn.style.border = "2px solid #fff";
        nextBtn.style.borderRadius = "50%";
        nextBtn.style.padding = "10px 14px";
        nextBtn.style.cursor = "pointer";

        nextBtn.onclick = () => {
          window.goToNextLevel?.();
          window.resetScore?.();
        };

        // Add buttons to container
        btnContainer.appendChild(retryBtn);
        btnContainer.appendChild(nextBtn);

        modalBox.appendChild(btnContainer);
      } else {
        // Default win screen logic using JSON
        modalBox.style.backgroundColor = "#720000";
        modalBox.style.border = "5px solid #ab0909";

        const title = document.createElement("h1");
        title.innerText = "You Passed";
        title.style.color = "#fff";
        title.style.fontFamily = "'Courier New', monospace";
        title.style.fontSize = "3em";
        modalBox.appendChild(title);

        const stat = document.createElement("p");
        stat.style.marginTop = "20px";
        stat.style.fontStyle = "italic";
        stat.style.fontSize = "0.9em";
        stat.style.color = "#fff";
        stat.style.fontFamily = "monospace";

        const currentLevel = window.getCurrentLevel
          ? window.getCurrentLevel()
          : 1;
        stat.innerText =
          levelStats[currentLevel] || "Well done! Keep the momentum going.";

        modalBox.appendChild(stat);

        const arrowBtn = document.createElement("button");
        arrowBtn.innerText = "➔";
        arrowBtn.style.backgroundColor = "#fff";
        arrowBtn.style.color = "#b20000";
        arrowBtn.style.fontSize = "2em";
        arrowBtn.style.border = "none";
        arrowBtn.style.borderRadius = "50%";
        arrowBtn.style.width = "65px";
        arrowBtn.style.height = "65px";
        arrowBtn.style.cursor = "pointer";
        arrowBtn.onclick = () => {
          window.goToNextLevel();
          window.resetScore?.();
        };

        modalBox.appendChild(arrowBtn);
      }

      modalOverlay.appendChild(modalBox);
      document.body.appendChild(modalOverlay);
    });
};
