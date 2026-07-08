// 日本語表示辞書（デフォルト）。設定画面での編集は settings.dictOverrides に差分保存され、
// 実行時に本辞書へマージされる。訳語変更は過去データ（英語キー）に影響しない。

export const DICT_JA = {
  // ---- タイプ ----
  red: "赤", white: "白", rose: "ロゼ", sparkling: "スパークリング", fortified: "酒精強化",

  // ---- Appearance ----
  clear: "澄んだ", hazy: "濁った",
  pale: "淡い", deep: "濃い",
  lemon_green: "レモングリーン", lemon: "レモン", gold: "ゴールド", amber: "アンバー", brown: "ブラウン",
  pink: "ピンク", salmon: "サーモン", orange: "オレンジ",
  purple: "紫", ruby: "ルビー", garnet: "ガーネット", tawny: "トーニー",

  // ---- 共通スケール ----
  light: "弱い", medium_minus: "中(-)", medium: "中", medium_plus: "中(+)", pronounced: "強い",
  low: "低い", high: "高い",
  short: "短い", long: "長い", full: "フル", persistent: "持続的",

  // ---- Nose ----
  clean: "クリーン", unclean: "アンクリーン",
  youthful: "若い", developing: "発展中", fully_developed: "完全に発展", tired: "衰退",

  // ---- Palate ----
  dry: "辛口", off_dry: "オフドライ", medium_dry: "中辛口", medium_sweet: "中甘口", sweet: "甘口", luscious: "極甘口",

  // ---- Conclusions ----
  faulty: "欠陥", poor: "低質", acceptable: "並", good: "良質", very_good: "秀逸", outstanding: "傑出",
  too_young: "若すぎる", drink_now_potential: "飲み頃・熟成余地あり", drink_now: "飲み頃・熟成不向き", too_old: "古すぎる",

  // ---- スパークリング拡張 ----
  delicate: "デリケート", creamy: "クリーミー", aggressive: "アグレッシブ",
  none: "なし",
  brut_nature: "ブリュット・ナチュール", extra_brut: "エクストラ・ブリュット", brut: "ブリュット",
  extra_dry: "エクストラ・ドライ", sec: "セック", demi_sec: "ドゥミ・セック", doux: "ドゥー",

  // ---- 劣化 ----
  oxidation: "酸化", reduction: "還元", heat_damage: "熱劣化", premox: "PMO（プレマチュア酸化）",
  tca: "TCA（ブショネ）", lightstrike: "光劣化", brett: "ブレタノマイセス", va: "揮発酸",
  slight: "軽微", definite: "明確",
  // faulty は Conclusions と共用（欠陥）

  // ---- クラスタ名 ----
  floral: "花", green_fruit: "緑色系果実", citrus_fruit: "柑橘", stone_fruit: "核果",
  tropical_fruit: "トロピカル", red_fruit: "赤系果実", black_fruit: "黒系果実",
  dried_cooked_fruit: "乾燥・加熱果実", herbaceous: "青草・野菜", herbal: "ハーブ",
  pungent_spice: "スパイス", mineral_other: "ミネラル他",
  yeast_autolysis: "酵母（オートリシス）", malolactic: "MLF", oak: "オーク",
  deliberate_oxidation: "意図的酸化", fruit_development_white: "果実の発展（白）",
  fruit_development_red: "果実の発展（赤）", bottle_age_white: "瓶熟（白）", bottle_age_red: "瓶熟（赤）",

  // ---- レキシコン ----
  acacia: "アカシア", honeysuckle: "スイカズラ", chamomile: "カモミール", elderflower: "エルダーフラワー",
  geranium: "ゼラニウム", blossom: "白い花", rose: "バラ", violet: "スミレ",
  apple: "リンゴ", gooseberry: "グーズベリー", pear: "洋ナシ", pear_drop: "ペアドロップ", quince: "マルメロ", grape: "ブドウ",
  grapefruit: "グレープフルーツ", lemon_fruit: "レモン果実", lime: "ライム", orange_peel: "オレンジピール", lemon_peel: "レモンピール",
  peach: "モモ", apricot: "アプリコット", nectarine: "ネクタリン",
  banana: "バナナ", lychee: "ライチ", mango: "マンゴー", melon: "メロン", passion_fruit: "パッションフルーツ", pineapple: "パイナップル",
  redcurrant: "レッドカラント", cranberry: "クランベリー", raspberry: "ラズベリー", strawberry: "イチゴ",
  red_cherry: "レッドチェリー", red_plum: "赤プラム",
  blackcurrant: "カシス", blackberry: "ブラックベリー", bramble: "ブランブル", blueberry: "ブルーベリー",
  black_cherry: "ブラックチェリー", black_plum: "黒プラム",
  fig: "イチジク", prune: "プルーン", raisin: "レーズン", sultana: "サルタナ", kirsch: "キルシュ",
  jamminess: "ジャム", baked_stewed_fruit: "焼き/煮た果実", preserved_fruit: "コンポート",
  green_bell_pepper: "ピーマン", grass: "草", tomato_leaf: "トマトの葉", asparagus: "アスパラガス", blackcurrant_leaf: "カシスの葉",
  eucalyptus: "ユーカリ", mint: "ミント", medicinal: "薬品", lavender: "ラベンダー", fennel: "フェンネル", dill: "ディル",
  black_pepper: "黒コショウ", white_pepper: "白コショウ", liquorice: "リコリス",
  flint: "火打石", wet_stone: "濡れた石", wet_wool: "濡れたウール",
  biscuit: "ビスケット", bread: "パン", toast_yeast: "トースト（酵母）", pastry: "ペストリー",
  brioche: "ブリオッシュ", bread_dough: "パン生地", cheese_yeast: "チーズ（酵母）",
  butter: "バター", cream: "クリーム", cheese_mlf: "チーズ（MLF）",
  vanilla: "バニラ", cloves: "クローブ", nutmeg_oak: "ナツメグ（オーク）", coconut: "ココナッツ",
  butterscotch: "バタースコッチ", toast_oak: "トースト（オーク）", cedar: "杉", charred_wood: "焦がした木",
  smoke: "スモーク", chocolate_oak: "チョコレート（オーク）", coffee_oak: "コーヒー（オーク）", resinous: "樹脂",
  almond: "アーモンド", marzipan: "マジパン", hazelnut: "ヘーゼルナッツ", walnut: "クルミ",
  chocolate_ox: "チョコレート（酸化）", coffee_ox: "コーヒー（酸化）", toffee: "タフィー", caramel: "キャラメル",
  dried_apricot: "干しアプリコット", marmalade: "マーマレード", dried_apple: "干しリンゴ", dried_banana: "干しバナナ",
  fig_dev: "イチジク（発展）", prune_dev: "プルーン（発展）", tar: "タール", dried_blackberry: "干しブラックベリー",
  dried_cranberry: "干しクランベリー", cooked_blackberry: "煮たブラックベリー", cooked_red_plum: "煮た赤プラム",
  petrol: "ペトロール", kerosene: "灯油", cinnamon: "シナモン", ginger: "ジンジャー", nutmeg_age: "ナツメグ（瓶熟）",
  toast_age: "トースト（瓶熟）", nutty: "ナッツ", mushroom_white: "キノコ（白）", hay: "干し草", honey: "蜂蜜",
  leather: "革", forest_floor: "森の下草", earth: "土", mushroom_red: "キノコ（赤）", game: "ジビエ",
  tobacco: "タバコ", vegetal: "野菜的", wet_leaves: "濡れ落ち葉", savoury: "セイボリー", meaty: "肉", farmyard: "農場",
};
