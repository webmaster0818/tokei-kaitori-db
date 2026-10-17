// モデル家族（デイトナ／サブマリーナ等）の定義と、型番→家族の判定。
//
// ■ なぜ要るか（2026-09-21 GSC実測）
//   流入クエリが「116719blro 買取」のような**型番クエリだけ**で、
//   「デイトナ 買取相場」のようなモデル名クエリが1件も来ていなかった。
//   原因は /ref/{型番}/ しかページが無く、モデル名の受け皿がゼロだったこと。
//
// ⚠️ マスタの models は表記がばらつく（「デイトナ」「ロレックス デイトナ」
//    「コスモグラフ デイトナ」）。キーワードで寄せる。
// ⚠️ 判定は**最長一致**にする。単純な先頭一致だと
//    「スピードマスター デイデイト」（オメガ）が デイデイト（ロレックス）に入る。
import { masterRefs, publishableRefs } from "./prices";
import familiesData from "./families.json";

export type Family = { slug: string; label: string; brand: string; keys: string[] };

// ⚠️ 定義の実体は lib/families.json（scripts/generate-redirects.mjs と共有するため）。
export const FAMILIES: Family[] = familiesData.families;

export const BRANDS: { slug: string; label: string }[] = familiesData.brands;

/** 型番のモデル表記から家族を判定する（最長一致） */
export function familyOf(models: string[]): Family | null {
  const s = models.join(" ");
  let best: Family | null = null;
  let bestLen = 0;
  for (const f of FAMILIES) {
    for (const k of f.keys) {
      if (s.includes(k) && k.length > bestLen) {
        best = f;
        bestLen = k.length;
      }
    }
  }
  return best;
}

/** 家族slug → 公開可能な型番一覧。⚠️ ページを作るのは1件以上ある家族だけ。 */
export function refsByFamily(): Record<string, string[]> {
  const master = masterRefs();
  const out: Record<string, string[]> = {};
  for (const ref of publishableRefs()) {
    const f = familyOf(master[ref]?.models ?? []);
    if (!f) continue;
    (out[f.slug] ??= []).push(ref);
  }
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

/** ハブが実在する家族だけを返す。⚠️ これを使わないとパンくずが404を指す。 */
export function publishedFamilyOf(models: string[]): Family | null {
  const f = familyOf(models);
  if (!f) return null;
  return (refsByFamily()[f.slug]?.length ?? 0) >= MIN_REFS ? f : null;
}

/** ハブが実在するブランドだけを返す。 */
export function publishedBrandOf(brandLabel?: string) {
  const b = BRANDS.find((x) => x.label === brandLabel);
  if (!b) return null;
  return (refsByBrand()[b.slug]?.length ?? 0) >= MIN_REFS ? b : null;
}
