// WSET L3 SAT 構造定義 + アロマ/フレーバー・レキシコン
// 内部データはすべて英語canonicalキー。表示は dict-ja.js のマッピングで行う。

// ---- SAT スケール定義 ----
export const SAT = {
  appearance: {
    clarity: ["clear", "hazy"],
    intensity: ["pale", "medium", "deep"],
    colour: {
      white: ["lemon_green", "lemon", "gold", "amber", "brown"],
      rose: ["pink", "salmon", "orange"],
      red: ["purple", "ruby", "garnet", "tawny", "brown"],
      sparkling: ["lemon_green", "lemon", "gold", "amber", "pink", "salmon"],
      fortified: ["lemon", "gold", "amber", "brown", "ruby", "garnet", "tawny"],
    },
  },
  nose: {
    condition: ["clean", "unclean"],
    intensity: ["light", "medium_minus", "medium", "medium_plus", "pronounced"],
    development: ["youthful", "developing", "fully_developed", "tired"],
  },
  palate: {
    sweetness: ["dry", "off_dry", "medium_dry", "medium_sweet", "sweet", "luscious"],
    acidity: ["low", "medium_minus", "medium", "medium_plus", "high"],
    tannin: ["low", "medium_minus", "medium", "medium_plus", "high"],
    alcohol: ["low", "medium", "high"],
    body: ["light", "medium_minus", "medium", "medium_plus", "full"],
    flavour_intensity: ["light", "medium_minus", "medium", "medium_plus", "pronounced"],
    finish: ["short", "medium_minus", "medium", "medium_plus", "long"],
  },
  conclusions: {
    quality: ["faulty", "poor", "acceptable", "good", "very_good", "outstanding"],
    readiness: ["too_young", "drink_now_potential", "drink_now", "too_old"],
  },
};

// ---- スパークリング拡張 (§4.2) ----
export const SPARKLING = {
  mousse_texture: ["delicate", "creamy", "aggressive"],
  mousse_persistence: ["short", "medium", "persistent"],
  autolytic_intensity: ["none", "light", "medium", "pronounced"],
  dosage_perception: ["brut_nature", "extra_brut", "brut", "extra_dry", "sec", "demi_sec", "doux"],
};

// ---- 劣化チェックリスト (§4.3) ----
export const FAULTS = ["oxidation", "reduction", "heat_damage", "premox", "tca", "lightstrike", "brett", "va"];
export const FAULT_LEVELS = ["slight", "definite", "faulty"]; // 軽微/明確/欠陥レベル

// ---- アロマ/フレーバー・レキシコン（クラスタ階層）----
// tier: 1=primary, 2=secondary, 3=tertiary
export const LEXICON = [
  { cluster: "floral", tier: 1, keys: ["acacia", "honeysuckle", "chamomile", "elderflower", "geranium", "blossom", "rose", "violet"] },
  { cluster: "green_fruit", tier: 1, keys: ["apple", "gooseberry", "pear", "pear_drop", "quince", "grape"] },
  { cluster: "citrus_fruit", tier: 1, keys: ["grapefruit", "lemon_fruit", "lime", "orange_peel", "lemon_peel"] },
  { cluster: "stone_fruit", tier: 1, keys: ["peach", "apricot", "nectarine"] },
  { cluster: "tropical_fruit", tier: 1, keys: ["banana", "lychee", "mango", "melon", "passion_fruit", "pineapple"] },
  { cluster: "red_fruit", tier: 1, keys: ["redcurrant", "cranberry", "raspberry", "strawberry", "red_cherry", "red_plum"] },
  { cluster: "black_fruit", tier: 1, keys: ["blackcurrant", "blackberry", "bramble", "blueberry", "black_cherry", "black_plum"] },
  { cluster: "dried_cooked_fruit", tier: 1, keys: ["fig", "prune", "raisin", "sultana", "kirsch", "jamminess", "baked_stewed_fruit", "preserved_fruit"] },
  { cluster: "herbaceous", tier: 1, keys: ["green_bell_pepper", "grass", "tomato_leaf", "asparagus", "blackcurrant_leaf"] },
  { cluster: "herbal", tier: 1, keys: ["eucalyptus", "mint", "medicinal", "lavender", "fennel", "dill"] },
  { cluster: "pungent_spice", tier: 1, keys: ["black_pepper", "white_pepper", "liquorice"] },
  { cluster: "mineral_other", tier: 1, keys: ["flint", "wet_stone", "wet_wool"] },
  { cluster: "yeast_autolysis", tier: 2, keys: ["biscuit", "bread", "toast_yeast", "pastry", "brioche", "bread_dough", "cheese_yeast"] },
  { cluster: "malolactic", tier: 2, keys: ["butter", "cream", "cheese_mlf"] },
  { cluster: "oak", tier: 2, keys: ["vanilla", "cloves", "nutmeg_oak", "coconut", "butterscotch", "toast_oak", "cedar", "charred_wood", "smoke", "chocolate_oak", "coffee_oak", "resinous"] },
  { cluster: "deliberate_oxidation", tier: 3, keys: ["almond", "marzipan", "hazelnut", "walnut", "chocolate_ox", "coffee_ox", "toffee", "caramel"] },
  { cluster: "fruit_development_white", tier: 3, keys: ["dried_apricot", "marmalade", "dried_apple", "dried_banana"] },
  { cluster: "fruit_development_red", tier: 3, keys: ["fig_dev", "prune_dev", "tar", "dried_blackberry", "dried_cranberry", "cooked_blackberry", "cooked_red_plum"] },
  { cluster: "bottle_age_white", tier: 3, keys: ["petrol", "kerosene", "cinnamon", "ginger", "nutmeg_age", "toast_age", "nutty", "mushroom_white", "hay", "honey"] },
  { cluster: "bottle_age_red", tier: 3, keys: ["leather", "forest_floor", "earth", "mushroom_red", "game", "tobacco", "vegetal", "wet_leaves", "savoury", "meaty", "farmyard"] },
];

export const ALL_AROMA_KEYS = LEXICON.flatMap((c) => c.keys);
