import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { guides, loadEditorial } from "@/lib/content";
import { breadcrumb, graph, organization } from "@/lib/jsonld";
import { EditorialBody, SourceList } from "@/components/EditorialSection";
import { IconLink } from "@/components/Icons";

/*
  売却ガイド（/guide/<slug>/）。本文は content/guides/<slug>.md（saburo-2）。
  ⚠️ 本文の数値・定義は当サイトの表示と各社の公開ページが出典。出典一覧は本文末尾の「## 出典」から作る。
*/

export const dynamicParams = false;

export function generateStaticParams() {
  return guides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = loadEditorial("guides", slug);
  if (!e) return { title: "ページが見つかりません" };
  return {
    title: `${e.title}｜売却ガイド | ${SITE_NAME}`,
    description: e.description,
    alternates: { canonical: `${SITE_URL}/guide/${slug}/` },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = loadEditorial("guides", slug);
  if (!e) notFound();
  const others = guides().filter((g) => g.slug !== slug);
  const checked = e.sources.map((s) => s.checked).filter((d): d is string => !!d).sort().pop();

  const ld = graph(
    {
      "@type": "Article",
      headline: e.title,
      description: e.description,
      url: `${SITE_URL}/guide/${slug}/`,
      ...(checked ? { dateModified: checked } : {}),
      author: { "@id": `${SITE_URL}/#organization` },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    organization,
    breadcrumb([{ name: "ホーム", path: "/" }, { name: "売却ガイド", path: "/guide/" }, { name: e.title ?? slug }]),
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
              <Link href="/guide/">売却ガイド</Link>
              <span className="sep">/</span>
              <span className="here">{e.title}</span>
            </nav>
            <h1 className="page-title">{e.title}</h1>
            {checked && <p className="page-meta">出典の確認日：{checked}</p>}
          </div>
        </div>

        <div className="wrap-narrow page-body">
          <article className="reveal editorial editorial--page">
            <EditorialBody data={e} />
            <SourceList sources={e.sources} />
          </article>

          <section className="reveal">
            <h2 className="block-title"><IconLink />他の売却ガイド</h2>
            <div className="link-grid">
              {others.map((g) => (
                <Link key={g.slug} href={`/guide/${g.slug}/`} className="link-card">
                  <span className="link-card__label">{g.title}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="reveal">
            <h2 className="block-title"><IconLink />関連ページ</h2>
            <div className="chip-row">
              <a href="/faq/" className="btn btn-sm">よくある質問</a>
              <a href="/ranking/" className="btn btn-sm">買取価格ランキング</a>
              <a href="/#search" className="btn btn-sm">型番から探す</a>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
