// content/<kind>/<slug>.md（解説文）の読み込み。
// ⚠️ ファイルが無ければ null を返し、ページには何も出さない（空の見出しや仮の文を出さない）。
// 書式（docs/bot-briefs/saburo-2-editorial.md）: 先頭に YAML（title / description / sources）、本文は Markdown。
// 依存を増やさないため、見出し・段落・箇条書き・番号付きリスト・表・リンク・強調・脚注番号 [n] だけを扱う簡易な読み込みにしている。
//
// ■ 出典（2026-10-17 フェーズ2）
//   本文末尾の「## 出典」の番号付きリスト（「1. ラベル https://... （2026年10月17日確認）」）を出典一覧として取り出し、
//   本文からは外す（ページ側でリンク付きの一覧として描画する）。本文の [n] はその番号への脚注リンクにする。
//   「## 出典」が無いファイルは YAML の sources を番号順に使う。
import fs from "node:fs";
import path from "node:path";
import { SITE_URL } from "./site";

export type Source = { url: string; label?: string; checked?: string };
export type Block =
  | { type: "h"; level: 2 | 3 | 4; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };
export type Editorial = {
  kind: string;
  slug: string;
  title?: string;
  description?: string;
  /** 出典（番号＝配列の添字+1） */
  sources: Source[];
  blocks: Block[];
};
export type Kind = "models" | "shops" | "guides" | "brands";

function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

/** 当サイト自身の URL は相対パスにする（リンク切れ検査・別ドメインでの確認ビルドでも正しく辿れるように） */
export function localize(url: string): string {
  for (const origin of [SITE_URL, "https://brandwatchbank.com"]) {
    if (url.startsWith(origin + "/")) return url.slice(origin.length);
  }
  return url;
}

/** title / description / sources だけを読む最小限の YAML 解釈 */
function parseFrontmatter(src: string): { meta: { title?: string; description?: string; sources: Source[] }; body: string } {
  const meta: { title?: string; description?: string; sources: Source[] } = { sources: [] };
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta, body: src };
  const lines = m[1].split(/\r?\n/);
  let inSources = false;
  let cur: Source | null = null;
  const flush = () => { if (cur?.url) meta.sources.push(cur); cur = null; };
  for (const line of lines) {
    const top = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (top) {
      flush();
      inSources = top[1] === "sources";
      if (top[1] === "title") meta.title = unquote(top[2]);
      if (top[1] === "description") meta.description = unquote(top[2]);
      continue;
    }
    if (!inSources) continue;
    const item = line.match(/^\s*-\s*(.*)$/);
    if (item) {
      flush();
      const v = /^["']/.test(item[1]) ? unquote(item[1]) : item[1];
      const kv = /^https?:\/\//.test(v) ? null : v.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (kv) {
        cur = { url: "" };
        assign(cur, kv[1], unquote(kv[2]));
      } else {
        const u = v.match(/(https?:\/\/\S+)/);
        const d = v.match(/(\d{4}-\d{2}-\d{2})/);
        cur = { url: u ? u[1].replace(/[),]+$/, "") : "", checked: d?.[1], label: unquote(v.replace(u?.[1] ?? "", "").replace(d?.[1] ?? "", "").replace(/[()（）\s]+$/, "")) || undefined };
      }
      continue;
    }
    const kv = line.match(/^\s+([A-Za-z_]+):\s*(.*)$/);
    if (kv && cur) assign(cur, kv[1], unquote(kv[2]));
  }
  flush();
  return { meta, body: src.slice(m[0].length) };
}

function assign(s: Source, k: string, v: string) {
  if (k === "url") s.url = v;
  else if (k === "title" || k === "label" || k === "name") s.label = v;
  else if (k === "checked" || k === "date" || k === "checked_at" || k === "accessed") s.checked = v;
}

const splitRow = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let table: string[][] | null = null;
  const endPara = () => { if (para.length) blocks.push({ type: "p", text: para.join("") }); para = []; };
  const endList = () => { if (list) blocks.push(list); list = null; };
  const endTable = () => {
    if (table) {
      const rows = table.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      if (rows.length) blocks.push({ type: "table", head: rows[0], rows: rows.slice(1) });
    }
    table = null;
  };
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) { endPara(); endList(); endTable(); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      endPara(); endList();
      (table ??= []).push(splitRow(line));
      continue;
    }
    endTable();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      endPara(); endList();
      // 本文の # はページの h1 と重ならないよう h2 に寄せる
      const level = Math.min(4, Math.max(2, h[1].length)) as 2 | 3 | 4;
      blocks.push({ type: "h", level, text: h[2].trim() });
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      endPara();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) { endList(); list = { type, items: [] }; }
      list.items.push((ul ?? ol)![1].trim());
      continue;
    }
    endList();
    para.push(line.trim());
  }
  endPara(); endList(); endTable();
  return blocks;
}

