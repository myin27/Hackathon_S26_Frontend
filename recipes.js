// recipes.js (module)
import { loadPantry, savePantry, clearPantry } from "./pantryStore.js";

// ✅ PUT YOUR CHAT LAMBDA URL HERE
const CHAT_LAMBDA_URL = "https://ycastrsgk5wkyfdhhq4quyle440ukazw.lambda-url.us-east-1.on.aws/";
const API_KEY = "hackz_26";

// DOM
const pantryBody = document.getElementById("pantryTableBody");
const clearPantryBtn = document.getElementById("clearPantryBtn");
const addName = document.getElementById("addName");
const addPerishable = document.getElementById("addPerishable");
const addItemBtn = document.getElementById("addItemBtn");

const chatWindow = document.getElementById("chatWindow");
const chatText = document.getElementById("chatText");
const chatSend = document.getElementById("chatSend");
const recipeResults = document.getElementById("recipeResults");

// state
let pantry = loadPantry();              // [{itemName, perishable, ...}]
let chat = [];                          // [{role:"user"|"assistant", content:"..."}]

// ---------- Pantry UI ----------
function renderPantry() {
  pantryBody.innerHTML = "";

  pantry.forEach((it, idx) => {
    const tr = document.createElement("tr");

    const name = it.itemName ?? "";
    const perish = it.perishable === true ? "Yes" : it.perishable === false ? "No" : (it.perishable || "No");

    tr.innerHTML = `
      <td>
        <input class="cell-input" data-field="itemName" data-idx="${idx}" value="${escapeAttr(name)}" />
      </td>
      <td>
        <select class="cell-input" data-field="perishable" data-idx="${idx}">
          <option value="Yes" ${perish === "Yes" ? "selected" : ""}>Yes</option>
          <option value="No" ${perish === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td>
  <div class="edit-dropdown">
    <button class="btn primary edit-toggle">
      Edit ▾
    </button>

    <div class="edit-menu">
      <button class="dropdown-item" data-action="save" data-idx="${idx}">
        Save
      </button>
      <button class="dropdown-item danger" data-action="delete" data-idx="${idx}">
        Delete
      </button>
    </div>
  </div>
</td>

    `;

    pantryBody.appendChild(tr);
  });
}

function persistPantry() {
  savePantry(pantry);
}

// Add item
addItemBtn.addEventListener("click", () => {
  const name = String(addName.value || "").trim();
  if (!name) return;

  pantry.unshift({
    itemName: name,
    perishable: addPerishable.value, // "Yes"|"No"
    updatedAt: Date.now(),
  });

  addName.value = "";
  persistPantry();
  renderPantry();
});

clearPantryBtn.addEventListener("click", () => {
  pantry = [];
  clearPantry();
  renderPantry();
});

// Save/Delete inside table (event delegation)
document.addEventListener("click", (e) => {
  const btn = e.target;
  const action = btn?.dataset?.action;
  if (!action) return;

  const idx = Number(btn.dataset.idx);
  if (Number.isNaN(idx)) return;

  if (action === "delete") {
    pantry.splice(idx, 1);
    persistPantry();
    renderPantry();
    return;
  }

  if (action === "save") {
    const nameEl = document.querySelector(`[data-field="itemName"][data-idx="${idx}"]`);
    const perishEl = document.querySelector(`[data-field="perishable"][data-idx="${idx}"]`);

    const newName = String(nameEl?.value || "").trim();
    const newPerish = perishEl?.value === "Yes" ? "Yes" : "No";

    if (!newName) return;

    pantry[idx] = {
      ...pantry[idx],
      itemName: newName,
      perishable: newPerish,
      updatedAt: Date.now(),
    };

    persistPantry();
    renderPantry();
  }
});

// ---------- Chat UI ----------
function renderChat() {
  chatWindow.innerHTML = "";
  chat.forEach(m => {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${m.role === "user" ? "user" : "assistant"}`;
    bubble.textContent = m.content;
    chatWindow.appendChild(bubble);
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderRecipes(recipes) {
  recipeResults.innerHTML = "";
  if (!Array.isArray(recipes) || recipes.length === 0) {
    recipeResults.innerHTML = `<div class="hint">No recipes returned yet.</div>`;
    return;
  }

  recipes.forEach(r => {
    const div = document.createElement("div");
    div.className = "recipe-card";
    const title = r.title || "Recipe";
    const why = r.why_fits || "";
    const missing = Array.isArray(r.missing) ? r.missing : [];
    const url = r.search_url || "";

    div.innerHTML = `
      <div class="recipe-title">${escapeHtml(title)}</div>
      <div class="hint">${escapeHtml(why)}</div>
      ${missing.length ? `<div class="missing"><b>Missing:</b> ${missing.map(escapeHtml).join(", ")}</div>` : ""}
      ${url ? `<a class="recipe-link" target="_blank" rel="noreferrer" href="${escapeAttr(url)}">Open search</a>` : ""}
    `;
    recipeResults.appendChild(div);
  });
}

async function sendChat() {
  const text = String(chatText.value || "").trim();
  if (!text) return;

  chatText.value = "";
  chat.push({ role: "user", content: text });
  renderChat();

  chatSend.disabled = true;
  chatSend.textContent = "…";

  try {
    // Always use the *latest* pantry from localStorage, not stale memory
    pantry = loadPantry();

    const payload = {
      messages: chat.slice(-20),  // keep short
      pantry: pantry.slice(0, 200),
      constraints: {},           // optional later
    };

    const res = await fetch(CHAT_LAMBDA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.message || `Request failed (${res.status})`);

    const result = data.result || {};
    const assistantMsg = result.assistant_message || "Got it.";
    chat.push({ role: "assistant", content: assistantMsg });
    renderChat();

    renderRecipes(result.recipes);

  } catch (err) {
    chat.push({ role: "assistant", content: `Error: ${err.message}` });
    renderChat();
  } finally {
    chatSend.disabled = false;
    chatSend.textContent = "Send";
  }
}

chatSend.addEventListener("click", sendChat);
chatText.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

// init
renderPantry();
renderChat();
renderRecipes([]);
  
// ---------- helpers ----------
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', "&quot;");
}
