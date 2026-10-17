"use client";
import { useMemo, useState } from "react";

// 型番検索（静的サイトなのでサーバーは使わず、公開中の型番一覧だけをページに埋め込んで絞り込む）。
// ⚠️ 遷移先 URL は小文字（/ref/126610ln/）。大文字だと Cloudflare で 404 になる。
type Item = { ref: string; model: string };
const norm = (s: string) => s.toLowerCase().replace(/[\s.\-－ー‐]/g, "").normalize("NFKC");

export function RefSearch({ items, example }: { items: Item[]; example: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const keyed = useMemo(() => items.map((it) => ({ ...it, k: norm(it.ref), km: norm(it.model) })), [items]);
  const nq = norm(q);
  const hits = useMemo(() => {
    if (!nq) return [];
    const starts = keyed.filter((it) => it.k.startsWith(nq));
    const contains = keyed.filter((it) => !it.k.startsWith(nq) && (it.k.includes(nq) || it.km.includes(nq)));
    return [...starts, ...contains].slice(0, 8);
  }, [keyed, nq]);

  const go = (ref: string) => {
    window.location.href = `/ref/${ref.toLowerCase()}/`;
  };
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const exact = keyed.find((it) => it.k === nq);
    if (exact) return go(exact.ref);
    if (hits[active]) return go(hits[active].ref);
    setOpen(true);
  };

  return (
    <form role="search" className="ref-search" onSubmit={onSubmit} aria-label="型番から探す">
      <label htmlFor="ref-q" className="sr-only">型番を入力</label>
      <div className="ref-search__field">
        <input
          id="ref-q"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={`型番を入力（例：${example}）`}
          value={q}
          role="combobox"
          aria-expanded={open && !!nq}
          aria-controls="ref-q-list"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <button type="submit" aria-label="検索">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" />
          </svg>
        </button>
      </div>
      {open && nq && (
        <div id="ref-q-list" role="listbox" className="ref-search__list">
          {hits.length ? (
            hits.map((h, i) => (
              <a key={h.ref} href={`/ref/${h.ref.toLowerCase()}/`} role="option" aria-selected={i === active}
                 onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)}>
                <span className="num font-medium">{h.ref}</span>
                <span className="m">{h.model}</span>
              </a>
            ))
          ) : (
            <p className="ref-search__empty">該当する型番は掲載しておりません。下の一覧からもお探しいただけます。</p>
          )}
        </div>
      )}
    </form>
  );
}
