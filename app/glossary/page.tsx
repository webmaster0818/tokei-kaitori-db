import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { guides, loadGlossary } from "@/lib/content";
import { breadcrumb, graph, organization } from "@/lib/jsonld";
import { EditorialBody, SourceList } from "@/components/EditorialSection";
import { IconLink } from "@/components/Icons";

/*
  時計の用語集（/glossary/）。本文は content/glossary.md（saburo-2・2026-10-17）。
  各用語は「### 用語（読み）」。当サイトでの使用例のリンク付き。
*/

export function generateMetadata(): Metadata {
  const e = loadGlossary();
  return {
    title: `時計の用語集｜素材・ムーブメント・付属品・買取価格の用語 | ${SITE_NAME}`,
    description: e?.description,
    alternates: { canonical: `${SITE_URL}/glossary/` },
  };
}

export default function GlossaryPage() {
  const e = loadGlossary();
  if (!e) notFound();
  const ld = graph(
    { "@type": "WebPage", url: `${SITE_URL}/glossary/`, name: "時計の用語集" },
    organization,
    breadcrumb([{ name: "ホーム", path: "/" }, { name: "時計の用語集" }]),
  );
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <main>
        <div className="page-head">
          <div className="wrap-narrow page-head__inner">
            <nav className="crumbs" aria-label="パンくずリスト">
              <Link href="/">ホーム</Link>
              <span className="sep">/</span>
              <span className="here">時計の用語集</span>
            </nav>
            <h1 className="page-title">時計の用語集</h1>
            <p className="page-meta">素材・文字盤・ムーブメント・付属品・買取価格の用語</p>
          </div>
        </div>

        <div className="wrap-narrow page-body">
          <article className="reveal editorial editorial--page">
            <EditorialBody data={e} />
            <SourceList sources={e.sources} />
          </article>

          <section className="reveal">
            <h2 className="block-title"><IconLink />関連ページ</h2>
            <div className="link-grid">
              <Link href="/faq/" className="link-card"><span className="link-card__label">よくある質問</span></Link>
              {guides().map((g) => (
                <Link key={g.slug} href={`/guide/${g.slug}/`} className="link-card">
                  <span className="link-card__label">{g.title}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
