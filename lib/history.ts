// 型番ごとの日次履歴（data/history/<REF>.json）の読み込みと集計。
//
// ⚠️ 捏造しない: 返す値はすべて履歴ファイルの実レコード由来。補間・推定はしない。
// ⚠️ 「上限額（最高）」の定義は lib/prices.ts の summarize() と同じ
//    （区分「上限」「相場」の最大値。月次公開の店は型番ごとに最も新しい月を採る）。
//    最新日の値が summarize() と一致しない型番は、比較値（7日前比など）を出さない。
import fs from "node:fs";
import path from "node:path";
import { collapseUndistinguished, latestDate, shopCeilings, summarize, type PriceRecord } from "./prices";

type HistoryDay = { date: string; records: PriceRecord[] };

const HIST_DIR = path.join(process.cwd(), "data", "history");
const cache = new Map<string, HistoryDay[]>();

export function readHistory(ref: string): HistoryDay[] {
  const hit = cache.get(ref);
  if (hit) return hit;
  const p = path.join(HIST_DIR, `${ref}.json`);
  const days = fs.existsSync(p) ? ((JSON.parse(fs.readFileSync(p, "utf8")).days ?? []) as HistoryDay[]) : [];
  // 外れ値として保留した値（held）は推移・前日比にも使わない（lib/prices.ts の readSnapshot と同じ扱い）
  // 区別のつかない複数の価格は中央値1行にまとめる（型番ページ・集計と同じ規則）
  for (const d of days) d.records = collapseUndistinguished(d.records.filter((r) => !r.held));
  days.sort((a, b) => a.date.localeCompare(b.date));
  cache.set(ref, days);
  return days;
}

const DAY = 86400000;
export const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** その日のレコードのうち、月次公開の店は最も新しい月だけを残す（currentRecords と同じ考え方） */
function pickCurrent(records: PriceRecord[]): PriceRecord[] {
  const newest = new Map<string, string>();
  for (const r of records) {
    if (!r.price_month) continue;
    const cur = newest.get(r.shop_id);
    if (!cur || r.price_month > cur) newest.set(r.shop_id, r.price_month);
  }
  return records.filter((r) => !r.price_month || newest.get(r.shop_id) === r.price_month);
}

export type CeilingPoint = { date: string; max: number; shop: string; shops: string[] };

/** 日ごとの上限額（最高）と、上限系の価格を出している店の一覧 */
function ceilingOn(day: HistoryDay): CeilingPoint | null {
  // 型番ページの「上限額（最高）」と同じ定義（店ごとの代表値 shopCeilings の最大）
  const reps = shopCeilings(pickCurrent(day.records));
  if (!reps.length) return null;
  return { date: day.date, max: reps[0].price, shop: reps[0].shop, shops: reps.map((r) => r.shop_id).sort() };
}

export type CeilingChange = {
  days: number;
  now: CeilingPoint;
  then: CeilingPoint;
  diff: number;
  pct: number;
  /** 比較した2日で、上限系の価格を出している店の顔ぶれが同じか */
  sameShops: boolean;
};

/**
 * 上限額（最高）の N 日前比。
 * 比較元は「N日前の日付」の履歴。欠けている場合は、その前3日以内で最も近い日を使う。
 * それも無い場合、または最新日の値が型番ページの表示値と一致しない場合は null（出さない）。
 */
export function ceilingChange(ref: string, days: number): CeilingChange | null {
  const hist = readHistory(ref);
  const date = latestDate();
  const last = hist[hist.length - 1];
  if (!last || last.date !== date) return null;
  const now = ceilingOn(last);
  const s = summarize(ref);
  if (!now || !s || s.ceilingMax == null || now.max !== s.ceilingMax) return null;
  const target = toMs(date) - days * DAY;
  let then: CeilingPoint | null = null;
  for (let i = hist.length - 1; i >= 0; i--) {
    const t = toMs(hist[i].date);
    if (t > target) continue;
    if (t < target - 3 * DAY) break;
    then = ceilingOn(hist[i]);
    if (then) break;
  }
  if (!then) return null;
  const diff = now.max - then.max;
  return {
    days,
    now,
    then,
    diff,
    pct: then.max ? diff / then.max : 0,
    sameShops: now.shops.join(",") === then.shops.join(","),
  };
}

export type Series = {
  key: string;
  shopId: string;
  shop: string;
  priceType: string;
  /** 月ごとに公開される値（なんぼやの相場）か */
  monthly: boolean;
  points: { t: number; v: number; label: string }[];
};

/**
 * 価格推移グラフ用の系列。店×区分ごとに1本。
 * - 日次公開の店: 取得日（fetched_at）ごとに、その店・その区分の最大額。取得元を閲覧できず
 *   前日の値を引き継いだ日は同じ取得日になるので、1点にまとめる。
 * - 月次公開の店（なんぼや「相場」）: 日ごとに、その日に掲載されていた最新月の値。
 */
export function priceSeries(ref: string): { series: Series[]; start: number; end: number } | null {
  const hist = readHistory(ref);
  if (hist.length < 2) return null;
  const start = toMs(hist[0].date);
  const end = toMs(hist[hist.length - 1].date);
  // ⚠️ なんぼやの「相場」は月次の値だが、当月分は月の途中でも毎日更新される（実測: 126500LN の 2026-10 分が
  //    10/10 5,959,000円 → 10/17 5,900,000円）。月ごとに1つの値として描くと事実と異なるため、
  //    日ごとに「その日に掲載されていた最新月の値」（型番ページと同じ採り方）を点として描く。
  const daily = new Map<string, { shopId: string; shop: string; priceType: string; monthly: boolean; byDate: Map<string, number> }>();
  for (const day of hist) {
    // 店×区分×状態ごとに行をまとめ、文字盤・仕様違いの複数行は中央値、状態別の値の最大をその日の値とする
    // （上限額（最高）の定義 shopCeilings と同じ考え方。文字盤違いの高い行だけを線にしない）
    const groups = new Map<string, PriceRecord[]>();
    for (const r of pickCurrent(day.records)) {
      const gk = `${r.shop_id}:${r.price_type}:${r.condition ?? ""}`;
      groups.set(gk, [...(groups.get(gk) ?? []), r]);
    }
    for (const rows of groups.values()) {
      const r = rows[0];
      const key = `${r.shop_id}:${r.price_type}`;
      const e = daily.get(key) ?? { shopId: r.shop_id, shop: r.shop, priceType: r.price_type, monthly: !!r.price_month, byDate: new Map() };
      const d = r.price_month ? day.date : r.fetched_at || day.date;
      const vals = rows.map((x) => x.price_jpy).sort((x, y) => x - y);
      const m = vals.length >> 1;
      const med = vals.length % 2 ? vals[m] : Math.floor((vals[m - 1] + vals[m]) / 2);
      e.byDate.set(d, Math.max(e.byDate.get(d) ?? 0, med));
      daily.set(key, e);
    }
  }
  const series: Series[] = [];
  for (const [key, e] of daily) {
    const points = [...e.byDate.entries()]
      .map(([d, v]) => ({ t: toMs(d), v, label: d }))
      .filter((p) => p.t >= start && p.t <= end)
      .sort((a, b) => a.t - b.t);
    if (points.length) series.push({ key, shopId: e.shopId, shop: e.shop, priceType: e.priceType, monthly: e.monthly, points });
  }
  return { series, start, end };
}
