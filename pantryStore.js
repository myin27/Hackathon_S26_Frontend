// pantryStore.js
const PANTRY_KEY = "scan2serve_pantry_v1";

export function loadPantry() {
  try {
    const raw = localStorage.getItem(PANTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePantryFromRows(rows) {
  const existing = loadPantry();

  const map = new Map(
    existing.map(it => [normalizeName(it.itemName), it])
  );

  rows.forEach(r => {
    const key = normalizeName(r.itemName);
    if (!key) return;

    const prev = map.get(key);

    if (!prev) {
      map.set(key, {
        itemName: r.itemName,
        perishable: r.perishable,
        lastPrice: Number(r.price) || 0,
        timesSeen: 1,
        updatedAt: Date.now(),
      });
    } else {
      map.set(key, {
        ...prev,
        itemName: r.itemName,
        perishable: r.perishable ?? prev.perishable,
        lastPrice: Number(r.price) || prev.lastPrice,
        timesSeen: (prev.timesSeen || 1) + 1,
        updatedAt: Date.now(),
      });
    }
  });

  const merged = Array.from(map.values())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  localStorage.setItem(PANTRY_KEY, JSON.stringify(merged));
}

export function clearPantry() {
  localStorage.removeItem(PANTRY_KEY);
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function setPantry(items) {
  localStorage.setItem(PANTRY_KEY, JSON.stringify(items));
}

export function upsertPantryItem(item) {
  const items = loadPantry();
  const name = String(item?.itemName || "").trim();
  if (!name) return items;

  const key = normalizeName(name);
  const idx = items.findIndex(it => normalizeName(it.itemName) === key);

  const next = {
    itemName: name,
    perishable: item.perishable === "Yes" ? "Yes" : "No",
    lastPrice: Number(item.lastPrice || 0),
    timesSeen: Number(item.timesSeen || 1),
    updatedAt: Date.now(),
  };

  if (idx === -1) items.unshift(next);
  else items[idx] = { ...items[idx], ...next, updatedAt: Date.now() };

  setPantry(items);
  return items;
}

export function deletePantryItemByName(itemName) {
  const items = loadPantry();
  const key = normalizeName(itemName);
  const filtered = items.filter(it => normalizeName(it.itemName) !== key);
  setPantry(filtered);
  return filtered;
}
