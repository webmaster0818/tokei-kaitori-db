import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { guides } from "@/lib/content";
import { breadcrumb, graph, itemList, organization } from "@/lib/jsonld";
import { Arrow, IconDocument, IconLink } from "@/components/Icons";

// 売却ガイドの一覧（/guide/）。content/guides/*.md があるものだけを並べる。

export const metadata: Metadata = {
  title: `売却ガイド｜時計の買取相場の見方と売却の準備 | ${SITE_NAME}`,
  description: "時計の買取相場の見方、買取店の選び方、付属品・保証書と買取価格の関係、オーバーホール前に売るかどうか、ロレックスの型番の読み方を、メーカー公式と買取店の公開情報にもとづいて解説しています。",
  alternates: { canonical: `${SITE_URL}/guide/` },
};

export default function GuideIndex() {
  const list = guides();
  const ld = graph(
    { "@type": "CollectionPage", name: "売却ガイド", url: `${SITE_URL}/guide/` },
    organization,
    breadcrumb([{ name: "ホーム", path: "/" }, { name: "売却ガイド" }]),
    itemList("売却ガイド", list.map((g) => ({ name: g.title, path: `/guide/${g.slug}/` }))),
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
              <span className="here">売却ガイド</span>
            </nav>
            <h1 className="page-title">売却ガイド</h1>
            <p className="page-meta">{list.length}本 / メーカー公式と買取店の公開情報にもとづく解説</p>
          </div>
        </div>

        <div className="wrap-narrow page-body">
          <section className="reveal">
            <h2 className="block-title"><IconDocument />ガイドの一覧</h2>
            <p className="prose-jp mb-6">
              当サイトでは、型番ごとの買取価格とあわせて、価格の見方や売却前の準備についての解説を掲載しています。各ガイドの記述には、出典の番号と確認日を明記しています。
            </p>
            <ul className="guide-list">
              {list.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guide/${g.slug}/`} className="guide-list__item">
                    <span className="guide-list__title">{g.title}</span>
                    {g.description && <span className="guide-list__desc">{g.description}</span>}
                    <Arrow className="guide-list__arrow" />
                  </Link>
                </li>
              ))}
            </ul>
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
