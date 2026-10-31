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
  /** 外れ値として公開・集計から外した値（scripts/fetch-watch-prices.py の hold_outliers）。生データには残す */
  held?: string;
  held_detail?: string;
  /** 店側の仕様区別（パーサが文字盤・素材以外の違いを持つ場合。例: ブレス・ダイヤ有無） */
  variant?: string;
  /**
   * 同じ店・同じ型番・同じ区分・同じ状態で、文字盤・素材などの区別なく複数の価格が並んでいたため、
   * 中央値1行にまとめた場合の元の値の範囲（collapseUndistinguished()）。
   */
  collapsed?: { n: number; min: number; max: number };
  /** 店の表記を公式の表記に直した行の注記（applyRowFix・data/ref-overrides.json fix_rows） */
  fixed_note?: string;
};

/**
 * 区別のつかない複数の価格を中央値1行にまとめる（2026-10-17 追加・全店共通の規則）。
 *
 * ⚠️ 例: なんぼや 124300（2026-10・相場）は文字盤違いの4つの値 1,285,000 / 2,154,000 / 2,207,000 / 3,410,000円を
 *    文字盤の記載なしで並べている。そのまま集計すると上限額（最高）が 3,410,000円、他社との差額も
 *    文字盤違いの差を「店舗間の差額」として出してしまう（実際は同じ店の中の差）。
 * - まとめる単位: 店・型番・区分・状態・月（月次公開の店）・モデル名・文字盤・素材・variant がすべて同じ行。
 *   文字盤・素材・variant・モデル名のいずれかが違う行は区別できているので、従来どおり別の行のまま残す。
 * - 値が1種類しかない（同額の重複）場合は1行にするだけで collapsed は付けない。
 * - 中央値は偶数個なら中央2値の平均（円未満切り捨て）。元の範囲は collapsed に持たせ、型番ページで併記する。
 */
export function collapseUndistinguished(rows: PriceRecord[]): PriceRecord[] {
  const groups = new Map<string, PriceRecord[]>();
  const order: string[] = [];
  for (const r of rows) {
    const k = [r.shop_id, r.ref, r.price_type, r.condition ?? "", r.price_month ?? "", r.model ?? "",
      r.dial ?? "", r.material ?? "", r.variant ?? ""].join("\u0000");
    const g = groups.get(k);
    if (g) g.push(r);
    else { groups.set(k, [r]); order.push(k); }
  }
  const out: PriceRecord[] = [];
  for (const k of order) {
    const g = groups.get(k)!;
    const vals = [...new Set(g.map((r) => r.price_jpy))].sort((a, b) => a - b);
    if (vals.length === 1) { out.push(g[0]); continue; }
    const all = g.map((r) => r.price_jpy).sort((a, b) => a - b);
    const mid = all.length >> 1;
    const median = all.length % 2 ? all[mid] : Math.floor((all[mid - 1] + all[mid]) / 2);
    out.push({ ...g[0], price_jpy: median, collapsed: { n: all.length, min: all[0], max: all[all.length - 1] } });
  }
  return out;
}

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
  // ⚠️ held（外れ値として保留した値。例: 先方の桁の誤記）はここで落とす。以降の集計・表示・公開判定は
  //    すべてこの関数を通るので、保留した値がページ・ランキング・公開型番数に混ざらない。
  //    区別のつかない複数の価格は中央値1行にまとめる（collapseUndistinguished）。
  const rows = fs.existsSync(p)
    ? collapseUndistinguished(((JSON.parse(fs.readFileSync(p, "utf8")).records ?? []) as PriceRecord[]).filter((r) => !r.held && !isHeldRow(r)).map(applyRowFix))
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
  topShop: { shop: string; price: number; source_url: string; condition?: string; dial?: string; isMedian?: boolean } | null;
  spread: number | null; // 店ごとの代表値（shopCeilings）の最高と最低の差
  /** 店ごとの代表値（上限・相場）。高い順 */
  ceilings: ShopCeiling[];
};

export type ShopCeiling = {
  shop: string;
  shop_id: string;
  /** 店の代表値（上限・相場の区分のみ） */
  price: number;
  condition?: string;
  price_type: PriceRecord["price_type"];
  source_url: string;
  /** 代表値が1行の値ならその文字盤（中央値のときは undefined） */
  dial?: string;
  /** 文字盤・仕様違いの複数行の中央値か（行数） */
  splitRows?: number;
  /** 代表値が中央値か（文字盤・仕様違いの複数行、または区別のない複数価格をまとめた行） */
  isMedian?: boolean;
};

const median = (vals: number[]) => {
  const v = [...vals].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : Math.floor((v[m - 1] + v[m]) / 2);
};

/**
 * 店ごとの「上限額」の代表値（2026-10-17 追加。上限額（最高）・店舗間の差額・ランキング・差額バー・推移の共通の定義）。
 *
 * ⚠️ 同じ店が文字盤・仕様違いで複数の価格を出している型番がある（例 124300: ターコイズ文字盤 約340万円／黒 約116万円）。
 *    店ごとの最大額で比べると、ある店のターコイズと別の店の黒を比べた差が「店舗間の差額」になってしまう。
 * - 区分「上限」「相場」の行だけを使う（従来どおり）。
 * - 状態（新品・未使用・中古）ごとに、その店の行の中央値を取る（文字盤違いが1行だけならその値）。
 * - 状態別の値のうち最も高いものをその店の代表値とする（文字盤違いが無い店では従来の「店ごとの最大額」と同じ値）。
 */
