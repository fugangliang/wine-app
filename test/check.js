// 単体チェック: レキシコン整合性 + 辞書カバレッジ + SAT構造
// 実行: node test/check.js
import { SAT, SPARKLING, FAULTS, FAULT_LEVELS, LEXICON, ALL_AROMA_KEYS } from "../docs/js/lexicon.js";
import { DICT_JA } from "../docs/js/dict-ja.js";

let fail = 0;
const ok = (cond, msg) => { if (!cond) { console.error("NG:", msg); fail++; } };

// 1. レキシコンの全キーに日本語訳があるか
for (const k of ALL_AROMA_KEYS) ok(DICT_JA[k], `訳語なし: ${k}`);

// 2. クラスタ名に訳があるか
for (const c of LEXICON) ok(DICT_JA[c.cluster], `クラスタ訳なし: ${c.cluster}`);

// 3. キー重複がないか
const seen = new Set();
for (const k of ALL_AROMA_KEYS) { ok(!seen.has(k), `キー重複: ${k}`); seen.add(k); }

// 4. SATスケール値に訳があるか
const satValues = new Set();
const walk = (o) => { for (const v of Object.values(o)) Array.isArray(v) ? v.forEach((x) => satValues.add(x)) : walk(v); };
walk(SAT); walk(SPARKLING);
for (const v of satValues) ok(DICT_JA[v], `SAT/SPK訳なし: ${v}`);

// 5. 劣化キー・レベルに訳があるか
for (const f of [...FAULTS, ...FAULT_LEVELS]) ok(DICT_JA[f], `劣化訳なし: ${f}`);

// 6. 構造の基本形
ok(LEXICON.length === 20, `クラスタ数: ${LEXICON.length} (期待 20)`);
ok(FAULTS.length === 8, `劣化項目数: ${FAULTS.length} (期待 8)`);
ok(SAT.conclusions.quality.length === 6, "quality は6段階 (BLIC)");

console.log(fail === 0 ? `PASS (アロマ${ALL_AROMA_KEYS.length}キー / クラスタ${LEXICON.length} / SAT値${satValues.size})` : `FAIL: ${fail}件`);
process.exit(fail === 0 ? 0 : 1);
