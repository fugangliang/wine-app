# Wine Log — ワイン記録・照会PWA

WSET L3 SAT準拠のテイスティング記録 + LLM照会（ドシエ生成）。個人専用・単一ユーザー。
仕様の正本は `requirements_v0.3.md`（要件定義 v0.3 実装着手版）。

## 構成

```
docs/        PWA本体（ビルド不要のvanilla JS。GitHub Pagesが/docsを配信可能）
  js/lexicon.js    SAT構造 + L3レキシコン（英語canonicalキー）
  js/dict-ja.js    日本語表示辞書（設定画面で上書き可）
  js/db.js         IndexedDB（wines/tastings/cellar/settings）
  js/api.js        Anthropic API（ドシエ3ステップ検索・Visionリスト読取）
  js/app.js        UI（ハッシュルーティングSPA）
test/check.js      整合性テスト（node test/check.js）
```

## アプリURL

https://fugangliang.github.io/wine-app/

iPhone Safariで開く → 共有 → 「ホーム画面に追加」→ standalone起動。

## ローカル起動

```sh
cd docs && python3 -m http.server 8000
# → http://localhost:8000
```

Service Worker / manifest は http(s) 経由でのみ有効（file:// 不可）。
iPhone: Safariで開く → 共有 → ホーム画面に追加。

## 照会の2方式

| 方式 | 費用 | 手順 |
|---|---|---|
| **チャット連携（推奨・既定）** | Claude.ai月額の内数（追加課金なし） | `chat-project-instructions.md` をClaude.aiプロジェクトに登録 → チャットで「ドシエ: 銘柄」→ 出力JSONを設定タブ「チャット連携取り込み」へ貼り付け。リスト読取も写真をチャットに貼って同様 |
| API直接（任意） | 従量課金（ドシエ1回 20〜50円目安） | 設定タブでAnthropic APIキーを入力 → ワイン詳細からワンタップ照会 |

APIキーは端末ローカル保存・エクスポート対象外。モデル既定 `claude-sonnet-4-6`、ホワイトリスト（Tier 1〜4）は設定画面で編集可能。

## 主な機能

| 機能 | 内容 |
|---|---|
| クイック入力 | ワイン名のみで保存（下書きバッジ）→ 後からSAT追記 |
| SAT記録 | WSET L3準拠 + スパークリング拡張 + 劣化チェックリスト（8項目×3段階） |
| 照会（ドシエ） | ①公式ドメイン特定 → ②ホワイトリスト限定検索 → ③不明項目のみフォールバック（参考ラベル付き）。結果はキャッシュ |
| リスト読取 | 写真から銘柄・VT・価格を抽出（画像は非保存）→ 照会/記録/セラー追加 |
| セラー | 銘柄×VT×本数。記録作成時に1本消費 |
| 検索 | 全文（英/日どちらでもヒット）+ 産地/品種/タイプ/期間/場所/同席者/劣化フィルタ + 銘柄別タイムライン |
| データ保全 | JSONエクスポート/インポート（APIキーは含めない） |

## オフライン

記録・閲覧・検索はオフライン可。照会（F2）とリスト読取（F3）のみオンライン必須。
