// /data/refs.json — 公開中の型番の一覧（機械可読）。llms.txt から案内する。
// ⚠️ 出力はビルド時の静的ファイル。値は型番ページと同じ summarize() の実データだけ。
// ⚠️ scripts/generate-sitemap.mjs が latest_date を各型番の <lastmod> に使う。キー名を変えるときは両方直す。
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { latestDate } from "@/lib/prices";
import { hubsFor, publishedRows, refPath } from "@/lib/insights";

export const dynamic = "force-static";

export function GET() {
  const rows = publishedRows();
  const body = {
    site: SITE_NAME,
    url: `${SITE_URL}/`,
    updated: latestDate(),
    description:
      "買取店が自社サイトで公開している腕時計の型番別買取価格を毎日取得し、2社以上の価格がそろった型番を比較したデータです。max_ceiling_jpy は区分「上限」「相場」の価格の買取店ごとの代表値（同じ買取店に文字盤・仕様違いの複数価格がある場合は状態ごとの中央値）のうち最も高いもの、spread_jpy は代表値の最高額と最低額の差です。",
    count: rows.length,
    refs: rows
      .slice()
      .sort((a, b) => a.ref.localeCompare(b.ref))
      .map((r) => {
        const { fam, brand } = hubsFor(r.ref);
        return {
          ref: r.ref,
          brand: r.brand,
          model: r.model,
          model_family: fam?.label ?? null,
          max_ceiling_jpy: r.s.ceilingMax,
          min_ceiling_jpy: r.s.ceilingMin,
          spread_jpy: r.s.spread,
          top_shop: r.s.topShop?.shop ?? null,
          shop_count: r.s.shops.length,
          shops: r.s.shops,
          latest_date: r.latest,
          url: `${SITE_URL}${refPath(r.ref)}`,
          model_url: fam ? `${SITE_URL}/model/${fam.slug}/` : null,
          brand_url: brand ? `${SITE_URL}/brand/${brand.slug}/` : null,
        };
      }),
  };
  return new Response(JSON.stringify(body, null, 1), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
