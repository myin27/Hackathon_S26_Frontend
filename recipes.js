import {
  loadPantry,
  clearPantry,
  setPantry,
  upsertPantryItem,
  deletePantryItemByName
} from "./pantryStore.js";

const tbody = document.querySelector("#pantryTable tbody");
const pantryCount = document.getElementById("pantryCount");
const clearBtn = document.getElementById("clearPantryBtn");
const exportBtn = document.getElementById("exportPantryBtn");

const newNameEl = document.getElementById("newItemName");
const newPerishEl = document.getElementById("newItemPerishable");
const addBtn = document.getElementById("addItemBtn");

let items = []; // in-memory copy for this page
let editingKey = null; // normalized name currently being edited

function normalizeName(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function render() {
  items = loadPantry();
  pantryCount.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
  tbody.innerHTML = "";

  if (!items.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3" style="padding:16px;opacity:.7;">No pantry items yet.</td>`;
    tbody.appendChild(tr);
    return;
  }

  items.forEach((it) => {
    const name = (it.itemName || "").trim();
    const perish = it.perishable === "Yes" ? "Yes" : "No";
    const key = normalizeName(name);

    const tr = document.createElement("tr");

    if (editingKey !== key) {
      tr.innerHTML = `
        <td>${escapeHtml(name)}</td>
        <td><span class="pill ${perish === "Yes" ? "yes" : "no"}">${perish}</span></td>
        <td>
          <div class="btn-row" style="justify-content:flex-start;">
            <button class="btn primary edit-item" data-key="${key}">Edit</button>
            <button class="btn danger delete-item" data-key="${key}">Delete</button>
          </div>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td>
          <input class="cell-input" data-field="itemName" data-key="${key}" value="${escapeAttr(name)}">
        </td>
        <td>
          <select data-field="perishable" data-key="${key}">
            <option value="Yes" ${perish === "Yes" ? "selected" : ""}>Perishable</option>
            <option value="No" ${perish === "No" ? "selected" : ""}>Non-perishable</option>
          </select>
        </td>
        <td>
          <div class="btn-row" style="justify-content:flex-start;">
            <button class="btn primary save-item" data-key="${key}">Save</button>
            <button class="btn cancel-item" data-key="${key}">Cancel</button>
          </div>
        </td>
      `;
    }

    tbody.appendChild(tr);
  });
}

addBtn.addEventListener("click", () => {
  const name = String(newNameEl.value || "").trim();
  const perishable = newPerishEl.value === "Yes" ? "Yes" : "No";
  if (!name) return;

  upsertPantryItem({ itemName: name, perishable });
  newNameEl.value = "";
  newPerishEl.value = "Yes";
  render();
});

document.addEventListener("click", (e) => {
  const el = e.target;

  const key = el?.dataset?.key;
  if (!key) return;

  if (el.classList.contains("edit-item")) {
    editingKey = key;
    render();
    return;
  }

  if (el.classList.contains("cancel-item")) {
    editingKey = null;
    render();
    return;
  }

  if (el.classList.contains("delete-item")) {
    const item = items.find(it => normalizeName(it.itemName) === key);
    if (!item) return;
    deletePantryItemByName(item.itemName);
    if (editingKey === key) editingKey = null;
    render();
    return;
  }

  if (el.classList.contains("save-item")) {
    const nameInput = document.querySelector(`input[data-key="${CSS.escape(key)}"][data-field="itemName"]`);
    const perSel = document.querySelector(`select[data-key="${CSS.escape(key)}"][data-field="perishable"]`);

    const newName = String(nameInput?.value || "").trim();
    const newPerish = perSel?.value === "Yes" ? "Yes" : "No";
    if (!newName) return;

    // If user renamed the item, delete old key then upsert new name
    const oldItem = items.find(it => normalizeName(it.itemName) === key);
    if (oldItem && normalizeName(oldItem.itemName) !== normalizeName(newName)) {
      deletePantryItemByName(oldItem.itemName);
    }

    upsertPantryItem({ itemName: newName, perishable: newPerish });
    editingKey = null;
    render();
  }
});

clearBtn.addEventListener("click", () => {
  clearPantry();
  editingKey = null;
  render();
});

exportBtn.addEventListener("click", () => {
  const pantry = loadPantry();
  const blob = new Blob([JSON.stringify(pantry, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "scan2serve_pantry.json";
  a.click();

  URL.revokeObjectURL(url);
});

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', "&quot;");
}

render();
