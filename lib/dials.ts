// 文字盤名の表記ゆれをそろえ、型番ページの「文字盤別の比較」を作る。
// 対応表は scripts/shops/dial-aliases.json（jiro-2 2026-10-17・{"標準名": ["表記1", …]}）。
// ⚠️ 対応表に無い表記（保留を含む）は元の表記のまま扱う＝同じ表記どうしだけが同じ文字盤になる。
// ⚠️ ロデオドライブの略号「GR」は、オーデマ・ピゲ・パテック フィリップ・オメガでは査定ページの文字盤色が「グレー」と
//    一致したためグレーとして扱う。ロレックスでは「プラチナ」等と食い違うため保留（GR のまま）。
//    （scripts/shops/dial-aliases.md・tomomi-2 判断 2026-10-17）
import aliases from "@/scripts/shops/dial-aliases.json";
import type { PriceRecord } from "./prices";

const MAP = new Map<string, string>();
for (const [std, list] of Object.entries(aliases as Record<string, string[]>)) {
  MAP.set(std, std);
  for (const a of list) MAP.set(a, std);
}
const GR_GREY_BRANDS = new Set(["オーデマ・ピゲ", "パテック フィリップ", "オメガ"]);

export function normalizeDial(raw: string | undefined | null, brand: string | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (t === "GR") return brand && GR_GREY_BRANDS.has(brand) ? "グレー" : "GR";
  return MAP.get(t) ?? MAP.get(t.normalize("NFKC")) ?? t;
}

const median = (vals: number[]) => {
  const v = [...vals].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : Math.floor((v[m - 1] + v[m]) / 2);
};

export type DialCell = { price: number; condition?: string; price_type: PriceRecord["price_type"]; n: number };
export type DialRow = {
  dial: string;
  /** 元の表記（標準名と違うものだけ） */
  rawNames: string[];
  cells: Record<string, DialCell>;
  max: number;
  min: number;
  gap: number;
};
export type DialComparison = { shops: { id: string; name: string }[]; rows: DialRow[] };

/**
 * 文字盤ごとに、2社以上が上限・相場の価格を出している文字盤だけを比べる。
 * 店の値は、店の代表値（lib/prices.ts shopCeilings）と同じ規則: 状態ごとの中央値のうち最も高いもの。
 */
export function dialComparison(records: PriceRecord[], brand: string | undefined): DialComparison | null {
  const by = new Map<string, Map<string, PriceRecord[]>>();
  const raw = new Map<string, Set<string>>();
  const names = new Map<string, string>();
  for (const r of records) {
    if (r.price_type !== "上限" && r.price_type !== "相場") continue;
    const d = normalizeDial(r.dial, brand);
    if (!d) continue;
    names.set(r.shop_id, r.shop);
    if (r.dial && r.dial.trim() !== d) (raw.get(d) ?? raw.set(d, new Set()).get(d)!).add(r.dial.trim());
    const m = by.get(d) ?? by.set(d, new Map()).get(d)!;
    m.set(r.shop_id, [...(m.get(r.shop_id) ?? []), r]);
  }
  const rows: DialRow[] = [];
  for (const [dial, m] of by) {
    if (m.size < 2) continue;
    const cells: Record<string, DialCell> = {};
    for (const [shop, rs] of m) {
      const byCond = new Map<string, PriceRecord[]>();
      for (const r of rs) byCond.set(r.condition ?? "", [...(byCond.get(r.condition ?? "") ?? []), r]);
      let best: DialCell | null = null;
      for (const g of byCond.values()) {
        const price = median(g.map((r) => r.price_jpy));
        if (!best || price > best.price) best = { price, condition: g[0].condition, price_type: g[0].price_type, n: g.length };
      }
      cells[shop] = best!;
    }
    const vals = Object.values(cells).map((c) => c.price);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    rows.push({ dial, rawNames: [...(raw.get(dial) ?? [])].sort(), cells, max, min, gap: max - min });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => b.max - a.max);
  const shopIds = [...new Set(rows.flatMap((r) => Object.keys(r.cells)))];
  const shops = shopIds.map((id) => ({ id, name: names.get(id) ?? id }));
  return { shops, rows };
}
