// ランキング・買取店ページ・関連リンクの集計。
// ⚠️ 対象は「いま公開している型番」（publishableRefs）だけ。数値はすべて summarize() と
//    data/history の実レコード由来で、型番ページに出している値と同じものしか使わない。
import { latestDate, masterRefs, publishableRefs, summarize, type RefSummary } from "./prices";
import { familyOfRef, publishedBrandOf, publishedFamilyOfRef } from "./models";
import { ceilingChange, type CeilingChange } from "./history";
import { SHOP_IDS, SHOP_PAGES } from "./shops";
import { retailFor, retailRatio, type RetailView } from "./retail";

export type RefRow = {
  ref: string;
  model: string;
  brand: string;
  s: RefSummary;
  latest: string; // その型番で最も新しい取得日
};

let rowsCache: { date: string; rows: RefRow[] } | null = null;

export function publishedRows(): RefRow[] {
  const date = latestDate();
  if (rowsCache?.date === date) return rowsCache.rows;
  const master = masterRefs();
  const rows = publishableRefs()
    .map((ref) => {
      const s = summarize(ref)!;
      const latest = s.records.map((r) => r.fetched_at).filter(Boolean).sort().pop() ?? date;
      return { ref, model: s.models[0] ?? master[ref]?.models?.[0] ?? "", brand: master[ref]?.brand ?? "", s, latest };
    });
  rowsCache = { date, rows };
  return rows;
}

export const refPath = (ref: string) => `/ref/${ref.toLowerCase()}/`;

/** 店舗間の差額が大きい順 */
export function topSpread(n: number): RefRow[] {
  return publishedRows()
    .filter((r) => (r.s.spread ?? 0) > 0)
    .sort((a, b) => (b.s.spread ?? 0) - (a.s.spread ?? 0) || a.ref.localeCompare(b.ref))
    .slice(0, n);
}

/** 上限額（最高）が高い順 */
export function topCeiling(n: number): RefRow[] {
  return publishedRows()
    .filter((r) => r.s.ceilingMax != null)
    .sort((a, b) => (b.s.ceilingMax ?? 0) - (a.s.ceilingMax ?? 0) || a.ref.localeCompare(b.ref))
    .slice(0, n);
}

export type RetailRow = RefRow & { retail: RetailView; ratio: number };

/** 上限額（最高）÷ 最新の公式小売価格が高い順（公開中で公式小売価格のある型番だけ） */
export function topRetailRatio(n: number): RetailRow[] {
  const out: RetailRow[] = [];
  for (const r of publishedRows()) {
    const retail = retailFor(r.ref);
    const ratio = retailRatio(r.s, retail);
    if (retail && ratio != null) out.push({ ...r, retail, ratio });
  }
  return out.sort((a, b) => b.ratio - a.ratio || a.ref.localeCompare(b.ref)).slice(0, n);
}

export type MoveRow = RefRow & { c: CeilingChange };

/**
 * 直近7日の上限額（最高）の変化。
 * ⚠️ 上限系の価格を出している店の顔ぶれが7日前と同じ型番に限る。店が増減しただけの
 *    変化（掲載終了・新規掲載）を「上がった／下がった」と表示しないため。
 */
export function moves(days = 7): MoveRow[] {
  const out: MoveRow[] = [];
  for (const r of publishedRows()) {
    const c = ceilingChange(r.ref, days);
    if (c && c.sameShops && c.diff !== 0) out.push({ ...r, c });
  }
  return out;
}
export const topUp = (n: number, days = 7) =>
  moves(days).filter((m) => m.c.diff > 0).sort((a, b) => b.c.pct - a.c.pct || b.c.diff - a.c.diff).slice(0, n);
export const topDown = (n: number, days = 7) =>
  moves(days).filter((m) => m.c.diff < 0).sort((a, b) => a.c.pct - b.c.pct || a.c.diff - b.c.diff).slice(0, n);

