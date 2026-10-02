// 買取価格データの読み込みと集計。捏造しない: 表示する数値は全て data/prices の実レコードに由来する。
import fs from "node:fs";
import path from "node:path";

export type PriceRecord = {
  shop: string;
  shop_id: string;
  ref: string;
  model?: string;
  dial?: string;
  material?: string;
  price_type: "上限" | "通常" | "相場";
  condition?: string;
  price_jpy: number;
  price_month?: string;
  source_url: string;
  page_updated?: string | null;
  fetched_at: string;
};

const DATA_DIR = path.join(process.cwd(), "data", "prices");

export function snapshotDates(): string[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort();
}

export function latestDate(): string {
  const d = snapshotDates();
  return d[d.length - 1] ?? "";
}

// ⚠️ 呼ばれるたびにJSONを読み直していたため、レコードが8,500件規模になった時点で
//    ビルドが1ページ60秒を超えて失敗した（summarize / monthlyHistory が各ページで複数回呼ぶ）。
//    日付ごとに1回だけ読んで使い回す。
const snapshotCache = new Map<string, PriceRecord[]>();

function readSnapshot(date: string): PriceRecord[] {
  const hit = snapshotCache.get(date);
  if (hit) return hit;
  const p = path.join(DATA_DIR, `${date}.json`);
  const rows = fs.existsSync(p)
    ? ((JSON.parse(fs.readFileSync(p, "utf8")).records ?? []) as PriceRecord[])
    : [];
  snapshotCache.set(date, rows);
  return rows;
}

/** 当日スナップショット(なんぼやの過去月履歴は除外) */
const currentCache = new Map<string, PriceRecord[]>();
const monthCache = new Map<string, string>();

/**
 * 採用する月＝「データに実在する最新の月」。
 *
 * ⚠️ 以前は暦の当月で絞っていたが、なんぼやは月次公開なので毎月1日は当月データが
 *    まだ存在せず、なんぼやのレコードが丸ごと落ちて公開型番が 189→60 に激減した
 *    （2026-09-01に実際に発生）。暦ではなくデータ実体に合わせる。
 */
export function latestPriceMonth(date = latestDate()): string {
  const hit = monthCache.get(date);
  if (hit) return hit;
  const months = readSnapshot(date)
    .map((r) => r.price_month)
    .filter((m): m is string => !!m);
  const m = months.length ? months.reduce((a, b) => (a > b ? a : b)) : date.slice(0, 7);
  monthCache.set(date, m);
  return m;
}

/** 月次公開の店について、採用してよい最も古い月（これより古い価格は載せない） */
const STALE_MONTHS = 3;

function monthsBefore(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * 掲載に使うレコード。
 *
 * ⚠️ 「最新月のレコードだけ」にすると、月次公開の店（なんぼや）が今月の一覧から
 *    落とした型番のページが毎月まとめて消える。2026-10-01の月替わりで**32ページが
 *    404になり、うち20ページは直近28日に検索表示があった**（最大76表示・クリックあり）。
 *    毎月これを繰り返すとインデックスが育たない。
 *
 * そこで月次公開の店は「型番ごとに、持っている中で最も新しい月」を採る。
 * 9月の価格でも先方が実際に公開した価格なので、取得月を明記すれば事実に反しない。
 * ただし古すぎるものは載せない（STALE_MONTHS か月より前は捨てる）。
 */
export function currentRecords(date = latestDate()): PriceRecord[] {
  const hit = currentCache.get(date);
  if (hit) return hit;
  const month = latestPriceMonth(date);
  const floor = monthsBefore(month, STALE_MONTHS);
  const rows: PriceRecord[] = [];
  // 型番×店ごとに、採用した月を覚えておく（同じ店の古い月を二重に出さない）
  const picked = new Map<string, string>();
  for (const r of readSnapshot(date)) {
    if (!r.price_month) { rows.push(r); continue; }   // 日次公開の店はそのまま
    if (r.price_month < floor) continue;              // 古すぎる
    const key = `${r.ref}\u0000${r.shop}`;
    const cur = picked.get(key);
    if (!cur || r.price_month > cur) picked.set(key, r.price_month);
  }
  for (const r of readSnapshot(date)) {
    if (!r.price_month) continue;
    if (picked.get(`${r.ref}\u0000${r.shop}`) === r.price_month) rows.push(r);
  }
  currentCache.set(date, rows);
  return rows;
}

/** なんぼやの月次履歴(型番別・古い順) */
export function monthlyHistory(ref: string, date = latestDate()) {
  const rows = readSnapshot(date).filter((r) => r.ref === ref && r.price_month);
  const byMonth = new Map<string, PriceRecord>();
  for (const r of rows) if (!byMonth.has(r.price_month!)) byMonth.set(r.price_month!, r);
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, r]) => ({ month, price: r.price_jpy, source_url: r.source_url }));
}

export type RefSummary = {
  ref: string;
  models: string[];
  records: PriceRecord[];
  shops: string[];
  ceilingMin: number | null;
  ceilingMax: number | null;
  topShop: { shop: string; price: number; source_url: string; condition?: string; dial?: string } | null;
  spread: number | null; // 最高提示と最低提示(上限系)の差
};

export function summarize(ref: string, date = latestDate()): RefSummary | null {
  const records = currentRecords(date).filter((r) => r.ref === ref);
  if (records.length === 0) return null;
  const ceilings = records.filter((r) => r.price_type === "上限" || r.price_type === "相場");
  const prices = ceilings.map((r) => r.price_jpy);
  const best = ceilings.reduce<PriceRecord | null>((a, b) => (!a || b.price_jpy > a.price_jpy ? b : a), null);
  return {
    ref,
    models: [...new Set(records.map((r) => r.model).filter((m): m is string => !!m))],
    records: [...records].sort((a, b) => b.price_jpy - a.price_jpy),
    shops: [...new Set(records.map((r) => r.shop))],
    ceilingMin: prices.length ? Math.min(...prices) : null,
    ceilingMax: prices.length ? Math.max(...prices) : null,
    topShop: best ? { shop: best.shop, price: best.price_jpy, source_url: best.source_url, condition: best.condition, dial: best.dial } : null,
    spread: prices.length > 1 ? Math.max(...prices) - Math.min(...prices) : null,
  };
}

export type MasterRef = { brand: string; models: string[]; shops: string[] };

/** 型番マスタ (data/watch-master.json) */
export function masterRefs(): Record<string, MasterRef> {
  const p = path.join(process.cwd(), "data", "watch-master.json");
  if (!fs.existsSync(p)) return {};
  return (JSON.parse(fs.readFileSync(p, "utf8")).refs ?? {}) as Record<string, MasterRef>;
}

export function prototypeRefs(): string[] {
  const p = path.join(process.cwd(), "data", "prototype-refs.json");
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as string[]) : [];
}

/**
 * ページを生成する型番の一覧。
 *
 * 以前は prototype-refs.json（10件）に限定していたが、
 * 実データは97型番すべてに存在するため全件を対象にする。
 * ⚠️ ただし「価格レコードが1件も無い型番」はページを作らない。
 *    中身の無いページを量産すると Scaled Content と判定されるため
 *    （takushoku-biyori でスパム扱いを受けた前例あり）。
 */
export function publishableRefs(): string[] {
  const refs = Object.keys(masterRefs());
  return refs.filter((ref) => {
    const s = summarize(ref);
    // 複数店舗の価格が取れているものだけを公開する（比較サイトとして成立する最低条件）
    return !!s && s.records.length > 0 && s.shops.length >= 2;
  });
}

export const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
