// 型番ページの「型番の基本情報」「状態別の上限額」「同じモデルの型番」と、title/h1 の表示名。
// 2026-10-20 成長ルーチン：GSC で「<型番> 買取」が10〜20位に出始めたため、上位の買取店の型番ページ
// （ブラリバ・おたからや・キタムラ）と比べて足りなかったものを、既存データから出せる範囲だけで足した。
// ⚠️ 値はすべて data/prices の実レコード（各買取店の公開ページの表記）由来。ニックネーム（「ペプシ」等）は
//    メーカー公式の表記ではないため載せない（公式・一次情報で確認できないものは作らない）。
import type { PriceRecord, RefSummary } from "./prices";
import { shopCeilings } from "./prices";
import { normalizeDial } from "./dials";

const refKey = (t: string) => t.replace(/[./\-\s]+/g, "").toUpperCase();

/** 店の掲載名から、ブランド名と型番の語を除いた名前（例「ロレックス GMTマスター 116719BLRO」→「GMTマスター」） */
export function cleanModelName(model: string | undefined, brand: string | undefined, ref: string): string {
  if (!model) return "";
  const rk = refKey(ref);
  return model
    .split(/\s+/)
    .filter((w) => w && w !== brand && refKey(w) !== rk)
    .join(" ")
    .trim();
}

/**
 * title / h1 に使う表示名＝「ブランド モデル名」。
 * ⚠️ 以前は title・h1 にブランド名が無く（例「GMTマスター II 116719BLROの買取相場」）、上位の買取店は
 *    いずれも「ロレックス GMTマスターⅡ 116719BLRO 買取価格」の形だった。モデル名にブランド・型番が
 *    含まれる店の表記（なんぼや）でも二重にならないよう、語を除いてから付ける。
 */
export function displayName(model: string | undefined, brand: string | undefined, ref: string): string {
  const m = cleanModelName(model, brand, ref);
  return [brand, m].filter(Boolean).join(" ");
}

export type RefInfo = {
  /** 買取店ごとの掲載名（ブランド・型番の語を除いたもの）。同じ名前は1つにまとめ、掲載している店を併記 */
  names: { name: string; shops: string[] }[];
  dials: string[];
  materials: string[];
  conditions: string[];
};

const COND_ORDER = ["新品", "未使用", "中古"];
const condSort = (a: string, b: string) =>
  (COND_ORDER.indexOf(a) + 1 || 99) - (COND_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b);

export function refInfo(records: PriceRecord[], brand: string | undefined, ref: string): RefInfo {
  const names = new Map<string, Set<string>>();
  for (const r of records) {
    const n = cleanModelName(r.model, brand, ref);
    if (!n) continue;
    (names.get(n) ?? names.set(n, new Set()).get(n)!).add(r.shop);
  }
  const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x && !!x.trim()))];
  return {
    names: [...names.entries()].map(([name, shops]) => ({ name, shops: [...shops] })),
    dials: uniq(records.map((r) => normalizeDial(r.dial, brand))).filter((d) => d !== "GR"),
    materials: uniq(records.map((r) => r.material)),
    conditions: uniq(records.map((r) => r.condition)).sort(condSort),
  };
}

export type ConditionRow = {
  condition: string;
  max: number;
  min: number;
  maxShop: string;
  shops: number;
};

/**
 * 状態（新品・未使用・中古）別の上限額。区分「上限」「相場」の行だけ・店ごとの代表値は shopCeilings と同じ規則。
 * 2つ以上の状態の価格が公開されている型番だけ返す（1つなら概要と同じ値になるため）。
 */
export function conditionRows(s: RefSummary): ConditionRow[] | null {
  const conds = [...new Set(s.records.map((r) => r.condition).filter((c): c is string => !!c))].sort(condSort);
  const rows: ConditionRow[] = [];
  for (const c of conds) {
    const reps = shopCeilings(s.records.filter((r) => r.condition === c));
    if (!reps.length) continue;
    rows.push({ condition: c, max: reps[0].price, min: reps[reps.length - 1].price, maxShop: reps[0].shop, shops: reps.length });
  }
  return rows.length >= 2 ? rows : null;
}