/** 同じ価格帯（上限額（最高）±15%）で、別モデルの型番。近い順に n 件 */
export function similarPriced(ref: string, n = 6, band = 0.15): RefRow[] {
  const rows = publishedRows();
  const me = rows.find((r) => r.ref === ref);
  const base = me?.s.ceilingMax;
  if (!me || base == null) return [];
  const myFam = familyOfRef(ref)?.slug ?? null;
  return rows
    .filter((r) => r.ref !== ref && r.s.ceilingMax != null)
    .filter((r) => {
      const fam = familyOfRef(r.ref)?.slug ?? null;
      return myFam ? fam !== myFam : r.model !== me.model;
    })
    .filter((r) => Math.abs((r.s.ceilingMax as number) - base) <= base * band)
    .sort((a, b) => Math.abs((a.s.ceilingMax as number) - base) - Math.abs((b.s.ceilingMax as number) - base) || a.ref.localeCompare(b.ref))
    .slice(0, n);
}

export type ShopStat = {
  id: string;
  name: string;
  refs: RefRow[];
  brands: string[];
  types: string[];
  /** 上限額（最高）をその店が出している型番（同額で並ぶ場合は両方の店に数える） */
  topRefs: RefRow[];
  /** 上限系（上限・相場）の価格を出している型番の数＝最高額になり得る型番数 */
  ceilingRefs: number;
  sourceUrls: string[];
  officialUrl?: string;
  image?: string;
};

let shopCache: { date: string; stats: ShopStat[] } | null = null;

export function shopStats(): ShopStat[] {
  const date = latestDate();
  if (shopCache?.date === date) return shopCache.stats;
  // ⚠️ 一覧に無いブランド（8社化で増えたパテック フィリップ・チューダー等）は末尾へ（indexOf の -1 で先頭に来ないように）
  const brandOrder = ["ロレックス", "オメガ", "オーデマ・ピゲ", "ヴァシュロン・コンスタンタン", "パテック フィリップ", "カルティエ", "チューダー", "IWC", "パネライ", "ウブロ", "グランドセイコー"];
  const bi = (b: string) => (brandOrder.indexOf(b) < 0 ? 99 : brandOrder.indexOf(b));
  const map = new Map<string, ShopStat>();
  for (const id of SHOP_IDS) {
    map.set(id, { id, name: "", refs: [], brands: [], types: [], topRefs: [], ceilingRefs: 0, sourceUrls: [], officialUrl: SHOP_PAGES[id]?.url, image: SHOP_PAGES[id]?.image });
  }
  for (const row of publishedRows()) {
    const byShop = new Map<string, typeof row.s.records>();
    for (const r of row.s.records) byShop.set(r.shop_id, [...(byShop.get(r.shop_id) ?? []), r]);
    for (const [id, recs] of byShop) {
      const st = map.get(id);
      if (!st) continue;
      st.name = recs[0].shop;
      st.refs.push(row);
      if (row.brand && !st.brands.includes(row.brand)) st.brands.push(row.brand);
      for (const r of recs) {
        if (!st.types.includes(r.price_type)) st.types.push(r.price_type);
        if (!st.sourceUrls.includes(r.source_url)) st.sourceUrls.push(r.source_url);
      }
      const ceil = recs.filter((r) => r.price_type === "上限" || r.price_type === "相場");
      if (ceil.length) {
        st.ceilingRefs++;
        // 上限額（最高）は店ごとの代表値（shopCeilings）の最大なので、比べるのも代表値
        const rep = row.s.ceilings.find((c) => c.shop_id === id);
        if (row.s.ceilingMax != null && rep && rep.price === row.s.ceilingMax) st.topRefs.push(row);
      }
    }
  }
  const stats = [...map.values()].filter((s) => s.refs.length > 0);
  for (const s of stats) {
    s.brands.sort((a, b) => bi(a) - bi(b));
    s.topRefs.sort((a, b) => (b.s.ceilingMax ?? 0) - (a.s.ceilingMax ?? 0));
    s.sourceUrls.sort();
  }
  shopCache = { date, stats };
  return stats;
}

export function hubsFor(ref: string) {
  const master = masterRefs();
  return { fam: publishedFamilyOfRef(ref), brand: publishedBrandOf(master[ref]?.brand) };
}

/** 円 → 「123.4万円」 */
export function man(n: number): string {
  const v = n / 10000;
  const s = Number.isInteger(v) ? v.toLocaleString("ja-JP") : v.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
  return `${s}万円`;
}

export function signedYen(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString("ja-JP")}円`;
}

export function signedPct(p: number): string {
  const v = Math.round(p * 1000) / 10;
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}%`;
}
