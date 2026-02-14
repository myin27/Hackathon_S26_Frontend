import { savePantryFromRows } from "./pantryStore.js";


const input = document.getElementById("fileUpload");
const preview = document.getElementById("preview");
const resultEl = document.getElementById("result");

// Grab the FIRST table on index.html (your pantry table)
const table = document.querySelector(".data-table");
const tbody = table.querySelector("tbody");

// TODO: replace with your Lambda Function URL
const LAMBDA_URL = "https://xoit3b5ymnyfrfbpk7ix4hzjxy0hjbpm.lambda-url.us-east-1.on.aws/";
const API_KEY = "hackz_26";

// in-memory table state
let rows = []; // [{id,itemName,price,confidence,perishable,original,expanded,editing,snapshot}]

input.addEventListener("change", async () => {
  const file = input.files[0];
  if (!file) return;

  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";

  resultEl.textContent = "Uploading + extracting...";

  try {
    const base64 = await fileToBase64(file);

    const payload = {
      image_base64: base64,
      media_type: file.type || "image/jpeg",
    };

    const res = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    // Show debug JSON (optional)
    resultEl.textContent = JSON.stringify(data, null, 2);

    if (!res.ok || !data.ok) {
      throw new Error(data?.message || `Request failed (${res.status})`);
    }

    // ✅ Convert API response -> table rows -> save to "pantry" (localStorage)
    rows = toRows(data);
    renderTable();
    savePantryFromRows(rows);

  } catch (err) {
    console.error(err);
    resultEl.textContent = `Failed: ${err.message}`;
  }
});

function toRows(apiResponse) {
  const r = apiResponse?.result;
  const items = Array.isArray(r?.grocery_items) ? r.grocery_items : [];

  return items.map((it, idx) => ({
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + idx)),
    itemName: (it.expanded_name || it.original_name || "").trim(),
    price: toMoney(it.price),
    confidence: clampNumber(it.confidence, 0, 1),
    perishable: (it.perishable === true ? "Yes" : it.perishable === false ? "No" : guessPerishable(it.expanded_name || it.original_name || "")),
    original: it.original_name || "",
    expanded: it.expanded_name || "",
    editing: false,
    snapshot: null, // used for cancel
  }));
}

function renderTable() {
  tbody.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    if (!row.editing) {
      tr.innerHTML = `
        <td>${escapeHtml(row.itemName)}</td>
        <td class="num">$${row.price.toFixed(2)}</td>
        <td>
          <div class="conf">
            <div class="conf-bar">
              <div class="conf-fill" style="width:${Math.round(row.confidence * 100)}%"></div>
            </div>
            <div class="conf-num">${row.confidence.toFixed(2)}</div>
          </div>
        </td>
        <td>
          <span class="pill ${row.perishable === "Yes" ? "yes" : "no"}">${row.perishable}</span>
        </td>
        <td>
          <div class="btn-row">
            <button class="btn primary edit-btn" data-id="${row.id}">Edit</button>
          </div>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td>
          <input class="cell-input" data-field="itemName" data-id="${row.id}"
                 value="${escapeAttr(row.itemName)}">
          <div style="font-size:12px;opacity:.75;margin-top:4px;">
            Original: ${escapeHtml(row.original)}
          </div>
        </td>

        <td>
          <input class="cell-input" data-field="price" data-id="${row.id}"
                 value="${row.price}">
        </td>

        <td>
          <input class="cell-input" data-field="confidence" data-id="${row.id}"
                 value="${row.confidence}">
        </td>

        <td>
          <select data-field="perishable" data-id="${row.id}">
            <option value="Yes" ${row.perishable === "Yes" ? "selected" : ""}>Yes</option>
            <option value="No" ${row.perishable === "No" ? "selected" : ""}>No</option>
          </select>
        </td>

        <td>
          <div class="btn-row">
            <button class="btn primary save-btn" data-id="${row.id}">Save</button>
            <button class="btn danger remove-btn" data-id="${row.id}">Remove</button>
            <button class="btn cancel-btn" data-id="${row.id}">Cancel</button>
          </div>
        </td>
      `;
    }

    tbody.appendChild(tr);
  });
}


// Event delegation for Edit/Save/Remove/Cancel
document.addEventListener("click", (e) => {
  const btn = e.target;
  const id = btn?.dataset?.id;
  if (!id) return;

  if (btn.classList.contains("edit-btn")) {
    startEdit(id);
  } else if (btn.classList.contains("save-btn")) {
    saveEdit(id);
  } else if (btn.classList.contains("remove-btn")) {
    removeRow(id);
  } else if (btn.classList.contains("cancel-btn")) {
    cancelEdit(id);
  }
});

function startEdit(id) {
  rows = rows.map(r => {
    if (r.id !== id) return r;
    return {
      ...r,
      editing: true,
      snapshot: { ...r } // store old values for cancel
    };
  });
  renderTable();
}

function saveEdit(id) {
  // read inputs for that row
  const inputs = document.querySelectorAll(`[data-id="${CSS.escape(id)}"][data-field]`);
  const patch = {};
  inputs.forEach(el => patch[el.dataset.field] = el.value);

  rows = rows.map(r => {
    if (r.id !== id) return r;

    const newName = String(patch.itemName ?? r.itemName).trim();
    const newPrice = toMoney(patch.price);
    const newConf = clampNumber(patch.confidence, 0, 1);
    const newPerish = (patch.perishable === "Yes" || patch.perishable === "No") ? patch.perishable : r.perishable;

    return {
      ...r,
      itemName: newName,
      price: newPrice,
      confidence: newConf,
      perishable: newPerish,
      editing: false,
      snapshot: null
    };
  });

  renderTable();
  savePantryFromRows(rows);
}

function cancelEdit(id) {
  rows = rows.map(r => {
    if (r.id !== id) return r;
    // restore snapshot
    if (!r.snapshot) return { ...r, editing: false };
    const restored = r.snapshot;
    return {
      ...restored,
      editing: false,
      snapshot: null
    };
  });
  renderTable();
}

function removeRow(id) {
  rows = rows.filter(r => r.id !== id);
  renderTable();
  savePantryFromRows(rows);
}


// Helpers
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed"));
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = String(dataUrl).split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

function guessPerishable(name) {
  const s = String(name).toLowerCase();
  const perish = ["milk","yogurt","cheese","chicken","beef","fish","pork","eggs","lettuce","spinach","berries","produce","meat","seafood"];
  return perish.some(k => s.includes(k)) ? "Yes" : "No";
}

function toMoney(v) {
  if (v == null) return 0;

  // handle numbers directly
  if (typeof v === "number") return Math.max(0, Math.round(v * 100) / 100);

  // clean strings like "$3.98", " 3.98 ", "0.53-", etc.
  const s = String(v).trim();

  // remove everything except digits, dot, minus
  const cleaned = s.replace(/[^0-9.\-]/g, "");

  // some receipts have trailing minus meaning discount; you can decide policy
  // if you want to ignore negatives:
  const n = Number(cleaned);
  if (Number.isNaN(n)) return 0;

  return Math.max(0, Math.round(n * 100) / 100);
}


function clampNumber(v, min, max) {
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', "&quot;");
}