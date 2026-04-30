let hintsUsed = new Set();

// remember per-objective expansion
const expandedObjectives = new Set(
  JSON.parse(localStorage.getItem("expandedObjectives") || "[]"),
);
function rememberExpanded(id, expanded) {
  if (expanded) expandedObjectives.add(id);
  else expandedObjectives.delete(id);
  localStorage.setItem(
    "expandedObjectives",
    JSON.stringify([...expandedObjectives]),
  );
}

async function loadObjectives(level) {
  if (window.victoryTriggered) return;
  try {
    const res = await fetch(`/api/objectives?level=${level}`);
    const objectives = await res.json();
    objectives.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Rebuild the panel
    const existing = document.querySelector(".checklist-panel");
    if (existing) existing.remove();

    const checklistPanel = document.createElement("div");
    checklistPanel.className = "checklist-panel";

    // ── Top-level collapsible header ("Objectives ▸/▾") ───────────────────────
    const PANEL_STORE_KEY = "objectivesPanelCollapsed";
    const isCollapsed = false; // always show checklist by default

    const header = document.createElement("div");
    header.className = "objectives-header";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.cursor = "pointer";
    header.tabIndex = 0;

    const panelArrow = document.createElement("span");
    panelArrow.className = "panel-arrow";
    panelArrow.textContent = isCollapsed ? "▸" : "▾";
    panelArrow.style.userSelect = "none";

    const title = document.createElement("h4");
    title.textContent = "OBJECTIVES";
    title.style.margin = 0;
    title.style.fontSize = "16px";

    header.appendChild(panelArrow);
    header.appendChild(title);
    checklistPanel.appendChild(header);

    const list = document.createElement("ul");
    list.id = "objectives-list";
    list.className = "checklist";
    list.style.marginTop = "8px";
    list.style.display = isCollapsed ? "none" : "block";

    function togglePanel() {
      const nowCollapsed = list.style.display !== "none";
      list.style.display = nowCollapsed ? "none" : "block";
      panelArrow.textContent = nowCollapsed ? "▸" : "▾";
      localStorage.setItem(PANEL_STORE_KEY, JSON.stringify(nowCollapsed));
    }
    header.addEventListener("click", togglePanel);
    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        togglePanel();
      }
    });

    checklistPanel.appendChild(list);

    // ── Objective rows (each with its own hint toggle) ───────────────────────
    let firstIncompleteMarked = false;
    for (let i = 0; i < objectives.length; i++) {
      const obj = objectives[i];
      const li = document.createElement("li");
      li.className = "objective-item";

      const id = obj._id || obj.label || String(i); // stable key for this row
      const isCompleted = !!obj.completed;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.disabled = true;
      checkbox.checked = isCompleted;

      const label = document.createElement("span");
      label.className = "objective-label";
      label.textContent = obj.label || "(Unnamed Objective)";

      const toggle = document.createElement("span");
      toggle.textContent = "▸";
      toggle.className = "dropdown-arrow";
      toggle.style.cursor = "pointer";
      toggle.style.userSelect = "none";
      toggle.title = "Show/Hide hint";

      const hint = document.createElement("div");
      hint.className = "objective-details";
      hint.textContent = obj.hint || "No hint available.";
      hint.style.display = "none";

      // Re-apply saved expansion state for this row
      if (expandedObjectives.has(id)) {
        hint.style.display = "block";
        toggle.textContent = "▾";
      }

      toggle.addEventListener("click", () => {
        const isVisible = hint.style.display === "block";
        hint.style.display = isVisible ? "none" : "block";
        toggle.textContent = isVisible ? "▸" : "▾";
        rememberExpanded(id, !isVisible); // persist user intent
      });

      const row = document.createElement("div");
      row.className = "objective-header";
      row.appendChild(checkbox);
      row.appendChild(toggle);
      if (isCompleted) {
        li.classList.add("completed");
      } else {
        li.classList.add("incomplete");
        if (!firstIncompleteMarked) {
          li.classList.add("first-incomplete");
          firstIncompleteMarked = true;
        }
      }

      row.appendChild(label);
      li.appendChild(row);
      li.appendChild(hint);
      list.appendChild(li);
    }

    const wrapper =
      document.getElementById("objectives-panel") || document.body;
    wrapper.appendChild(checklistPanel);
  } catch (err) {
    console.error("❌ Failed to load objectives:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const currentLevel = urlParams.get("level") || 1;
  loadObjectives(currentLevel);
});

window.loadObjectives = loadObjectives;

window.resetObjectives = function () {
  if (!Array.isArray(window.objectives)) return;

  window.objectives.forEach((obj) => (obj.completed = false));

  document.querySelectorAll(".objective").forEach((el) => {
    el.classList.remove("completed");
  });

  console.log("🧹 Objectives reset.");
};
