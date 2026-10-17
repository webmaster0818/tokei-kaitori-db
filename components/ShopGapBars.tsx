import { shopCeilings, type PriceRecord } from "@/lib/prices";
import { SHOP_COLORS, priceTypeLabel } from "@/lib/shops";

// 店舗間の差額の横棒。各社の上限系（上限・相場）の掲載額のうち最も高い行を1本ずつ、最も高い店に対する割合で描く。
// ⚠️ 対象は summarize() の「店舗間の差額」と同じ区分（上限・相場）。最下段の差額＝ページ上部の「店舗間の差額」になる。
//    「通常」の価格だけを公開している店はここに含めない（呼び出し側で注記する）。
// ⚠️ 値は型番ページの表と同じレコード。棒の長さは 0円起点（差を誇張しない）。
export function ShopGapBars({ records }: { records: PriceRecord[] }) {
  // 店ごとの代表値（lib/prices.ts shopCeilings。文字盤違いが複数行ある店はその中央値）
  const rows = shopCeilings(records);
  if (rows.length < 2) return null;
  const max = rows[0].price;
  const label = rows.map((r) => `${r.shop} ${r.price.toLocaleString("ja-JP")}円（${priceTypeLabel(r.shop_id, r.price_type)}${r.isMedian ? "・文字盤等の違いによる複数価格の中央値" : ""}）`).join("、");
  return (
    <div className="gapbars" role="img" aria-label={`各社の上限額・相場（買取店ごとの代表値）の比較: ${label}`}>
      {rows.map((r, i) => {
        const pct = (r.price / max) * 100;
        const diff = max - r.price;
        return (
          <div key={r.shop_id} className="gapbars__row" aria-hidden="true">
            <div className="gapbars__head">
              <span className="gapbars__name">
                <i style={{ background: SHOP_COLORS[r.shop_id] ?? "var(--ink-2)" }} />
                {r.shop}
                <small>{priceTypeLabel(r.shop_id, r.price_type)}{r.condition ? `・${r.condition}` : ""}{r.splitRows ? `・${r.splitRows}件の中央値` : r.isMedian ? "・複数価格の中央値" : ""}</small>
              </span>
              <span className="gapbars__val num">
                {r.price.toLocaleString("ja-JP")}円
                <small>{i === 0 ? "最高額" : diff === 0 ? "最高額と同額" : `差額 −${diff.toLocaleString("ja-JP")}円`}</small>
              </span>
            </div>
            <div className="gapbars__track">
              <div className={`gapbars__bar${i === 0 ? " is-top" : ""}`} style={{ width: `${pct.toFixed(2)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