/** 「ラベル https://... （2026年10月17日確認）」→ Source */
function parseSourceItem(item: string): Source | null {
  const u = item.match(/(https?:\/\/[^\s）)]+)/);
  if (!u) return null;
  const d = item.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const checked = d ? `${d[1]}-${d[2].padStart(2, "0")}-${d[3].padStart(2, "0")}` : undefined;
  const label = item.slice(0, u.index).trim().replace(/[：:]\s*$/, "") || undefined;
  return { url: u[1], label, checked };
}

/** 本文の「## 出典」節を取り出し、本文から外す */
function extractSources(blocks: Block[]): { blocks: Block[]; sources: Source[] | null } {
  const i = blocks.findIndex((b) => b.type === "h" && b.level === 2 && /^(出典|参考文献|参考)/.test(b.text));
  if (i < 0) return { blocks, sources: null };
  let j = i + 1;
  while (j < blocks.length && !(blocks[j].type === "h" && (blocks[j] as { level: number }).level === 2)) j++;
  const items = blocks.slice(i + 1, j).flatMap((b) => (b.type === "ol" || b.type === "ul" ? b.items : []));
  const sources = items.map(parseSourceItem).filter((s): s is Source => !!s);
  return { blocks: [...blocks.slice(0, i), ...blocks.slice(j)], sources };
}

function read(file: string, kind: string, slug: string): Editorial | null {
  if (!fs.existsSync(file)) return null;
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const parsed = extractSources(parseBody(body));
  if (!parsed.blocks.length) return null;
  const sources = (parsed.sources && parsed.sources.length ? parsed.sources : meta.sources).map((s) => ({ ...s, url: localize(s.url) }));
  return { kind, slug, title: meta.title, description: meta.description, sources, blocks: parsed.blocks };
}

export function loadEditorial(kind: Kind, slug: string): Editorial | null {
  return read(path.join(process.cwd(), "content", kind, `${slug}.md`), kind, slug);
}

export function listEditorial(kind: Kind): string[] {
  const dir = path.join(process.cwd(), "content", kind);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")).sort();
}

export function loadGlossary(): Editorial | null {
  return read(path.join(process.cwd(), "content", "glossary.md"), "glossary", "glossary");
}

export function loadFaq(): Editorial | null {
  return read(path.join(process.cwd(), "content", "faq.md"), "faq", "faq");
}

/** 売却ガイドの並び順（読む順。未掲載の slug は末尾へ） */
const GUIDE_ORDER = ["how-to-read-prices", "choosing-a-buyer", "accessories-and-price", "overhaul-before-selling", "rolex-reference-numbers"];

export type GuideMeta = { slug: string; title: string; description?: string };
export function guides(): GuideMeta[] {
  const oi = (s: string) => (GUIDE_ORDER.indexOf(s) < 0 ? 99 : GUIDE_ORDER.indexOf(s));
  return listEditorial("guides")
    .map((slug): GuideMeta | null => {
      const e = loadEditorial("guides", slug);
      return e?.title ? { slug, title: e.title, description: e.description } : null;
    })
    .filter((g): g is GuideMeta => g !== null)
    .sort((a, b) => oi(a.slug) - oi(b.slug));
}

/**
 * 本文中の「ガイド「…」」「売却ガイド「…」」を、該当する売却ガイドのページへのリンクにするための対応。
 * 解説文ごとに書名の書き方が少しずつ違う（例: 「付属品（箱・保証書）と買取価格」「時計の付属品（箱・保証書）と買取価格の関係」）ため、
 * 書名に含まれる語で判定する。判定できない書名はリンクにしない。
 */
export function guideSlugFor(name: string): string | null {
  const rules: [RegExp, string][] = [
    [/付属品/, "accessories-and-price"],
    [/オーバーホール/, "overhaul-before-selling"],
    [/相場の見方/, "how-to-read-prices"],
    [/買取店の選び方/, "choosing-a-buyer"],
    [/型番/, "rolex-reference-numbers"],
  ];
  for (const [re, slug] of rules) if (re.test(name) && fs.existsSync(path.join(process.cwd(), "content", "guides", `${slug}.md`))) return slug;
  return null;
}

/** FAQ（「### Q. …」と続く段落）を取り出す。FAQPage の構造化データに使う（画面に出ている問答と同じもの） */
export function faqPairs(e: Editorial): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  for (let i = 0; i < e.blocks.length; i++) {
    const b = e.blocks[i];
    if (b.type !== "h" || !/^Q[.．]\s*/.test(b.text)) continue;
    const parts: string[] = [];
    for (let j = i + 1; j < e.blocks.length && e.blocks[j].type !== "h"; j++) {
      const x = e.blocks[j];
      if (x.type === "p") parts.push(x.text);
      else if (x.type === "ul" || x.type === "ol") parts.push(x.items.join(" "));
    }
    const clean = (t: string) => t.replace(/\[(\d+)\]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
    out.push({ q: clean(b.text.replace(/^Q[.．]\s*/, "")), a: clean(parts.join(" ")) });
  }
  return out;
}
