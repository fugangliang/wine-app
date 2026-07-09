// Wine Log UI スモークテスト（要: Google Chrome + `npm i puppeteer-core`）実行: node test/smoke.mjs
import puppeteer from "puppeteer-core";
import { spawn } from "child_process";

const PORT = 8788;
const BASE = `http://localhost:${PORT}`;
const results = [];
const ok = (name, cond, detail = "") => {
  results.push([cond ? "PASS" : "FAIL", name, detail]);
  if (!cond) process.exitCode = 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 静的サーバ起動
const server = spawn("python3", ["-m", "http.server", String(PORT)], {
  cwd: process.env.HOME + "/Documents/wine-app/docs",
  stdio: "ignore",
});
await sleep(1200);

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 }); // iPhone想定
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text()); });

try {
  // 1. 起動・ホーム描画
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.waitForSelector("#q-name", { timeout: 5000 });
  ok("ホーム描画（クイック入力あり）", true);

  // 2. クイック入力 → 下書き保存
  await page.type("#q-name", "Ch. Test Margaux");
  await page.type("#q-place", "テスト・ビストロ");
  await page.type("#q-memo", "スモークテスト用メモ");
  await page.click('[data-action="quick-save"]');
  await sleep(600);
  let html = await page.content();
  ok("クイック保存→一覧に表示", html.includes("Ch. Test Margaux"));
  ok("下書きバッジ表示", html.includes('badge draft'));

  // 3. 記録を開いてSATフォーム
  await page.click(".list-item");
  await sleep(600);
  html = await page.content();
  ok("SATフォーム描画（Appearance/Nose/Palate/Conclusions）",
    html.includes("Appearance") && html.includes("Nose") && html.includes("Palate") && html.includes("Conclusions"));
  ok("劣化チェックリスト描画", html.includes("劣化チェックリスト") && html.includes("TCA（ブショネ）"));

  // 4. チップ操作: clarity=clear, condition=unclean → ヒント表示
  await page.click('[data-field="sat:appearance.clarity"][data-value="clear"]');
  await page.click('[data-field="sat:nose.condition"][data-value="unclean"]');
  await sleep(200);
  const hintVisible = await page.$eval("#unclean-hint", (el) => el.style.display !== "none");
  ok("unclean選択→劣化チェックリスト誘導ヒント表示", hintVisible);

  // 5. 劣化: TCA=明確
  await page.click('[data-action="fault"][data-key="tca"][data-level="definite"]');
  await sleep(200);
  const tcaOn = await page.$eval('[data-action="fault"][data-key="tca"][data-level="definite"]', (el) => el.classList.contains("on"));
  ok("劣化チップ選択状態", tcaOn);

  // 6. アロマ選択（black_fruit クラスタ → blackcurrant）
  await page.evaluate(() => {
    document.querySelectorAll("details summary").forEach((s) => { if (s.textContent.includes("黒系果実")) s.parentElement.open = true; });
  });
  await page.click('[data-action="aroma"][data-key="blackcurrant"]');
  await sleep(200);
  html = await page.content();
  ok("アロマ選択→選択済み欄に反映", (await page.$eval(".selected-aromas", (el) => el.textContent)).includes("カシス"));

  // 7. quality選択して保存 → 下書き解除
  await page.click('[data-field="sat:conclusions.quality"][data-value="good"]');
  await page.click('[data-action="tasting-save"]');
  await sleep(700);
  html = await page.content();
  ok("SAT保存→ホームに戻る", html.includes("Ch. Test Margaux"));
  ok("下書きバッジ解除", !html.includes('badge draft'));
  ok("フォールトバッジ表示（一覧）", html.includes("TCA"));

  // 8. セラー: 追加 → 消費して記録
  await page.goto(BASE + "#/cellar", { waitUntil: "networkidle0" });
  await sleep(400);
  await page.type("#c-name", "Test Champagne NV");
  await page.$eval("#c-count", (el) => (el.value = "2"));
  await page.click('[data-action="cellar-add"]');
  await sleep(500);
  html = await page.content();
  ok("セラー追加（2本）", html.includes("Test Champagne NV") && html.includes("2 本"));
  await page.click('[data-action="cellar-consume"]');
  await sleep(600);
  ok("消費→記録画面へ遷移", (await page.url()).includes("#/tasting/"));
  await page.goto(BASE + "#/cellar", { waitUntil: "networkidle0" });
  await sleep(400);
  ok("在庫が1本に減算", (await page.content()).includes("1 本"));

  // 9. 検索: 英語キーで全文ヒット（blackcurrant）と日本語（カシス）
  await page.goto(BASE + "#/search", { waitUntil: "networkidle0" });
  await sleep(400);
  await page.type("#s-text", "blackcurrant");
  await page.click('[data-action="search"]');
  await sleep(400);
  ok("英語キーで検索ヒット", (await page.$eval("#search-results", (el) => el.textContent)).includes("Ch. Test Margaux"));
  await page.$eval("#s-text", (el) => (el.value = ""));
  await page.type("#s-text", "カシス");
  await page.click('[data-action="search"]');
  await sleep(400);
  ok("日本語訳で検索ヒット", (await page.$eval("#search-results", (el) => el.textContent)).includes("Ch. Test Margaux"));
  // 劣化フィルタ
  await page.$eval("#s-text", (el) => (el.value = ""));
  await page.select("#s-fault", "tca");
  await page.click('[data-action="search"]');
  await sleep(400);
  ok("劣化フィルタ（TCA）ヒット", (await page.$eval("#search-results", (el) => el.textContent)).includes("Ch. Test Margaux"));

  // 10. ワイン詳細タイムライン
  await page.click("#search-results .list-item");
  await sleep(500);
  await page.click('a[href^="#/wine/"]');
  await sleep(500);
  html = await page.content();
  ok("ワイン詳細: タイムライン表示", html.includes("タイムライン"));
  ok("ワイン詳細: ドシエ未生成表示+照会ボタン", html.includes("未生成") && html.includes("照会（ドシエ生成）"));

  // 11. APIキー未設定でドシエ実行 → エラーメッセージ
  await page.click('[data-action="dossier"]');
  await sleep(700);
  const status = await page.$eval("#dossier-status", (el) => el.textContent);
  ok("APIキー未設定エラーの明示", status.includes("APIキーが未設定"));

  // 12. 設定: 保存→再読込→永続化
  await page.goto(BASE + "#/settings", { waitUntil: "networkidle0" });
  await sleep(400);
  await page.click("#set-showen");
  page.once("dialog", (d) => d.accept());
  await page.click('[data-action="settings-save"]');
  await sleep(500);
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(500);
  ok("設定の永続化（英語キー併記ON）", await page.$eval("#set-showen", (el) => el.checked));

  // 12b. チャット連携: ドシエJSON取り込み
  const dossierJSON = JSON.stringify({
    format: "wine-dossier-v1", name: "Latricières-Chambertin Test", producer: "Dom. Test",
    region: "Gevrey-Chambertin", variety: "Pinot Noir", type: "red", vintage: "2019",
    sources: ["https://example.com/tech-sheet"],
    text: "## 生産者プロファイル\n全房比率: 30%\n新樽比率: 不明",
  });
  await page.evaluate((j) => { document.querySelector("#chat-json").value = j; }, dossierJSON);
  await page.click('[data-action="chat-import"]');
  await sleep(300);
  ok("ドシエJSON取り込み→件数表示", (await page.$eval("#chat-import-status", (el) => el.textContent)).includes("1件"));
  await sleep(900); // 自動遷移待ち
  html = await page.content();
  ok("取り込み後ワイン詳細に遷移", (await page.url()).includes("#/wine/"));
  ok("ドシエ本文・信頼度ラベル表示", html.includes("全房比率") && html.includes("チャット生成"));
  ok("出典リンク表示", html.includes("example.com/tech-sheet"));

  // 12c. チャット連携: リストJSON取り込み（読取タブ）
  await page.goto(BASE + "#/scan", { waitUntil: "networkidle0" });
  await sleep(400);
  await page.evaluate(() => { document.querySelector("details").open = true; });
  const listJSON = JSON.stringify({ format: "wine-list-v1", items: [
    { name: "Test Riesling Kabinett", producer: "Wg. Test", vintage: "2022", price: 6800 },
    { name: "Test Barolo", producer: null, vintage: "2018", price: null },
  ]});
  await page.evaluate((j) => { document.querySelector("#scan-json").value = j; }, listJSON);
  await page.click('[data-action="scan-json"]');
  await sleep(300);
  const scanHtml = await page.$eval("#scan-results", (el) => el.innerHTML);
  ok("リストJSON取り込み→2件表示", scanHtml.includes("Test Riesling Kabinett") && scanHtml.includes("Test Barolo"));
  ok("行アクション（照会/記録/セラー）表示", scanHtml.includes("記録作成") && scanHtml.includes("セラー追加"));

  // 13. Service Worker登録
  const swReg = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
  ok("Service Worker登録", swReg);

  // 14. ページエラーなし
  ok("コンソール/ページエラーなし", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
} catch (e) {
  ok("実行完走", false, String(e).slice(0, 200));
} finally {
  await browser.close();
  server.kill();
}

for (const [st, name, detail] of results) console.log(`${st}  ${name}${detail ? "  — " + detail : ""}`);
console.log(results.every((r) => r[0] === "PASS") ? "\nALL PASS" : "\nFAILURES PRESENT");
