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
