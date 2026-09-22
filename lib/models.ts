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

export type Family = { slug: string; label: string; brand: string; keys: string[] };

export const FAMILIES: Family[] = [
  { slug: "daytona", label: "デイトナ", brand: "ロレックス", keys: ["デイトナ"] },
  { slug: "submariner", label: "サブマリーナ", brand: "ロレックス", keys: ["サブマリーナ"] },
  { slug: "gmt-master-2", label: "GMTマスター II", brand: "ロレックス", keys: ["GMTマスター II", "GMTマスターII", "GMT マスター II"] },
  { slug: "gmt-master", label: "GMTマスター", brand: "ロレックス", keys: ["GMTマスター", "GMT マスター"] },
  { slug: "datejust", label: "デイトジャスト", brand: "ロレックス", keys: ["デイトジャスト"] },
  { slug: "day-date", label: "デイデイト", brand: "ロレックス", keys: ["デイデイト"] },
  { slug: "explorer", label: "エクスプローラー", brand: "ロレックス", keys: ["エクスプローラー"] },
  { slug: "yacht-master", label: "ヨットマスター", brand: "ロレックス", keys: ["ヨットマスター"] },
  { slug: "sea-dweller", label: "シードゥエラー", brand: "ロレックス", keys: ["シードゥエラー", "シードウェラー"] },
  { slug: "sky-dweller", label: "スカイドゥエラー", brand: "ロレックス", keys: ["スカイドゥエラー"] },
  { slug: "milgauss", label: "ミルガウス", brand: "ロレックス", keys: ["ミルガウス"] },
  { slug: "air-king", label: "エアキング", brand: "ロレックス", keys: ["エアキング"] },
  { slug: "oyster-perpetual", label: "オイスターパーペチュアル", brand: "ロレックス", keys: ["オイスターパーペチュアル"] },
  { slug: "cellini", label: "チェリーニ", brand: "ロレックス", keys: ["チェリーニ"] },
  { slug: "royal-oak", label: "ロイヤルオーク", brand: "オーデマ・ピゲ", keys: ["ロイヤルオーク"] },
  { slug: "speedmaster", label: "スピードマスター", brand: "オメガ", keys: ["スピードマスター"] },
  { slug: "seamaster", label: "シーマスター", brand: "オメガ", keys: ["シーマスター"] },
  { slug: "constellation", label: "コンステレーション", brand: "オメガ", keys: ["コンステレーション"] },
  { slug: "de-ville", label: "デ・ヴィル", brand: "オメガ", keys: ["デ・ヴィル", "デビル"] },
  { slug: "overseas", label: "オーヴァーシーズ", brand: "ヴァシュロン・コンスタンタン", keys: ["オーヴァーシーズ", "オーバーシーズ"] },
  { slug: "santos", label: "サントス", brand: "カルティエ", keys: ["サントス"] },
  { slug: "tank", label: "タンク", brand: "カルティエ", keys: ["タンク"] },
  { slug: "ballon-bleu", label: "バロンブルー", brand: "カルティエ", keys: ["バロンブルー"] },
];

export const BRANDS: { slug: string; label: string }[] = [
  { slug: "rolex", label: "ロレックス" },
  { slug: "omega", label: "オメガ" },
  { slug: "audemars-piguet", label: "オーデマ・ピゲ" },
  { slug: "vacheron-constantin", label: "ヴァシュロン・コンスタンタン" },
  { slug: "cartier", label: "カルティエ" },
];

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
