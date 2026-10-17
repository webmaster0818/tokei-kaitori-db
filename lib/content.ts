// content/<kind>/<slug>.md（解説文）の読み込み。
// ⚠️ ファイルが無ければ null を返し、ページには何も出さない（空の見出しや仮の文を出さない）。
// 書式（docs/bot-briefs/saburo-2-editorial.md）: 先頭に YAML（title / description / sources）、本文は Markdown。
// 依存を増やさないため、見出し・段落・箇条書き・番号付きリスト・リンク・強調だけを扱う簡易な読み込みにしている。
import fs from "node:fs";
import path from "node:path";

export type Source = { url: string; label?: string; checked?: string };
export type Block =
  | { type: "h"; level: 2 | 3 | 4; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] };
export type Editorial = { title?: string; description?: string; sources: Source[]; blocks: Block[] };

function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

/** title / description / sources だけを読む最小限の YAML 解釈 */
function parseFrontmatter(src: string): { meta: Omit<Editorial, "blocks">; body: string } {
  const meta: Omit<Editorial, "blocks"> = { sources: [] };
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
        // 「- https://... (2026-10-18)」の1行形式
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

function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const endPara = () => { if (para.length) blocks.push({ type: "p", text: para.join("") }); para = []; };
  const endList = () => { if (list) blocks.push(list); list = null; };
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) { endPara(); endList(); continue; }
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
  endPara(); endList();
  return blocks;
}

export function loadEditorial(kind: "models" | "shops" | "guides", slug: string): Editorial | null {
  const p = path.join(process.cwd(), "content", kind, `${slug}.md`);
  if (!fs.existsSync(p)) return null;
  const src = fs.readFileSync(p, "utf8");
  const { meta, body } = parseFrontmatter(src);
  const blocks = parseBody(body);
  if (!blocks.length) return null;
  return { ...meta, blocks };
}
