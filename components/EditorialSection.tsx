import type { ReactNode } from "react";
import type { Editorial } from "@/lib/content";
import { IconDocument } from "./Icons";

// 解説文（content/*.md）の表示枠。ファイルが無いページでは何も描画しない。
// ⚠️ 外部リンクは新しいタブで開き、rel="noopener noreferrer" を付ける。

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const href = m[2];
      const ext = /^https?:\/\//.test(href);
      out.push(
        <a key={`${keyBase}-${i++}`} href={href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      out.push(<strong key={`${keyBase}-${i++}`}>{m[3]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function EditorialSection({ data, heading }: { data: Editorial | null; heading?: string }) {
  if (!data) return null;
  const bodyHasSources = data.blocks.some((b) => b.type === "h" && /出典|参考/.test(b.text));
  return (
    <section className="reveal editorial" data-slot="editorial">
      <h2 className="block-title"><IconDocument />{heading ?? data.title ?? "解説"}</h2>
      <div className="editorial__body prose-jp">
        {data.blocks.map((b, i) => {
          if (b.type === "h") {
            const Tag = (`h${b.level + 1}` as "h3" | "h4" | "h5");
            return <Tag key={i}>{inline(b.text, `h${i}`)}</Tag>;
          }
          if (b.type === "p") return <p key={i}>{inline(b.text, `p${i}`)}</p>;
          const List = b.type;
          return (
            <List key={i}>
              {b.items.map((it, j) => <li key={j}>{inline(it, `l${i}-${j}`)}</li>)}
            </List>
          );
        })}
      </div>
      {!bodyHasSources && data.sources.length > 0 && (
        <div className="editorial__sources">
          <h3>出典</h3>
          <ol>
            {data.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label ?? s.url}</a>
                {s.checked ? <span>（{s.checked} 確認）</span> : null}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