export function shopCeilings(records: PriceRecord[]): ShopCeiling[] {
  const by = new Map<string, PriceRecord[]>();
  for (const r of records) {
    if (r.price_type !== "上限" && r.price_type !== "相場") continue;
    const k = `${r.shop_id}\u0000${r.condition ?? ""}`;
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  const best = new Map<string, ShopCeiling>();
  for (const rows of by.values()) {
    const price = median(rows.map((r) => r.price_jpy));
    const r0 = rows[0];
    const cur = best.get(r0.shop_id);
    if (cur && cur.price >= price) continue;
    best.set(r0.shop_id, {
      shop: r0.shop, shop_id: r0.shop_id, price, condition: r0.condition, price_type: r0.price_type,
      source_url: r0.source_url, dial: rows.length === 1 ? (r0.dial ?? undefined) : undefined,
      splitRows: rows.length > 1 ? rows.length : undefined,
      isMedian: rows.length > 1 || !!r0.collapsed || undefined,
    });
  }
  return [...best.values()].sort((a, b) => b.price - a.price);
}

export function summarize(ref: string, date = latestDate()): RefSummary | null {
  const records = currentRecords(date).filter((r) => r.ref === ref);
  if (records.length === 0) return null;
  const reps = shopCeilings(records);
  const prices = reps.map((r) => r.price);
  const best = reps[0] ?? null;
  return {
    ref,
    models: (() => {
      const ms = [...new Set(records.map((r) => r.model).filter((m): m is string => !!m))];
      const o = refOverrides().name[ref];
      return o ? [o, ...ms.filter((m) => m !== o)] : ms;
    })(),
    records: [...records].sort((a, b) => b.price_jpy - a.price_jpy),
    shops: [...new Set(records.map((r) => r.shop))],
    ceilingMin: prices.length ? Math.min(...prices) : null,
    ceilingMax: prices.length ? Math.max(...prices) : null,
    topShop: best ? { shop: best.shop, price: best.price, source_url: best.source_url, condition: best.condition, dial: best.dial, isMedian: best.isMedian } : null,
    spread: prices.length > 1 ? Math.max(...prices) - Math.min(...prices) : null,
    ceilings: reps,
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
const publishableCache = new Map<string, string[]>();
// 行単位の保留（店の行名と公式が食い違い、別の時計の価格のおそれがある行）
let heldRowsCache: { ref: string; shop_id: string; model_contains?: string }[] | null = null;
export function isHeldRow(r: PriceRecord): boolean {
  if (!heldRowsCache) {
    const p = path.join(process.cwd(), "data", "ref-overrides.json");
    heldRowsCache = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")).hold_rows ?? []) : [];
  }
  return heldRowsCache!.some((h) => h.ref === r.ref && h.shop_id === r.shop_id && (!h.model_contains || (r.model ?? "").includes(h.model_contains)));
}

// 行の表記の訂正（data/ref-overrides.json fix_rows・2026-10-31）
// 店の掲載の文字盤・名称が公式（メーカー）と食い違う行を、公式の表記に直して表示する。
// match の値が今も店の掲載と同じときだけ置き換える（店が直したら自動で外れる）。価格・店・出典URLは変えない。
type RowFix = { ref: string; shop_id: string; match: Partial<Record<"model" | "dial" | "variant", string>>; set: Partial<Record<"model" | "dial" | "variant", string>> };
let rowFixCache: RowFix[] | null = null;
export function applyRowFix(r: PriceRecord): PriceRecord {
  if (!rowFixCache) {
    const p = path.join(process.cwd(), "data", "ref-overrides.json");
    rowFixCache = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")).fix_rows ?? []) : [];
  }
  const f = rowFixCache!.find((x) => x.ref === r.ref && x.shop_id === r.shop_id
    && Object.entries(x.match).every(([k, v]) => (r[k as keyof PriceRecord] ?? "") === v));
  if (!f) return r;
  const shopLabel = Object.values(f.match).map((v) => `「${v}」`).join("");
  return { ...r, ...f.set, fixed_note: `店の表記${shopLabel}を公式の表記に直しています` };
}

// 型番マスタの取り違えの手当て（data/ref-overrides.json）
let overridesCache: { name: Record<string, string>; hold: Record<string, string> } | null = null;
export function refOverrides() {
  if (overridesCache) return overridesCache;
  const p = path.join(process.cwd(), "data", "ref-overrides.json");
  const d = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
  overridesCache = { name: d.name ?? {}, hold: d.hold ?? {} };
  return overridesCache;
}

// 段階的な公開（data/publish-gate.json）。brands が null なら全ブランド。
function publishGateBrands(): Set<string> | null {
  const p = path.join(process.cwd(), "data", "publish-gate.json");
  if (!fs.existsSync(p)) return null;
  const b = JSON.parse(fs.readFileSync(p, "utf8")).brands;
  return Array.isArray(b) ? new Set<string>(b) : null;
}

export function publishableRefs(): string[] {
  // 全ページから何度も呼ばれるため、取得日ごとに1回だけ計算する（判定条件は従来どおり）
  const hit = publishableCache.get(latestDate());
  if (hit) return hit;
  const master = masterRefs();
  const gate = publishGateBrands();
  const refs = Object.keys(master);
  const out = refs.filter((ref) => {
    if (gate && !gate.has(master[ref]?.brand)) return false;
    if (refOverrides().hold[ref]) return false;
    const s = summarize(ref);
    // 複数店舗の価格が取れているものだけを公開する（比較サイトとして成立する最低条件）
    return !!s && s.records.length > 0 && s.shops.length >= 2;
  });
  publishableCache.set(latestDate(), out);
  return out;
}

export const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
