import type { ReactNode } from "react";
import { guideSlugFor, localize, type Block, type Editorial } from "@/lib/content";
import { IconDocument } from "./Icons";
import { publishedBrands, publishedFamilies } from "@/lib/models";
import { publishableRefs } from "@/lib/prices";

// 段階公開でまだページが無い内部リンク（/model/ /brand/ /ref/）は、リンクにせず文字だけ残す（2026-10-17）
let livePaths: Set<string> | null = null;
function isLive(href: string): boolean {
  const m = href.match(/^\/(model|brand|ref)\/([^/]+)\/?$/);
  if (!m) return true;
  if (!livePaths) {
    livePaths = new Set([
      ...publishedFamilies().map((f) => `/model/${f.slug}/`),
      ...publishedBrands().map((b) => `/brand/${b.slug}/`),
      ...publishableRefs().map((r) => `/ref/${r.toLowerCase()}/`),
    ]);
  }
  return livePaths.has(`/${m[1]}/${m[2].toLowerCase()}/`);
}

// 解説文（content/*.md）の表示枠。ファイルが無いページでは何も描画しない。
// ⚠️ 外部リンクは新しいタブで開き、rel="noopener noreferrer" を付ける。
// ⚠️ 本文の [n] は出典一覧（ページ下部・id="src-n"）への脚注リンクにする。出典の番号に無い [n] は文字のまま残す。

function inline(text: string, keyBase: string, nSources: number): ReactNode[] {
  const out: ReactNode[] = [];
  // 1) [ラベル](URL)  2) **強調**  3) 脚注 [n]  4) （売却）ガイド「書名」
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\[(\d{1,2})\]|((?:売却)?ガイド)「([^」]+)」/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1]) {
      const href = localize(m[2]);
      const ext = /^https?:\/\//.test(href);
      if (!ext && !isLive(href)) { out.push(m[1]); last = m.index + m[0].length; continue; }
      out.push(<a key={key} href={href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{m[1]}</a>);
    } else if (m[3]) {
      out.push(<strong key={key}>{m[3]}</strong>);
    } else if (m[4]) {
      const n = Number(m[4]);
      if (n >= 1 && n <= nSources) {
        out.push(<sup key={key} className="fn"><a href={`#src-${n}`} aria-label={`出典${n}`}>[{n}]</a></sup>);
      } else {
        out.push(m[0]);
      }
    } else if (m[6]) {
      const slug = guideSlugFor(m[6]);
      out.push(slug ? <span key={key}>{m[5]}「<a href={`/guide/${slug}/`}>{m[6]}</a>」</span> : m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderBlock(b: Block, i: number, n: number, hOffset: number) {
  if (b.type === "h") {
    const lv = Math.min(6, b.level + hOffset);
    const Tag = `h${lv}` as "h2" | "h3" | "h4" | "h5" | "h6";
    return <Tag key={i}>{inline(b.text, `h${i}`, n)}</Tag>;
  }
  if (b.type === "p") return <p key={i}>{inline(b.text, `p${i}`, n)}</p>;
  if (b.type === "table") {
    return (
      <div key={i} className="table-frame editorial__table">
        <table className="data-table">
          <thead>
            <tr>{b.head.map((c, j) => <th key={j}>{inline(c, `t${i}h${j}`, n)}</th>)}</tr>
          </thead>
          <tbody>
            {b.rows.map((r, j) => (
              <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c, `t${i}-${j}-${k}`, n)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const List = b.type;
  return (
    <List key={i}>
      {b.items.map((it, j) => <li key={j}>{inline(it, `l${i}-${j}`, n)}</li>)}
    </List>
  );
}

export function SourceList({ sources }: { sources: Editorial["sources"] }) {
  if (!sources.length) return null;
  return (
    <div className="editorial__sources">
      <h3>出典</h3>
      <ol>
        {sources.map((s, i) => {
          const ext = /^https?:\/\//.test(s.url);
          return (
            <li key={i} id={`src-${i + 1}`}>
              {s.label ? <>{s.label} </> : null}
              <a href={s.url} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{s.url}</a>
              {s.checked ? <span>（{s.checked} 確認）</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 解説文の本文だけ（ガイド・FAQ のように、ページ本体が解説文のときに使う）。見出しは h2 から始める */
export function EditorialBody({ data }: { data: Editorial }) {
  const n = data.sources.length;
  return (
    <div className="editorial__body prose-jp">
      {data.blocks.map((b, i) => renderBlock(b, i, n, 0))}
    </div>
  );
}

export function EditorialSection({ data, heading }: { data: Editorial | null; heading?: string }) {
  if (!data) return null;
  const n = data.sources.length;
  return (
    <section className="reveal editorial" data-slot="editorial">
      <h2 className="block-title"><IconDocument />{heading ?? data.title ?? "解説"}</h2>
      <div className="editorial__body prose-jp">
        {data.blocks.map((b, i) => renderBlock(b, i, n, 1))}
      </div>
      <SourceList sources={data.sources} />
    </section>
  );
}
