// 買取店の紹介に使う公式サイトのキャプチャ。
// ⚠️ 画像は各社の公式ページを 2026-10-17 にヘッドレス Chrome で撮影したもの（public/images/shops/）。
//    撮り直したら CAPTURED_ON も更新する。撮影できなかった店は image を持たせない（画像なしで表示）。
export const CAPTURED_ON = "2026年10月17日";

export const SHOP_PAGES: Record<string, { image?: string; url: string }> = {
  jackroad: { image: "/images/shops/jackroad.webp", url: "https://www.jackroad.co.jp/shop/pages/j_rolex_kaitori.aspx" },
  quark: { image: "/images/shops/quark.webp", url: "https://www.909.co.jp/rolex_buy.html" },
  daikokuya: { image: "/images/shops/daikokuya.webp", url: "https://kaitori.e-daikoku.com/brand/brand/rolex_daytona.html" },
  nanboya: { image: "/images/shops/nanboya.webp", url: "https://nanboya.com/tokei-kaitori/" },
  watchnian: { image: "/images/shops/watchnian.webp", url: "https://watchnian.com/buy/categories/item_watch/brand_rolex/" },
};

// 比較している5社の並び順と、グラフで使う識別色（店ごとに固定。順位や件数で色を変えない）。
// ⚠️ 色は dataviz の検証スクリプトで隣接系列の色覚多様性チェックを通した5色。
//    水色・黄・桃は白背景で3:1未満のため、グラフには必ず凡例（店名と価格の文字）を併記する。
export const SHOP_IDS = ["nanboya", "daikokuya", "quark", "jackroad", "watchnian"] as const;
export const SHOP_COLORS: Record<string, string> = {
  nanboya: "#2a78d6",
  daikokuya: "#eb6834",
  quark: "#1baf7a",
  jackroad: "#eda100",
  watchnian: "#e87ba4",
};
