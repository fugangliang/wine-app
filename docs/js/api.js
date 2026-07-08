// Anthropic API クライアント（照会ドシエ生成 / Vision リスト読み取り）
// ブラウザ直接アクセスのため anthropic-dangerous-direct-browser-access ヘッダを使用。

import { getSetting } from "./db.js";

const API_URL = "https://api.anthropic.com/v1/messages";
export const DEFAULT_MODEL = "claude-sonnet-4-6";

// ---- Tier制ホワイトリスト（デフォルト・設定画面で編集可）(§4.7) ----
export const DEFAULT_WHITELIST = {
  tier1: ["enoteca.co.jp", "fwines.co.jp", "luc-corp.co.jp", "jeroboam.co.jp", "mottox.co.jp"],
  tier2: ["robertparker.com", "vinous.com", "jancisrobinson.com", "decanter.com", "jamessuckling.com"],
  tier3: ["champagne.fr", "bourgogne-wines.com", "bordeaux.com", "consorziobrunellodimontalcino.it", "langhevini.it"],
  tier4: ["wine-searcher.com"],
};

export function flattenWhitelist(wl) {
  return [...new Set([...(wl.tier1 || []), ...(wl.tier2 || []), ...(wl.tier3 || []), ...(wl.tier4 || [])])];
}

async function callAPI(body) {
  const apiKey = await getSetting("apiKey");
  if (!apiKey) throw new Error("APIキーが未設定です。設定画面で入力してください。");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`API エラー ${res.status}: ${err.error?.message || res.statusText}`);
  }
  return res.json();
}

function extractText(response) {
  return (response.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

function extractCitations(response) {
  const urls = new Set();
  for (const block of response.content || []) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) if (r.url) urls.add(r.url);
    }
    if (block.type === "text" && Array.isArray(block.citations)) {
      for (const c of block.citations) if (c.url) urls.add(c.url);
    }
  }
  return [...urls];
}

// ---- ドシエ生成プロンプト (§4.6: 用語解説なし・技術パラメータ直行) ----
function dossierSystemPrompt() {
  return [
    "あなたはワインの技術情報を収集・整理するリサーチアシスタントである。読者はWSET Level 3保持の上級者。",
    "厳守事項:",
    "- 専門用語の解説・パラフレーズは一切行わない。",
    "- 技術パラメータに直行する: 栽培（面積・樹齢・農法認証・収量）、醸造（発酵容器・全房比率・MLF・酵母）、熟成（容器・新樽比率・期間・バトナージュ）。",
    "- スパークリングは加えて: ベースヴィンテージ構成・リザーヴワイン比率・ティラージュ期間・ドザージュ量(g/L)。",
    "- 情報がソースにない項目は「不明」と明記する。推測で埋めない。",
    "- 出力構成（優先順）: 1) 生産者プロファイル・栽培/醸造/熟成スタイル 2) ヴィンテージ特性（指定時）3) 評価スコア（媒体名・出典明示）4) 価格帯・入手性（簡易）。",
    "- 出力は日本語。固有名詞・技術用語は原語表記を維持。Markdown形式。",
  ].join("\n");
}

// Step 1: 生産者公式ドメイン特定（オープン検索・内容非取得）
export async function findOfficialDomain(producer, wineName) {
  const model = (await getSetting("model")) || DEFAULT_MODEL;
  const res = await callAPI({
    model,
    max_tokens: 1024,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    messages: [{
      role: "user",
      content: `ワイン生産者「${producer || wineName}」の公式サイトのドメインを特定せよ。回答は最終行に「DOMAIN: example.com」の形式でドメインのみ記載。特定できなければ「DOMAIN: none」。`,
    }],
  });
  const m = extractText(res).match(/DOMAIN:\s*([a-z0-9.-]+\.[a-z]{2,})/i);
  return m && m[1] !== "none" ? m[1].toLowerCase() : null;
}

// Step 2: 本照会（allowed_domains = ホワイトリスト + 公式ドメイン）
export async function generateDossier({ name, producer, vintage, type, officialDomain, whitelist }) {
  const model = (await getSetting("model")) || DEFAULT_MODEL;
  const domains = flattenWhitelist(whitelist);
  if (officialDomain) domains.push(officialDomain);
  const q = [
    `対象ワイン: ${name}`,
    producer ? `生産者: ${producer}` : "",
    vintage ? `ヴィンテージ: ${vintage}（ヴィンテージ特性も記載）` : "",
    type === "sparkling" ? "タイプ: スパークリング（ベースVT構成・リザーヴ比率・ティラージュ期間・ドザージュ量を必須項目とする）" : "",
    "上記ワインのドシエを作成せよ。",
  ].filter(Boolean).join("\n");
  const res = await callAPI({
    model,
    max_tokens: 8000,
    system: dossierSystemPrompt(),
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8, allowed_domains: domains }],
    messages: [{ role: "user", content: q }],
  });
  return { text: extractText(res), sources: extractCitations(res) };
}

// Step 3: フォールバック（不足要素のみオープン検索・信頼度ラベル付与）
export async function fallbackDossier({ name, producer, vintage, currentText }) {
  const model = (await getSetting("model")) || DEFAULT_MODEL;
  const res = await callAPI({
    model,
    max_tokens: 4000,
    system: dossierSystemPrompt(),
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    messages: [{
      role: "user",
      content: `対象ワイン: ${name}${producer ? ` / 生産者: ${producer}` : ""}${vintage ? ` / VT: ${vintage}` : ""}\n\n以下のドシエで「不明」となっている項目のみをWeb検索で補完せよ。判明した項目のみ「## 補完情報【参考（ホワイトリスト外）】」の見出し配下に列挙し、各項目に出典URLを必ず付す。判明しなかった項目は記載しない。\n\n---\n${currentText}`,
    }],
  });
  return { text: extractText(res), sources: extractCitations(res) };
}

// ---- F3: Vision リスト読み取り（画像は非保存・処理後破棄）----
export async function readWineList(base64Jpeg) {
  const model = (await getSetting("model")) || DEFAULT_MODEL;
  const res = await callAPI({
    model,
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } },
        {
          type: "text",
          text: 'この画像はワインリストまたはワインのラインナップである。読み取れる銘柄をJSON配列のみで出力せよ（前後に文章を付けない）。各要素: {"name": "銘柄名（原語表記）", "producer": "生産者（判別可能な場合）", "vintage": "ヴィンテージ（数値または null）", "price": "価格（数値または null）"}。判読不能な項目は null。',
        },
      ],
    }],
  });
  const text = extractText(res);
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("リストを読み取れませんでした");
  return JSON.parse(m[0]);
}

// 画像をリサイズしてbase64(JPEG)化（トークン節約・長辺1568px）
export function imageToBase64(file, maxEdge = 1568) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("画像を読み込めません")); };
    img.src = url;
  });
}
