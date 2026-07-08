// IndexedDB レイヤー（端末ローカル完結・純テキストのみ）

const DB_NAME = "wine-app";
const DB_VERSION = 1;
let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("wines")) {
        const s = db.createObjectStore("wines", { keyPath: "id" });
        s.createIndex("name", "name");
      }
      if (!db.objectStoreNames.contains("tastings")) {
        const s = db.createObjectStore("tastings", { keyPath: "id" });
        s.createIndex("wine_id", "wine_id");
        s.createIndex("date", "date");
      }
      if (!db.objectStoreNames.contains("cellar")) {
        const s = db.createObjectStore("cellar", { keyPath: "id" });
        s.createIndex("wine_id", "wine_id");
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
  }));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const put = (store, obj) => tx(store, "readwrite", (s) => s.put(obj)).then(() => obj);
export const del = (store, id) => tx(store, "readwrite", (s) => s.delete(id));

export function get(store, id) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}

export function all(store) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export function byIndex(store, index, value) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).index(index).getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

// ---- settings ----
export async function getSetting(key, fallback = null) {
  const row = await get("settings", key);
  return row ? row.value : fallback;
}
export const setSetting = (key, value) => put("settings", { key, value });

// ---- export / import ----
export async function exportAll() {
  const [wines, tastings, cellar, settings] = await Promise.all(
    ["wines", "tastings", "cellar", "settings"].map(all)
  );
  // APIキーはエクスポートに含めない
  const safeSettings = settings.filter((s) => s.key !== "apiKey");
  return { format: "wine-app-v1", exported_at: new Date().toISOString(), wines, tastings, cellar, settings: safeSettings };
}

export async function importAll(data) {
  if (!data || data.format !== "wine-app-v1") throw new Error("形式が不正です（wine-app-v1 ではありません）");
  for (const store of ["wines", "tastings", "cellar", "settings"]) {
    for (const obj of data[store] || []) await put(store, obj);
  }
}
