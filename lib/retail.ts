// メーカー公式サイトに表示されている小売価格（data/retail/<型番の英数字・小文字>.json・taro-2 2026-10-17）。
// ⚠️ 値は公式ページ（またはその Wayback 保存版）に表示されていた日本円の価格だけ。換算・推測はしない。
// ⚠️ tax_included はページの表記どおり（true / null）。null のときに「税込」と書かない（推測で補わない）。
// ⚠️ 小売価格と買取価格は日付も出典も違う。割合は参考値としてしか出さない（画面にも必ず注記する）。
import fs from "node:fs";
import path from "node:path";
import type { RefSummary } from "./prices";

export type RetailPoint = {
  price_jpy: number;
  tax_included: boolean | null;
  tax_note?: string;
  as_of: string;
  url: string;
  archive?: string;
  snapshot?: string;
};

type RetailJson = { ref: string; brand: string; model: string; prices: RetailPoint[]; checked?: string };

export type RetailView = {
  ref: string;
  /** 確認日の古い順 */
  points: RetailPoint[];
  latest: RetailPoint;
  checked?: string;
};

const alnum = (s: string) => s.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");

const cache = new Map<string, RetailView | null>();

export function retailFor(ref: string): RetailView | null {
  if (cache.has(ref)) return cache.get(ref)!;
  const p = path.join(process.cwd(), "data", "retail", `${alnum(ref).toLowerCase()}.json`);
  let view: RetailView | null = null;
  if (fs.existsSync(p)) {
    const d = JSON.parse(fs.readFileSync(p, "utf8")) as RetailJson;
    // ⚠️ ファイル名は英数字だけに潰した名前なので、別の型番と衝突していないか中身の ref で確かめる
    if (alnum(d.ref) === alnum(ref)) {
      const points = (d.prices ?? [])
        .filter((x) => Number.isInteger(x.price_jpy) && x.price_jpy > 0 && /^\d{4}-\d{2}-\d{2}$/.test(x.as_of) && x.url)
        .sort((a, b) => a.as_of.localeCompare(b.as_of));
      if (points.length) view = { ref: d.ref, points, latest: points[points.length - 1], checked: d.checked };
    }
  }
  cache.set(ref, view);
  return view;
}

/** 「公式サイトの表示価格」の後ろに付ける税表記。ページに税込と書かれていたときだけ */
export const taxLabel = (p: RetailPoint) => (p.tax_included === true ? "（消費税込）" : "");

/** 上限額（最高）÷ 最新の公式小売価格。どちらかが無ければ null */
export function retailRatio(s: RefSummary, r: RetailView | null): number | null {
  if (!r || s.ceilingMax == null) return null;
  return s.ceilingMax / r.latest.price_jpy;
}

/** 0.0–… → 「128%」 */
export const pct0 = (v: number) => `${Math.round(v * 100)}%`;
