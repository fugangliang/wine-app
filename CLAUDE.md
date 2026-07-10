# CLAUDE.md — Wine Log（ワイン記録・照会PWA）

## 仕様の正
- `requirements_v0.3.md`（要件定義 v0.3 実装着手版）が正。実装判断で迷ったらここに戻る。
- ユーザーはWSET L3保持の上級者。**アプリ内のあらゆる出力で専門用語の解説・パラフレーズをしない。**

## 設計上の確定事項
- 語彙は二層設計: 内部=英語canonicalキー（`lexicon.js`）、表示=日本語辞書（`dict-ja.js` + settings.dictOverrides）。
  **英語キーを変更しない**（過去データ互換が壊れる）。訳語変更は辞書側のみ。
- ストレージ: IndexedDB `wine-app` v1（wines / tastings / cellar / settings）。純テキストのみ・画像保存禁止。
- 照会エンジン: Anthropic API 直叩き（`anthropic-dangerous-direct-browser-access` ヘッダ）。
  モデル既定 `claude-sonnet-4-6`（settings.model で変更可）。Web検索ツールは `web_search_20260209`（`allowed_domains` 対応版）。
- ドシエ生成は3ステップ（api.js）: ①公式ドメイン特定（オープン検索）→ ②本照会（allowed_domains=ホワイトリスト+公式）→ ③不明項目のみフォールバック（「参考（ホワイトリスト外）」ラベル+出典必須）。③は settings.autoFallback（既定on）で自動実行。
- APIキーは settings ストアに保存し、**JSONエクスポートに含めない**（db.js exportAll）。
- 既存ファイル上書き禁止ルール（workspace §2）は適用外: 本PJはgit履歴で版管理（固定名運用）。

## 作業ルール
- 変更後は必ず `node --check docs/js/*.js` と `node test/check.js` を通す。
- レキシコン/辞書を追加したら test/check.js のカバレッジが担保する（訳語漏れで落ちる）。
- 動作確認: `cd docs && python3 -m http.server 8000`。
- 確定事項が増えたら本ファイルに追記して git commit（workspace の last-session.md 代替）。

## 照会の2方式（2026-07-09確定）
- **チャット連携（主運用）**: Claude.aiプロジェクト（指示書=`chat-project-instructions.md`）で生成したJSONを
  アプリに貼り付けて取り込む。追加課金なし。取り込み形式は `wine-dossier-v1`（設定タブ）と `wine-list-v1`（読取タブ/設定タブ）。
  ホワイトリストは指示書ベースのベストエフォート（APIの `allowed_domains` のような強制はない）。
- **API直接（併存）**: api.js の3ステップ検索。APIキー入力時のみ有効。従量課金。
- 取り込みスキーマを変えるときは `chat-project-instructions.md` と app.js の importDossiers / scanJSONImport を必ず同時に更新する。

## 公開状況（2026-07-09）
- GitHub: https://github.com/fugangliang/wine-app（public・main の /docs をPages配信）
- アプリURL: https://fugangliang.github.io/wine-app/
- UIスモークテスト 29項目 ALL PASS（test/smoke.mjs・要 puppeteer-core + Chrome。チャット取り込み含む）。本番URLでも描画/SW登録/無エラー確認済み。
- **API直接方式の疎通（ドシエ生成・Visionリスト読取）は未確認**: 主運用はチャット連携のため必須ではない。

## 残タスク / 未確定
- RFがClaude.aiにプロジェクト「ワインドシエ」を作成し指示書を貼る → 実際に1本ドシエ生成→取り込みを試す。
- ホワイトリストの輸入元ドメインは暫定（enoteca.co.jp / fwines.co.jp / luc-corp.co.jp / jeroboam.co.jp / mottox.co.jp）。RFの取引先に合わせて設定画面で調整可。
- v2候補（統計: フォールト発生率・産地/品種分布）はデータ構造対応済み・UI未実装。

## リリース手順（2026-07-10確定）
1. app.js の APP_VERSION / APP_VERSION_NOTE を更新（日付ベース: vYYYY-MM-DD.n）
2. sw.js の CACHE を同じ版数に更新（旧キャッシュはactivate時に自動削除）
3. スモークテスト実行 → commit → push（Pagesに1〜2分で反映）
- ユーザー側の更新確認は「設定タブ最下部の版数表示」。
