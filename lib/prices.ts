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

export function currentRecords(date = latestDate()): PriceRecord[] {
  const hit = currentCache.get(date);
  if (hit) return hit;
  const month = date.slice(0, 7);
  const rows = readSnapshot(date).filter((r) => !r.price_month || r.price_month === month);
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
