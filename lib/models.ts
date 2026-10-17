// モデル家族（デイトナ／サブマリーナー等）の定義と、型番→家族の判定。
//
// ■ なぜ要るか（2026-09-21 GSC実測）
//   流入クエリが「116719blro 買取」のような**型番クエリだけ**で、
//   「デイトナ 買取相場」のようなモデル名クエリが1件も来ていなかった。
//   原因は /ref/{型番}/ しかページが無く、モデル名の受け皿がゼロだったこと。
//
// ■ 2026-10-17 フェーズ2: 定義を jiro-2 の調査（scripts/shops/families-proposal.json・78コレクション・11ブランド）に置き換えた。
//   判定は lib/family-match.mjs（scripts/generate-redirects.mjs と共有）。**ブランドの一致を必須**にした
//   （チューダー「プリンスオイスターデイト サブマリーナー」がロレックスのサブマリーナーに入るのを防ぐ）。
import fs from "node:fs";
import path from "node:path";
import { masterRefs, publishableRefs } from "./prices";
import familiesData from "./families.json";
import { matchFamily } from "./family-match.mjs";

export type Family = {
  slug: string;
  /** 表示名（メーカー公式の表記） */
  label: string;
  brand: string;
  keys: string[];
  fallback?: boolean;
  refs?: string[];
  /** 既存ページの title / description に使う旧表記（label を公式表記に改めた家族のみ。URL・title を変えないため） */
  seoLabel?: string;
  source?: string | null;
};

// ⚠️ 定義の実体は lib/families.json（scripts/generate-redirects.mjs と共有するため）。
export const FAMILIES: Family[] = familiesData.families as Family[];

export const BRANDS: { slug: string; label: string }[] = familiesData.brands;

/** 型番の家族を判定する（ブランド一致・振り分け済み一覧→キーの最長一致→fallback） */
export function familyOf(brand: string | undefined, models: string[], ref?: string): Family | null {
  return matchFamily(FAMILIES, brand, models, ref) as Family | null;
}

/** 型番から家族を判定する（マスタのブランド・モデル名を使う） */
export function familyOfRef(ref: string): Family | null {
  const m = masterRefs()[ref];
  return m ? familyOf(m.brand, m.models ?? [], ref) : null;
}

let famCache: Record<string, string[]> | null = null;
/** 家族slug → 公開可能な型番一覧（publishableRefs＝段階公開のブランドだけ） */
export function refsByFamily(): Record<string, string[]> {
  if (famCache) return famCache;
  const master = masterRefs();
  const out: Record<string, string[]> = {};
  for (const ref of publishableRefs()) {
    const f = familyOf(master[ref]?.brand, master[ref]?.models ?? [], ref);
    if (!f) continue;
    (out[f.slug] ??= []).push(ref);
  }
  famCache = out;
  return out;
}

export function refsByBrand(): Record<string, string[]> {
  const master = masterRefs();
  const out: Record<string, string[]> = {};
  for (const ref of publishableRefs()) {
    const b = BRANDS.find((x) => x.label === master[ref]?.brand);
    if (!b) continue;
    (out[b.slug] ??= []).push(ref);
  }
  return out;
}

/** ページを生成する最低型番数。これ未満の家族はハブを作らない（比較にならないため） */
export const MIN_REFS = 2;

/**
 * 既に公開しているハブ（main の sitemap に載っていたモデル／ブランドのページ。data/hub-keep.json）。
 * ⚠️ 既存の URL を消さないため、型番が1件に減っても（0件でなければ）ページを残す。
 *    0件になった家族は scripts/generate-redirects.mjs がブランドのハブへ 301 で転送する。
 */
function hubKeep(): { models: string[]; brands: string[] } {
  const p = path.join(process.cwd(), "data", "hub-keep.json");
  if (!fs.existsSync(p)) return { models: [], brands: [] };
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { models: j.models ?? [], brands: j.brands ?? [] };
}

/** ハブ（/model/<slug>/）を作る家族 */
export function publishedFamilies(): Family[] {
  const byFam = refsByFamily();
  const keep = new Set(hubKeep().models);
  return FAMILIES.filter((f) => {
    const n = byFam[f.slug]?.length ?? 0;
    return n >= MIN_REFS || (keep.has(f.slug) && n >= 1);
  });
}

/** ハブ（/brand/<slug>/）を作るブランド */
export function publishedBrands() {
  const byBrand = refsByBrand();
  const keep = new Set(hubKeep().brands);
  return BRANDS.filter((b) => {
    const n = byBrand[b.slug]?.length ?? 0;
    return n >= MIN_REFS || (keep.has(b.slug) && n >= 1);
  });
}

/** ハブが実在する家族だけを返す。⚠️ これを使わないとパンくずが404を指す。 */
export function publishedFamilyOfRef(ref: string): Family | null {
  const f = familyOfRef(ref);
  if (!f) return null;
  return publishedFamilies().some((x) => x.slug === f.slug) ? f : null;
}

/** ハブが実在するブランドだけを返す。 */
export function publishedBrandOf(brandLabel?: string) {
  return publishedBrands().find((x) => x.label === brandLabel) ?? null;
}
