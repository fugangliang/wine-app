// ワイン記録・照会PWA — UI本体（ハッシュルーティングSPA）

import { SAT, SPARKLING, FAULTS, FAULT_LEVELS, LEXICON } from "./lexicon.js";
import { DICT_JA } from "./dict-ja.js";
import * as db from "./db.js";
import * as api from "./api.js";

const $ = (sel) => document.querySelector(sel);
const app = () => $("#app");

// ---- 設定キャッシュ ----
const S = { dict: { ...DICT_JA }, showEn: false, autoFallback: true, whitelist: api.DEFAULT_WHITELIST, aromaFreq: {} };

async function loadSettings() {
  const overrides = await db.getSetting("dictOverrides", {});
  S.dict = { ...DICT_JA, ...overrides };
  S.showEn = await db.getSetting("showEnKeys", false);
  S.autoFallback = await db.getSetting("autoFallback", true);
  S.whitelist = await db.getSetting("whitelist", api.DEFAULT_WHITELIST);
  S.aromaFreq = await db.getSetting("aromaFreq", {});
}

// ---- 表示ヘルパー ----
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const label = (key) => {
  if (key == null || key === "") return "";
  const ja = S.dict[key] || key;
  return S.showEn && S.dict[key] ? `${ja} (${key})` : ja;
};
const fmtDate = (iso) => (iso || "").slice(0, 10);

// ---- 編集中フォーム状態 ----
let F = null; // tasting編集バッファ

