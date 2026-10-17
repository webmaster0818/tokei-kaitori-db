// 型番 → モデル（コレクション）の判定。lib/models.ts と scripts/generate-redirects.mjs が共有する（書き写さない）。
//
// ■ 規則（scripts/shops/families-proposal.md・jiro-2 2026-10-17 の振り分けと同じ考え方）
//   1. ブランドが一致する家族だけを候補にする。
//      ⚠️ ブランド条件が無いと、チューダー「プリンスオイスターデイト サブマリーナー」がロレックスのサブマリーナーに、
//         チューダーの「ロイヤル」がオーデマ・ピゲの「ロイヤルオーク」系に当たる。
//   2. jiro-2 が振り分けた型番の一覧（refs。大文字・英数字のみ。メーカー公式の型番一覧で確認できたものは
//      行名より公式を優先済み）に載っている型番は、その家族に入れる。
//   3. 一覧に無い型番（新しく取得した型番など）はモデル名（マスタの models）にキーが含まれるかで決める（最長一致）。
//      表記ゆれを吸収するため、比較の前に NFKC・大文字化・空白／中黒／ハイフンの除去をそろえて行い、
//      モデル名に含まれる型番の文字列は除く（「1908」「1926」のような数字のキーが型番の一部に当たらないように）。
//   4. fallback の家族（オイスター パーペチュアル・パテック フィリップ コンプリケーション）は、
//      同じブランドの他の家族に当たらないときだけ採る（「オイスターパーペチュアル デイトジャスト」対策）。

const norm = (s) => String(s ?? "").normalize("NFKC").toUpperCase().replace(/[\s・･\-‐−–—_]/g, "");
const alnum = (s) => String(s ?? "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * @param {{slug:string,label:string,brand:string,keys:string[],fallback?:boolean,officialRefs?:string[]}[]} families
 * @param {string|undefined} brand  マスタのブランド表記（例: ロレックス）
 * @param {string[]} models        マスタのモデル名
 * @param {string} [ref]           型番
 */
export function matchFamily(families, brand, models, ref) {
  if (!brand) return null;
  const cands = families.filter((f) => f.brand === brand);
  if (!cands.length) return null;
  let rk = alnum(ref);
  // チューダーは先頭の M を外した形で突合する（scripts/shops/tudor-ref-rule.md の案B）
  if (brand === "チューダー" && rk.startsWith("M")) rk = rk.slice(1);
  if (rk) {
    const listed = cands.find((f) => f.refs && f.refs.includes(rk));
    if (listed) return listed;
  }
  let text = norm((models ?? []).join(" "));
  if (ref) {
    for (const r of [norm(ref), rk]) if (r && r.length >= 4) text = text.split(r).join(" ");
  }
  const pick = (list) => {
    let best = null;
    let bestLen = 0;
    for (const f of list) {
      for (const k of f.keys) {
        const nk = norm(k);
        if (nk && text.includes(nk) && nk.length > bestLen) {
          best = f;
          bestLen = nk.length;
        }
      }
    }
    return best;
  };
  return pick(cands.filter((f) => !f.fallback)) ?? pick(cands.filter((f) => f.fallback));
}
