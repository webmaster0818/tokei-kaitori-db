// サイト共通設定。canonical/sitemap/OGPはすべてここを見る。
// ⚠️ フォールバックを本番ドメインに固定してある。env頼りにすると、日次cronが
//    NEXT_PUBLIC_SITE_URL を持たずにビルドした瞬間に全canonicalが壊れる。
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://brandwatchbank.com";
export const SITE_NAME = "時計買取相場データベース";
export const SITE_TAGLINE = "型番ごとの買取価格を複数店で毎日比較";
