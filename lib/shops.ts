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
  rodeodrive: { image: "/images/shops/rodeodrive.webp", url: "https://kaitori.rodeodrive.co.jp/brand/rolex/" },
  ginzarasin: { image: "/images/shops/ginzarasin.webp", url: "https://www.kaitori-ginza.com/rolex/" },
  galleryrare: { image: "/images/shops/galleryrare.webp", url: "https://galleryrare.jp/watch/rolex/" },
};

// 比較している8社の並び順と、グラフで使う識別色（店ごとに固定。順位や件数で色を変えない）。
// ⚠️ 色は dataviz の検証スクリプトで隣接系列の色覚多様性チェックを通した8色（2026-10-17 に緑・紫・赤を追加して再検証:
//    明度帯・彩度・CVD 隣接 ΔE 9.1 以上・通常視 ΔE 19.6 以上ですべて PASS）。既存5社の色は変えていない。
//    水色・黄・桃は白背景で3:1未満のため、グラフには必ず凡例（店名と価格の文字）を併記する。
export const SHOP_IDS = ["nanboya", "daikokuya", "quark", "jackroad", "watchnian", "rodeodrive", "ginzarasin", "galleryrare"] as const;
export const SHOP_COLORS: Record<string, string> = {
  nanboya: "#2a78d6",
  daikokuya: "#eb6834",
  quark: "#1baf7a",
  jackroad: "#eda100",
  watchnian: "#e87ba4",
  rodeodrive: "#008300",
  ginzarasin: "#4a3aa7",
  galleryrare: "#e34948",
};

/**
 * キャンペーンの加算を含む「上限」を公開している店（2026-10-17 フェーズ2・saburo-2 指摘・同日に先方ページで確認）。
 * ⚠️ ジャックロードの買取価格表は「通常買取価格／上限買取価格／査定10%UP＋10000円上乗せ適用」の3列で、
 *    パーサ（scripts/fetch-watch-prices.py parse_jackroad）が「上限」として取っているのは3列目＝キャンペーン加算後の額
 *    （例 126500LN ブラック: 4,220,000円 → 4,652,000円＝×1.1＋1万円）。
 *    集計（上限額（最高）・店舗間の差額・ランキング）には他社の上限と同じく含め、表・差額バー・注記で明示する。
 * ⚠️ 先方が列の構成を変えた場合はここを見直す（パーサは列見出しを見ていない）。
 */
export const CAMPAIGN_CEILING: Record<string, { label: string; note: string }> = {
  jackroad: {
    label: "上限（キャンペーン加算後）",
    note: "ジャックロードの「上限」は、同社の買取価格表のうち「査定10%UP＋10000円上乗せ適用」の欄の金額（キャンペーンによる加算後の額）です。当サイトでは他社の上限額と同じく集計に含めています。加算の条件は同社の公開ページでご確認ください。",
  },
};

/** 表・凡例に出す区分名（キャンペーン加算後の上限はそれと分かる名前にする） */
export function priceTypeLabel(shopId: string, priceType: string): string {
  return priceType === "上限" && CAMPAIGN_CEILING[shopId] ? CAMPAIGN_CEILING[shopId].label : priceType;
}