// =====================================================================
// ルーティング
// =====================================================================
const routes = [
  [/^#\/wine\/(.+)$/, (m) => viewWine(m[1])],
  [/^#\/tasting\/(.+)$/, (m) => viewTasting(m[1])],
  [/^#\/cellar$/, viewCellar],
  [/^#\/search$/, viewSearch],
  [/^#\/scan$/, viewScan],
  [/^#\/settings$/, viewSettings],
  [/^.*$/, viewHome],
];

async function render() {
  const hash = location.hash || "#/";
  for (const [re, fn] of routes) {
    const m = hash.match(re);
    if (m) { await fn(m); break; }
  }
  document.querySelectorAll(".nav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === hash || (a.getAttribute("href") === "#/" && !hash.match(/^#\/(cellar|search|scan|settings)/)));
  });
}

// =====================================================================
// ホーム（記録一覧 + クイック入力）(§4.4)
// =====================================================================
async function viewHome() {
  const [tastings, wines] = await Promise.all([db.all("tastings"), db.all("wines")]);
  const wmap = Object.fromEntries(wines.map((w) => [w.id, w]));
  tastings.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  app().innerHTML = `
    <section class="card">
      <h2>クイック入力</h2>
      <input id="q-name" list="wine-names" placeholder="ワイン名（必須・これだけで保存可）">
      <datalist id="wine-names">${wines.map((w) => `<option value="${esc(w.name)}">`).join("")}</datalist>
      <div class="row">
        <input id="q-place" placeholder="場所・店名（任意）">
        <input id="q-memo" placeholder="一言メモ（任意）">
      </div>
      <button class="primary" data-action="quick-save">保存（下書き）</button>
    </section>
    <section>
      <h2>テイスティング記録</h2>
      ${tastings.length === 0 ? '<p class="muted">記録はまだありません。</p>' : ""}
      ${tastings.map((t) => {
        const w = wmap[t.wine_id];
        const faults = (t.faults || []).map((f) => `<span class="badge fault">${esc(label(f.key))}</span>`).join("");
        return `<a class="list-item" href="#/tasting/${t.id}">
          <div>
            <div class="li-title">${esc(w ? w.name : "?")} ${t.vintage ? `<span class="muted">${esc(t.vintage)}</span>` : ""}</div>
            <div class="li-sub">${fmtDate(t.date)} ${t.context?.place ? "・" + esc(t.context.place) : ""} ${faults}</div>
          </div>
          ${t.draft ? '<span class="badge draft">下書き</span>' : ""}
        </a>`;
      }).join("")}
    </section>`;
}

async function quickSave() {
  const name = $("#q-name").value.trim();
  if (!name) return alert("ワイン名を入力してください");
  const wine = await findOrCreateWine(name);
  const t = {
    id: db.uid(), wine_id: wine.id, vintage: null,
    date: new Date().toISOString().slice(0, 10),
    sat: {}, sparkling: {}, faults: [],
    context: { place: $("#q-place").value.trim() || null, companions: [] },
    comment: $("#q-memo").value.trim() || null,
    draft: true, created_at: new Date().toISOString(),
  };
  await db.put("tastings", t);
  location.hash = "#/";
  render();
}

async function findOrCreateWine(name, extra = {}) {
  const wines = await db.all("wines");
  const hit = wines.find((w) => w.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit;
  const wine = { id: db.uid(), name, producer: extra.producer || null, region: null, variety: null, type: extra.type || null, dossier: null, created_at: new Date().toISOString() };
  await db.put("wines", wine);
  return wine;
}

// =====================================================================
// テイスティング記録（構造化追記 = SATフォーム）(§4.1-4.4)
// =====================================================================
async function viewTasting(id) {
  const t = await db.get("tastings", id);
  if (!t) { location.hash = "#/"; return; }
  const wine = await db.get("wines", t.wine_id);
  const cellarItems = await db.byIndex("cellar", "wine_id", t.wine_id);
  const hasStock = cellarItems.some((c) => c.count > 0);
  F = JSON.parse(JSON.stringify(t)); // 編集バッファ
  F.sat = F.sat || {}; F.sparkling = F.sparkling || {}; F.faults = F.faults || [];
  F.context = F.context || { place: null, companions: [] };

  const allTastings = await db.all("tastings");
  const companionPool = [...new Set(allTastings.flatMap((x) => x.context?.companions || []))];

  const type = wine.type || "red";
  const colourOpts = SAT.appearance.colour[type] || SAT.appearance.colour.red;

  app().innerHTML = `
    <div class="topbar"><a href="#/">←</a><h2>${esc(wine.name)}</h2>${F.draft ? '<span class="badge draft">下書き</span>' : ""}</div>
    <section class="card">
      <h3>基本情報</h3>
      <div class="row">
        <label>ヴィンテージ<input id="t-vintage" inputmode="numeric" value="${esc(F.vintage ?? "")}" placeholder="NVは空欄"></label>
        <label>飲用日<input id="t-date" type="date" value="${esc(F.date || "")}"></label>
      </div>
      <label>タイプ ${chipGroup("wine-type", ["red", "white", "rose", "sparkling", "fortified"], type, false)}</label>
      <div class="row">
        <label>生産者<input id="w-producer" value="${esc(wine.producer ?? "")}"></label>
        <label>産地<input id="w-region" value="${esc(wine.region ?? "")}"></label>
      </div>
      <label>品種<input id="w-variety" value="${esc(wine.variety ?? "")}"></label>
      ${hasStock ? '<label class="check"><input type="checkbox" id="t-consume"> セラーから1本消費する</label>' : ""}
    </section>

    <section class="card">
      <h3>Appearance</h3>
      ${satRow("appearance", "clarity", SAT.appearance.clarity)}
      ${satRow("appearance", "intensity", SAT.appearance.intensity)}
      <div class="sat-row"><span class="sat-label">colour</span>${chipGroup("sat:appearance.colour", colourOpts, F.sat.appearance?.colour)}</div>
    </section>

    <section class="card">
      <h3>Nose</h3>
      ${satRow("nose", "condition", SAT.nose.condition)}
      <p id="unclean-hint" class="warn" style="display:${F.sat.nose?.condition === "unclean" ? "block" : "none"}">condition = unclean：下の劣化チェックリストを確認してください。</p>
      ${satRow("nose", "intensity", SAT.nose.intensity)}
      ${aromaPicker("nose_aromas", "aroma characteristics")}
      ${satRow("nose", "development", SAT.nose.development)}
    </section>

    <section class="card">
      <h3>Palate</h3>
      ${["sweetness", "acidity", "tannin", "alcohol", "body", "flavour_intensity"].map((k) => satRow("palate", k, SAT.palate[k])).join("")}
      ${aromaPicker("palate_flavours", "flavour characteristics")}
      ${satRow("palate", "finish", SAT.palate.finish)}
    </section>

    <section class="card" id="sparkling-section" style="display:${type === "sparkling" ? "block" : "none"}">
      <h3>スパークリング拡張</h3>
      ${Object.entries(SPARKLING).map(([k, opts]) => `<div class="sat-row"><span class="sat-label">${k.replace(/_/g, " ")}</span>${chipGroup("spk:" + k, opts, F.sparkling?.[k])}</div>`).join("")}
    </section>

    <section class="card">
      <h3>劣化チェックリスト</h3>
      ${FAULTS.map((f) => {
        const cur = F.faults.find((x) => x.key === f);
        return `<div class="sat-row"><span class="sat-label">${esc(label(f))}</span>
          <div class="chips">${FAULT_LEVELS.map((lv) => `<button class="chip ${cur?.level === lv ? "on" : ""}" data-action="fault" data-key="${f}" data-level="${lv}">${esc(label(lv))}</button>`).join("")}</div></div>`;
      }).join("")}
    </section>

    <section class="card">
      <h3>Conclusions</h3>
      ${satRow("conclusions", "quality", SAT.conclusions.quality)}
      ${satRow("conclusions", "readiness", SAT.conclusions.readiness)}
    </section>

    <section class="card">
      <h3>コンテキスト・コメント</h3>
      <label>場所・店名<input id="t-place" value="${esc(F.context.place ?? "")}"></label>
      <label>同席者</label>
      <div class="chips" id="companion-chips">
        ${companionPool.map((c) => `<button class="chip ${F.context.companions.includes(c) ? "on" : ""}" data-action="companion" data-name="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>
      <div class="row"><input id="t-companion-new" placeholder="同席者を追加"><button data-action="companion-add">追加</button></div>
      <label>自由コメント<textarea id="t-comment" rows="4">${esc(F.comment ?? "")}</textarea></label>
    </section>

    <div class="actions">
      <button class="primary" data-action="tasting-save">保存</button>
      <a class="button" href="#/wine/${wine.id}">ワイン詳細・照会</a>
      <button class="danger" data-action="tasting-delete" data-id="${t.id}">削除</button>
    </div>`;
}

function satRow(section, key, opts) {
  const cur = F.sat?.[section]?.[key];
  return `<div class="sat-row"><span class="sat-label">${key.replace(/_/g, " ")}</span>${chipGroup(`sat:${section}.${key}`, opts, cur)}</div>`;
}

function chipGroup(field, opts, current) {
  return `<div class="chips">${opts.map((o) => `<button class="chip ${current === o ? "on" : ""}" data-action="chip" data-field="${field}" data-value="${o}">${esc(label(o))}</button>`).join("")}</div>`;
}

function aromaPicker(field, title) {
  const selected = F[field] || [];
  const sortKeys = (keys) => [...keys].sort((a, b) => (S.aromaFreq[b] || 0) - (S.aromaFreq[a] || 0));
  return `<div class="aroma"><span class="sat-label">${title}</span>
    <div class="selected-aromas">${selected.map((k) => `<button class="chip on" data-action="aroma" data-field="${field}" data-key="${k}">${esc(label(k))} ×</button>`).join("") || '<span class="muted">未選択</span>'}</div>
    ${LEXICON.map((c) => `
      <details><summary>${esc(label(c.cluster))} <span class="muted">${c.tier === 1 ? "1st" : c.tier === 2 ? "2nd" : "3rd"}</span></summary>
        <div class="chips">${sortKeys(c.keys).map((k) => `<button class="chip ${selected.includes(k) ? "on" : ""}" data-action="aroma" data-field="${field}" data-key="${k}">${esc(label(k))}</button>`).join("")}</div>
      </details>`).join("")}
  </div>`;
}

function setDeep(obj, path, value) {
  const parts = path.split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] = o[parts[i]] || {};
  const last = parts[parts.length - 1];
  o[last] = o[last] === value ? null : value; // 再タップで解除
}

async function tastingSave() {
  const t = F;
  t.vintage = $("#t-vintage").value.trim() || null;
  t.date = $("#t-date").value || t.date;
  t.context.place = $("#t-place").value.trim() || null;
  t.comment = $("#t-comment").value.trim() || null;
  // SATの主要項目がひとつでも入っていれば下書き解除
  const hasSat = t.sat && Object.values(t.sat).some((sec) => sec && Object.values(sec).some((v) => v));
  t.draft = !hasSat;
  // 頻度学習
  for (const k of [...(t.nose_aromas || []), ...(t.palate_flavours || [])]) S.aromaFreq[k] = (S.aromaFreq[k] || 0) + 1;
  await db.setSetting("aromaFreq", S.aromaFreq);
  // ワイン側の更新
  const wine = await db.get("wines", t.wine_id);
  wine.producer = $("#w-producer").value.trim() || null;
  wine.region = $("#w-region").value.trim() || null;
  wine.variety = $("#w-variety").value.trim() || null;
  const typeChip = document.querySelector('[data-field="wine-type"].on');
  if (typeChip) wine.type = typeChip.dataset.value;
  await db.put("wines", wine);
  // セラー消費
  if ($("#t-consume")?.checked) {
    const items = (await db.byIndex("cellar", "wine_id", t.wine_id)).filter((c) => c.count > 0);
    const match = items.find((c) => String(c.vintage || "") === String(t.vintage || "")) || items[0];
    if (match) { match.count -= 1; await db.put("cellar", match); }
  }
  await db.put("tastings", t);
  F = null;
  location.hash = "#/";
}

// =====================================================================
// ワイン詳細（ドシエ + タイムライン）(F2, F5)
// =====================================================================
async function viewWine(id) {
  const wine = await db.get("wines", id);
  if (!wine) { location.hash = "#/"; return; }
  const tastings = (await db.byIndex("tastings", "wine_id", id)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const cellarItems = await db.byIndex("cellar", "wine_id", id);
  const d = wine.dossier;

  app().innerHTML = `
    <div class="topbar"><a href="#/">←</a><h2>${esc(wine.name)}</h2></div>
    <section class="card">
      <div class="li-sub">${[wine.producer, wine.region, wine.variety, wine.type ? label(wine.type) : null].filter(Boolean).map(esc).join(" ・ ")}</div>
      ${cellarItems.filter((c) => c.count > 0).map((c) => `<span class="badge">在庫 ${esc(c.vintage || "NV")} × ${c.count}</span>`).join(" ")}
    </section>

    <section class="card">
      <h3>ドシエ（照会）</h3>
      ${d ? `
        <div class="li-sub">生成: ${fmtDate(d.generated_at)} ・ 信頼度: ${esc(d.confidence)}</div>
        <div class="dossier">${mdToHtml(d.text)}</div>
        ${d.fallback_text ? `<div class="dossier fallback">${mdToHtml(d.fallback_text)}</div>` : ""}
        <details><summary>出典 (${(d.sources || []).length})</summary><ul>${(d.sources || []).map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join("")}</ul></details>
      ` : '<p class="muted">未生成。</p>'}
      <div class="row">
        <input id="dossier-vintage" inputmode="numeric" placeholder="ヴィンテージ指定（任意）" value="${esc(tastings[0]?.vintage ?? "")}">
        <button class="primary" data-action="dossier" data-id="${id}">${d ? "更新" : "照会（ドシエ生成）"}</button>
      </div>
      ${d && d.text.includes("不明") ? `<button data-action="dossier-fallback" data-id="${id}">不明項目をホワイトリスト外検索で補完</button>` : ""}
      <p id="dossier-status" class="muted"></p>
    </section>

    <section class="card">
      <h3>タイムライン（飲用・フォールト履歴）</h3>
      ${tastings.length === 0 ? '<p class="muted">記録なし。</p>' : ""}
      ${tastings.map((t) => `
        <a class="list-item" href="#/tasting/${t.id}">
          <div>
            <div class="li-title">${fmtDate(t.date)} ${t.vintage ? `VT${esc(t.vintage)}` : "NV"}</div>
            <div class="li-sub">
              ${t.sat?.conclusions?.quality ? `<span class="badge">${esc(label(t.sat.conclusions.quality))}</span>` : ""}
              ${(t.faults || []).map((f) => `<span class="badge fault">${esc(label(f.key))}:${esc(label(f.level))}</span>`).join("")}
              ${esc(t.comment || "")}
            </div>
          </div>
          ${t.draft ? '<span class="badge draft">下書き</span>' : ""}
        </a>`).join("")}
      <button data-action="tasting-new" data-wine="${id}">この銘柄で記録作成</button>
    </section>`;
}

async function runDossier(wineId) {
  const wine = await db.get("wines", wineId);
  const status = $("#dossier-status");
  const vintage = $("#dossier-vintage").value.trim() || null;
  try {
    status.textContent = "Step 1/3: 公式ドメイン特定中…";
    const domain = await api.findOfficialDomain(wine.producer, wine.name);
    status.textContent = `Step 2/3: 本照会中…（公式: ${domain || "未特定"}）`;
    const { text, sources } = await api.generateDossier({
      name: wine.name, producer: wine.producer, vintage, type: wine.type,
      officialDomain: domain, whitelist: S.whitelist,
    });
    wine.dossier = {
      text, sources, generated_at: new Date().toISOString(),
      confidence: domain ? "ホワイトリスト+公式" : "ホワイトリストのみ",
      official_domain: domain, vintage, fallback_text: null,
    };
    await db.put("wines", wine);
    if (S.autoFallback && text.includes("不明")) {
      status.textContent = "Step 3/3: 不明項目をフォールバック検索中…";
      await runFallback(wineId);
    }
    viewWine(wineId);
  } catch (e) {
    status.textContent = "エラー: " + e.message;
  }
}

async function runFallback(wineId) {
  const wine = await db.get("wines", wineId);
  const { text, sources } = await api.fallbackDossier({
    name: wine.name, producer: wine.producer, vintage: wine.dossier.vintage, currentText: wine.dossier.text,
  });
  wine.dossier.fallback_text = text;
  wine.dossier.sources = [...new Set([...(wine.dossier.sources || []), ...sources])];
  wine.dossier.confidence += " + 参考（ホワイトリスト外）";
  await db.put("wines", wine);
}

// 最小限のMarkdown→HTML（見出し・箇条書き・強調のみ）
function mdToHtml(md) {
  return esc(md)
    .replace(/^### (.+)$/gm, "<h5>$1</h5>")
    .replace(/^## (.+)$/gm, "<h4>$1</h4>")
    .replace(/^# (.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^[-・] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]+?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "<br>");
}

// =====================================================================
// セラー在庫 (F4)
// =====================================================================
async function viewCellar() {
  const [items, wines] = await Promise.all([db.all("cellar"), db.all("wines")]);
  const wmap = Object.fromEntries(wines.map((w) => [w.id, w]));
  app().innerHTML = `
    <section class="card">
      <h2>セラーに追加</h2>
      <input id="c-name" list="wine-names" placeholder="ワイン名">
      <datalist id="wine-names">${wines.map((w) => `<option value="${esc(w.name)}">`).join("")}</datalist>
      <div class="row">
        <input id="c-vintage" inputmode="numeric" placeholder="ヴィンテージ（NVは空欄）">
        <input id="c-count" inputmode="numeric" placeholder="本数" value="1">
      </div>
      <button class="primary" data-action="cellar-add">追加</button>
    </section>
    <section>
      <h2>在庫</h2>
      ${items.filter((c) => c.count > 0).length === 0 ? '<p class="muted">在庫なし。</p>' : ""}
      ${items.filter((c) => c.count > 0).map((c) => {
        const w = wmap[c.wine_id];
        return `<div class="list-item">
          <div>
            <div class="li-title">${esc(w?.name || "?")} <span class="muted">${esc(c.vintage || "NV")}</span></div>
            <div class="li-sub">${c.count} 本</div>
          </div>
          <div class="chips">
            <button class="chip" data-action="cellar-consume" data-id="${c.id}">1本消費して記録</button>
            <a class="chip" href="#/wine/${c.wine_id}">照会</a>
            <button class="chip" data-action="cellar-minus" data-id="${c.id}">−</button>
            <button class="chip" data-action="cellar-plus" data-id="${c.id}">＋</button>
          </div>
        </div>`;
      }).join("")}
    </section>`;
}

async function cellarAdd() {
  const name = $("#c-name").value.trim();
  if (!name) return alert("ワイン名を入力してください");
  const wine = await findOrCreateWine(name);
  const vintage = $("#c-vintage").value.trim() || null;
  const count = parseInt($("#c-count").value, 10) || 1;
  const existing = (await db.byIndex("cellar", "wine_id", wine.id)).find((c) => String(c.vintage || "") === String(vintage || ""));
  if (existing) { existing.count += count; await db.put("cellar", existing); }
  else await db.put("cellar", { id: db.uid(), wine_id: wine.id, vintage, count });
  viewCellar();
}

async function cellarConsume(id) {
  const item = await db.get("cellar", id);
  if (!item || item.count < 1) return;
  item.count -= 1;
  await db.put("cellar", item);
  const wine = await db.get("wines", item.wine_id);
  const t = {
    id: db.uid(), wine_id: wine.id, vintage: item.vintage,
    date: new Date().toISOString().slice(0, 10),
    sat: {}, sparkling: {}, faults: [], context: { place: null, companions: [] },
    comment: null, draft: true, created_at: new Date().toISOString(),
  };
  await db.put("tastings", t);
  location.hash = `#/tasting/${t.id}`;
}

// =====================================================================
// 検索・閲覧 (F5)
// =====================================================================
async function viewSearch() {
  const wines = await db.all("wines");
  const regions = [...new Set(wines.map((w) => w.region).filter(Boolean))];
  const varieties = [...new Set(wines.map((w) => w.variety).filter(Boolean))];
  const tastings = await db.all("tastings");
  const places = [...new Set(tastings.map((t) => t.context?.place).filter(Boolean))];
  const companions = [...new Set(tastings.flatMap((t) => t.context?.companions || []))];

  const opt = (arr) => arr.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
  app().innerHTML = `
    <section class="card">
      <h2>検索</h2>
      <input id="s-text" placeholder="全文検索（コメント・銘柄・語彙 英/日どちらでも）">
      <div class="row">
        <select id="s-region"><option value="">産地</option>${opt(regions)}</select>
        <select id="s-variety"><option value="">品種</option>${opt(varieties)}</select>
      </div>
      <div class="row">
        <select id="s-type"><option value="">タイプ</option>${["red", "white", "rose", "sparkling", "fortified"].map((t) => `<option value="${t}">${esc(label(t))}</option>`).join("")}</select>
        <select id="s-fault"><option value="">劣化項目</option>${FAULTS.map((f) => `<option value="${f}">${esc(label(f))}</option>`).join("")}</select>
      </div>
      <div class="row">
        <select id="s-place"><option value="">場所・店名</option>${opt(places)}</select>
        <select id="s-companion"><option value="">同席者</option>${opt(companions)}</select>
      </div>
      <div class="row">
        <label>From<input id="s-from" type="date"></label>
        <label>To<input id="s-to" type="date"></label>
      </div>
      <button class="primary" data-action="search">検索</button>
    </section>
    <section id="search-results"></section>`;
}

async function runSearch() {
  const [tastings, wines] = await Promise.all([db.all("tastings"), db.all("wines")]);
  const wmap = Object.fromEntries(wines.map((w) => [w.id, w]));
  const q = $("#s-text").value.trim().toLowerCase();
  const fRegion = $("#s-region").value, fVariety = $("#s-variety").value, fType = $("#s-type").value;
  const fFault = $("#s-fault").value, fPlace = $("#s-place").value, fComp = $("#s-companion").value;
  const from = $("#s-from").value, to = $("#s-to").value;

  const hits = tastings.filter((t) => {
    const w = wmap[t.wine_id] || {};
    if (fRegion && w.region !== fRegion) return false;
    if (fVariety && w.variety !== fVariety) return false;
    if (fType && w.type !== fType) return false;
    if (fPlace && t.context?.place !== fPlace) return false;
    if (fComp && !(t.context?.companions || []).includes(fComp)) return false;
    if (fFault && !(t.faults || []).some((x) => x.key === fFault)) return false;
    if (from && (t.date || "") < from) return false;
    if (to && (t.date || "") > to) return false;
    if (q) {
      const aromaKeys = [...(t.nose_aromas || []), ...(t.palate_flavours || [])];
      const hay = [
        w.name, w.producer, w.region, w.variety, t.comment, t.context?.place,
        ...(t.context?.companions || []),
        ...aromaKeys, ...aromaKeys.map((k) => S.dict[k] || ""),
        ...(t.faults || []).flatMap((f) => [f.key, S.dict[f.key] || ""]),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  $("#search-results").innerHTML = `<h2>結果 (${hits.length})</h2>` + hits.map((t) => {
    const w = wmap[t.wine_id];
    return `<a class="list-item" href="#/tasting/${t.id}">
      <div>
        <div class="li-title">${esc(w?.name || "?")} ${t.vintage ? `<span class="muted">${esc(t.vintage)}</span>` : ""}</div>
        <div class="li-sub">${fmtDate(t.date)} ${t.context?.place ? "・" + esc(t.context.place) : ""} ${(t.faults || []).map((f) => `<span class="badge fault">${esc(label(f.key))}</span>`).join("")}</div>
      </div></a>`;
  }).join("");
}

// =====================================================================
// リスト読み取り (F3)
// =====================================================================
let scanResults = [];
async function viewScan() {
  app().innerHTML = `
    <section class="card">
      <h2>リスト読み取り</h2>
      <p class="muted">ワインリスト/ラインナップの写真から銘柄・VT・価格を抽出します。写真は処理後破棄され、保存されません。</p>
      <input type="file" id="scan-file" accept="image/*" capture="environment">
      <button class="primary" data-action="scan">読み取り</button>
      <p id="scan-status" class="muted"></p>
    </section>
    <section id="scan-results">${renderScanResults()}</section>`;
}

function renderScanResults() {
  if (!scanResults.length) return "";
  return `<h2>抽出結果 (${scanResults.length})</h2>` + scanResults.map((r, i) => `
    <div class="list-item">
      <div>
        <div class="li-title">${esc(r.name)} ${r.vintage ? `<span class="muted">${esc(r.vintage)}</span>` : ""}</div>
        <div class="li-sub">${r.producer ? esc(r.producer) + " ・ " : ""}${r.price ? "¥" + Number(r.price).toLocaleString() : ""}</div>
      </div>
      <div class="chips">
        <button class="chip" data-action="scan-dossier" data-i="${i}">照会</button>
        <button class="chip" data-action="scan-record" data-i="${i}">記録作成</button>
        <button class="chip" data-action="scan-cellar" data-i="${i}">セラー追加</button>
      </div>
    </div>`).join("");
}

async function runScan() {
  const file = $("#scan-file").files[0];
  const status = $("#scan-status");
  if (!file) return alert("写真を選択してください");
  try {
    status.textContent = "画像処理中…";
    const b64 = await api.imageToBase64(file);
    status.textContent = "読み取り中…";
    scanResults = await api.readWineList(b64);
    status.textContent = "";
    $("#scan-results").innerHTML = renderScanResults();
  } catch (e) {
    status.textContent = "エラー: " + e.message;
  }
}

async function scanAction(kind, i) {
  const r = scanResults[i];
  const wine = await findOrCreateWine(r.name, { producer: r.producer });
  if (kind === "dossier") { location.hash = `#/wine/${wine.id}`; return; }
  if (kind === "cellar") {
    const existing = (await db.byIndex("cellar", "wine_id", wine.id)).find((c) => String(c.vintage || "") === String(r.vintage || ""));
    if (existing) { existing.count += 1; await db.put("cellar", existing); }
    else await db.put("cellar", { id: db.uid(), wine_id: wine.id, vintage: r.vintage || null, count: 1 });
    alert("セラーに追加しました");
    return;
  }
  // 記録作成
  const t = {
    id: db.uid(), wine_id: wine.id, vintage: r.vintage || null,
    date: new Date().toISOString().slice(0, 10),
    sat: {}, sparkling: {}, faults: [], context: { place: null, companions: [] },
    comment: null, draft: true, created_at: new Date().toISOString(),
  };
  await db.put("tastings", t);
  location.hash = `#/tasting/${t.id}`;
}

// =====================================================================
// 設定
// =====================================================================
async function viewSettings() {
  const apiKey = await db.getSetting("apiKey", "");
  const model = await db.getSetting("model", api.DEFAULT_MODEL);
  const overrides = await db.getSetting("dictOverrides", {});
  app().innerHTML = `
    <section class="card">
      <h2>API</h2>
      <label>Anthropic APIキー<input id="set-apikey" type="password" value="${esc(apiKey)}" placeholder="sk-ant-..."></label>
      <label>モデル<input id="set-model" value="${esc(model)}"></label>
      <label class="check"><input type="checkbox" id="set-fallback" ${S.autoFallback ? "checked" : ""}> 不明項目のフォールバック検索を自動実行</label>
    </section>
    <section class="card">
      <h2>表示</h2>
      <label class="check"><input type="checkbox" id="set-showen" ${S.showEn ? "checked" : ""}> 日本語表示に英語キーを併記</label>
    </section>
    <section class="card">
      <h2>日本語辞書（訳語の上書き）</h2>
      <p class="muted">「英語キー=訳語」を1行ずつ。過去データには影響しません。</p>
      <textarea id="set-dict" rows="6" placeholder="blackcurrant=カシス">${esc(Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join("\n"))}</textarea>
    </section>
    <section class="card">
      <h2>情報ソース・ホワイトリスト</h2>
      ${["tier1", "tier2", "tier3", "tier4"].map((t) => `<label>${t.toUpperCase()}<textarea id="set-${t}" rows="2">${esc((S.whitelist[t] || []).join("\n"))}</textarea></label>`).join("")}
    </section>
    <section class="card">
      <h2>データ</h2>
      <div class="row">
        <button data-action="export">JSONエクスポート</button>
        <button data-action="import">JSONインポート</button>
      </div>
      <input type="file" id="import-file" accept=".json" style="display:none">
    </section>
    <button class="primary" data-action="settings-save">設定を保存</button>`;
}

async function settingsSave() {
  await db.setSetting("apiKey", $("#set-apikey").value.trim());
  await db.setSetting("model", $("#set-model").value.trim() || api.DEFAULT_MODEL);
  await db.setSetting("autoFallback", $("#set-fallback").checked);
  await db.setSetting("showEnKeys", $("#set-showen").checked);
  const overrides = {};
  for (const line of $("#set-dict").value.split("\n")) {
    const m = line.match(/^\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i);
    if (m) overrides[m[1]] = m[2];
  }
  await db.setSetting("dictOverrides", overrides);
  const wl = {};
  for (const t of ["tier1", "tier2", "tier3", "tier4"]) {
    wl[t] = $(`#set-${t}`).value.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  await db.setSetting("whitelist", wl);
  await loadSettings();
  alert("保存しました");
  render();
}

async function exportJSON() {
  const data = await db.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `wine-app_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// =====================================================================
// イベントデリゲーション
// =====================================================================
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  try {
    if (a === "quick-save") await quickSave();
    else if (a === "chip") {
      const field = el.dataset.field, value = el.dataset.value;
      if (field === "wine-type") {
        document.querySelectorAll('[data-field="wine-type"]').forEach((c) => c.classList.toggle("on", c === el && !el.classList.contains("on")));
        $("#sparkling-section").style.display = el.classList.contains("on") && value === "sparkling" ? "block" : "none";
      } else if (field.startsWith("sat:")) {
        setDeep(F.sat, field.slice(4), value);
        refreshChips(el, field.slice(4).split(".").reduce((o, k) => o?.[k], F.sat));
        if (field === "sat:nose.condition") $("#unclean-hint").style.display = F.sat.nose?.condition === "unclean" ? "block" : "none";
      } else if (field.startsWith("spk:")) {
        const k = field.slice(4);
        F.sparkling[k] = F.sparkling[k] === value ? null : value;
        refreshChips(el, F.sparkling[k]);
      }
    }
    else if (a === "aroma") {
      const field = el.dataset.field, key = el.dataset.key;
      F[field] = F[field] || [];
      F[field] = F[field].includes(key) ? F[field].filter((k) => k !== key) : [...F[field], key];
      renderPartialTasting();
    }
    else if (a === "fault") {
      const key = el.dataset.key, level = el.dataset.level;
      const cur = F.faults.find((x) => x.key === key);
      if (cur && cur.level === level) F.faults = F.faults.filter((x) => x.key !== key);
      else { F.faults = F.faults.filter((x) => x.key !== key); F.faults.push({ key, level }); }
      [...el.parentElement.children].forEach((c) => c.classList.toggle("on", F.faults.some((x) => x.key === c.dataset.key && x.level === c.dataset.level)));
    }
    else if (a === "companion") {
      const name = el.dataset.name;
      F.context.companions = F.context.companions.includes(name)
        ? F.context.companions.filter((c) => c !== name) : [...F.context.companions, name];
      el.classList.toggle("on");
    }
    else if (a === "companion-add") {
      const name = $("#t-companion-new").value.trim();
      if (name && !F.context.companions.includes(name)) {
        F.context.companions.push(name);
        $("#companion-chips").insertAdjacentHTML("beforeend", `<button class="chip on" data-action="companion" data-name="${esc(name)}">${esc(name)}</button>`);
        $("#t-companion-new").value = "";
      }
    }
    else if (a === "tasting-save") await tastingSave();
    else if (a === "tasting-delete") { if (confirm("この記録を削除しますか？")) { await db.del("tastings", el.dataset.id); location.hash = "#/"; } }
    else if (a === "tasting-new") {
      const t = {
        id: db.uid(), wine_id: el.dataset.wine, vintage: null,
        date: new Date().toISOString().slice(0, 10),
        sat: {}, sparkling: {}, faults: [], context: { place: null, companions: [] },
        comment: null, draft: true, created_at: new Date().toISOString(),
      };
      await db.put("tastings", t);
      location.hash = `#/tasting/${t.id}`;
    }
    else if (a === "dossier") await runDossier(el.dataset.id);
    else if (a === "dossier-fallback") { $("#dossier-status").textContent = "フォールバック検索中…"; await runFallback(el.dataset.id); viewWine(el.dataset.id); }
    else if (a === "cellar-add") await cellarAdd();
    else if (a === "cellar-consume") await cellarConsume(el.dataset.id);
    else if (a === "cellar-plus" || a === "cellar-minus") {
      const item = await db.get("cellar", el.dataset.id);
      item.count += a === "cellar-plus" ? 1 : -1;
      if (item.count < 0) item.count = 0;
      await db.put("cellar", item);
      viewCellar();
    }
    else if (a === "search") await runSearch();
    else if (a === "scan") await runScan();
    else if (a === "scan-dossier") await scanAction("dossier", +el.dataset.i);
    else if (a === "scan-record") await scanAction("record", +el.dataset.i);
    else if (a === "scan-cellar") await scanAction("cellar", +el.dataset.i);
    else if (a === "settings-save") await settingsSave();
    else if (a === "export") await exportJSON();
    else if (a === "import") {
      const input = $("#import-file");
      input.onchange = async () => {
        try {
          const data = JSON.parse(await input.files[0].text());
          await importConfirm(data);
        } catch (err) { alert("インポート失敗: " + err.message); }
      };
      input.click();
    }
  } catch (err) {
    console.error(err);
    alert("エラー: " + err.message);
  }
});

async function importConfirm(data) {
  const n = (data.wines?.length || 0) + (data.tastings?.length || 0) + (data.cellar?.length || 0);
  if (!confirm(`${n} 件のレコードをインポートします（同一IDは上書き）。実行しますか？`)) return;
  await db.importAll(data);
  await loadSettings();
  alert("インポート完了");
  render();
}

function refreshChips(el, currentValue) {
  [...el.parentElement.children].forEach((c) => c.classList.toggle("on", c.dataset.value === currentValue));
}

// アロマ選択の部分再描画（開いていたdetailsを維持）
function renderPartialTasting() {
  document.querySelectorAll(".aroma").forEach((area) => {
    const field = area.querySelector("[data-field]")?.dataset.field;
    if (!field) return;
    const selected = F[field] || [];
    const sel = area.querySelector(".selected-aromas");
    sel.innerHTML = selected.map((k) => `<button class="chip on" data-action="aroma" data-field="${field}" data-key="${k}">${esc(label(k))} ×</button>`).join("") || '<span class="muted">未選択</span>';
    area.querySelectorAll("details .chip").forEach((c) => c.classList.toggle("on", selected.includes(c.dataset.key)));
  });
}

// =====================================================================
// 起動
// =====================================================================
window.addEventListener("hashchange", render);
loadSettings().then(render);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
