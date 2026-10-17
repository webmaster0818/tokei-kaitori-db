// 型番のメーカー公式スペック（data/specs/<型番の英数字・小文字>.json・taro-2 2026-10-17）。
// ⚠️ 値は公式ページ（またはその Wayback 保存版）にあった項目だけ。無い項目はキー自体が無い（推測で埋めない）。
// ⚠️ 英語ページを出典にした型番（sources[].lang === "en"）は、英語の文をページに出さない。
//    数値・固有名詞の項目（ケース径・防水・パワーリザーブ・キャリバー・固有名の素材）だけを表示する。
import fs from "node:fs";
import path from "node:path";

type SpecSource = { url: string; archive?: string; snapshot?: string; checked?: string; lang?: string; fields?: string[] };
type SpecJson = Record<string, unknown> & { ref: string; brand: string; status?: string; sources: SpecSource[] };

export type SpecView = {
  rows: { label: string; value: string }[];
  status?: string;
  source: SpecSource;
  english: boolean;
};

const alnum = (s: string) => s.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");

const FIELDS: { key: string; label: string; fmt?: (v: unknown) => string }[] = [
  { key: "case_diameter_mm", label: "ケース径", fmt: (v) => `${v}mm` },
  { key: "case_material", label: "ケース素材" },
  { key: "case_back", label: "裏蓋" },
  { key: "bezel", label: "ベゼル" },
  { key: "crown", label: "リューズ" },
  { key: "crystal", label: "風防" },
  { key: "dial", label: "文字盤" },
  { key: "movement", label: "ムーブメント" },
  { key: "caliber", label: "キャリバー" },
  { key: "winding", label: "巻き上げ" },
  { key: "power_reserve_h", label: "パワーリザーブ", fmt: (v) => `${v}時間` },
  { key: "precision", label: "精度" },
  { key: "functions", label: "機能" },
  { key: "oscillator", label: "振動子" },
  { key: "water_resistance_m", label: "防水", fmt: (v) => `${v}m` },
  { key: "water_resistance_atm", label: "防水", fmt: (v) => `${v}気圧` },
  { key: "bracelet", label: "ブレスレット・ストラップ" },
  { key: "clasp", label: "クラスプ" },
  { key: "certification", label: "認定" },
];

/** 英語の出典で表示してよい項目（数値・固有名詞） */
const EN_OK = new Set(["case_diameter_mm", "water_resistance_m", "water_resistance_atm", "power_reserve_h", "caliber", "case_material"]);
/** 英語の素材名のうち固有名詞として扱うもの（一般名の Steel・Yellow gold 等は出さない） */
const PROPER_MATERIAL = /™|®|Sedna|Canopus|Moonshine|Bronze Gold|O-MEGASTEEL|Ceragold|Titanium Grade/i;

export function specFor(ref: string): SpecView | null {
  const p = path.join(process.cwd(), "data", "specs", `${alnum(ref).toLowerCase()}.json`);
  if (!fs.existsSync(p)) return null;
  const d = JSON.parse(fs.readFileSync(p, "utf8")) as SpecJson;
  // ⚠️ ファイル名は英数字だけに潰した名前なので、別の型番と衝突していないか中身の ref で確かめる
  if (alnum(d.ref) !== alnum(ref)) return null;
  // 製品名と素材の一行しか公式に無い型番（カルティエの旧型番など）は仕様表として出さない（2026-10-17）
  if ((d as unknown as { spec_level?: string }).spec_level === "name_only") return null;
  const source = d.sources?.[0];
  if (!source?.url) return null;
  const english = d.sources.some((s) => s.lang === "en");
  const rows: SpecView["rows"] = [];
  for (const f of FIELDS) {
    const v = d[f.key];
    if (v == null || v === "") continue;
    if (english) {
      if (!EN_OK.has(f.key)) continue;
      if (f.key === "case_material" && !PROPER_MATERIAL.test(String(v))) continue;
      if (f.key === "caliber" && /\s{2,}|[a-z]{4,}\s+[a-z]{4,}/.test(String(v))) continue; // 文になっているものは出さない
    }
    rows.push({ label: f.label, value: f.fmt ? f.fmt(v) : String(v).replace(/\s+/g, " ").trim() });
  }
  if (!rows.length) return null;
  return { rows, status: d.status, source, english };
}
