import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { faqPairs, guides, loadFaq } from "@/lib/content";
import { breadcrumb, graph, organization } from "@/lib/jsonld";
import { EditorialBody, SourceList } from "@/components/EditorialSection";
import { IconLink } from "@/components/Icons";

/*
  よくある質問（/faq/）。本文は content/faq.md（saburo-2）。
  ⚠️ FAQPage の構造化データは、画面に出している問答（「### Q. …」と続く段落）と同じものだけを入れる。
*/

export function generateMetadata(): Metadata {
  const e = loadFaq();
  return {
    title: `よくある質問｜買取価格の見方と掲載方針 | ${SITE_NAME}`,
    description: e?.description,
    alternates: { canonical: `${SITE_URL}/faq/` },
  };
}

export default function FaqPage() {
  const e = loadFaq();
  if (!e) notFound();
  const pairs = faqPairs(e);
  const ld = graph(
    {
      "@type": "FAQPage",
      url: `${SITE_URL}/faq/`,
      mainEntity: pairs.map((p) => ({
        "@type": "Question",
        name: p.q,
        acceptedAnswer: { "@type": "Answer", text: p.a },
      })),
    },
    organization,
    breadcrumb([{ name: "ホーム", path: "/" }, { name: "よくある質問" }]),
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
              <span className="here">よくある質問</span>
            </nav>
            <h1 className="page-title">よくある質問</h1>
            <p className="page-meta">{pairs.length}問 / 掲載している価格の意味と掲載方針</p>
          </div>
        </div>

        <div className="wrap-narrow page-body">
          <article className="reveal editorial editorial--page editorial--faq">
            <EditorialBody data={e} />
            <SourceList sources={e.sources} />
          </article>

          <section className="reveal">
            <h2 className="block-title"><IconLink />売却ガイド</h2>
            <div className="link-grid">
              <Link href="/glossary/" className="link-card"><span className="link-card__label">時計の用語集</span></Link>
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
