import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { latestDate, masterRefs, summarize, yen } from "@/lib/prices";
import { BRANDS, publishedBrands, publishedFamilies, refsByBrand, refsByFamily } from "@/lib/models";
import { loadEditorial } from "@/lib/content";
import { EditorialSection } from "@/components/EditorialSection";
import { breadcrumb, graph, itemList, organization } from "@/lib/jsonld";
import { IconLink, IconTable } from "@/components/Icons";

/*
  ブランド別ハブ（/brand/rolex/ など）。モデルハブへの入口。
  ⚠️ 数値は summarize() の実データのみ。ブランド単位の平均などは出さない
     （型番ごとに状態も年式も違うので、平均に意味が無い）。
*/

// ⚠️ 段階公開（data/publish-gate.json）のブランドのうち、型番が2件以上（既存のハブは1件以上）のブランドだけ
function brands() {
  return publishedBrands();
}

export function generateStaticParams() {
  return brands().map((b) => ({ slug: b.slug }));
}

function familiesOfBrand(slug: string) {
  const label = BRANDS.find((b) => b.slug === slug)?.label;
  const byFam = refsByFamily();
  return publishedFamilies().filter((f) => f.brand === label).map((f) => ({
    ...f,
    refs: byFam[f.slug] ?? [],
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = brands().find((x) => x.slug === slug);
  if (!b) return { title: "ページが見つかりません" };
  const refs = refsByBrand()[slug] ?? [];
  const d = latestDate();
  return {
    title: `${b.label}の買取相場｜${refs.length}型番を買取店で比較【${d.slice(0, 7).replace("-", "年")}月】`,
    description: `${b.label}の買取価格を型番ごとに比較しています。${d}時点の公開情報を、各社の出典とあわせて掲載しています。モデル別の上限額と店舗間の差額をご確認いただけます。`,
    alternates: { canonical: `${SITE_URL}/brand/${slug}/` },
  };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = brands().find((x) => x.slug === slug);
  if (!b) notFound();
  const fams = familiesOfBrand(slug);
  const refs = refsByBrand()[slug] ?? [];
  const date = latestDate();
  const editorial = loadEditorial("brands", slug);

  // モデルごとに「最高の上限」と「最大の差」を出す（型番ページと同じ実データ）
  const summary = fams.map((f) => {
    const rows = f.refs.map((ref) => summarize(ref)).filter((s): s is NonNullable<typeof s> => !!s);
    const max = rows.reduce((a, s) => Math.max(a, s.ceilingMax ?? 0), 0);
    const spread = rows.reduce((a, s) => Math.max(a, s.spread ?? 0), 0);
    return { ...f, count: rows.length, max, spread };
  });

  const ld = graph(
    {
      "@type": "Dataset",
      name: `${b.label} の買取価格比較データ`,
      description: `${b.label}の${refs.length}型番について、買取店が公開している買取価格を収集・比較したデータ（${date}時点）。`,
      creator: { "@id": `${SITE_URL}/#organization` },
      dateModified: date,
      url: `${SITE_URL}/brand/${slug}/`,
    },
    organization,
    // 画面上部の <nav> と同じ並び
    breadcrumb([{ name: "ホーム", path: "/" }, { name: b.label }]),
    // 画面の「モデル別」表に出ている行と同じ
    itemList(`${b.label}のモデル`, summary.map((f) => ({ name: f.label, path: `/model/${f.slug}/` }))),
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
            <span className="here">{b.label}</span>
          </nav>
          <h1 className="page-title">
            {b.label}の買取相場
          </h1>
          <p className="page-meta">
            {date} 時点 / {refs.length}型番 / モデル {summary.length}種
          </p>
        </div>
      </div>

      <div className="wrap-narrow page-body">
        <section className="reveal">
          <h2 className="block-title"><IconTable />モデル別の買取価格</h2>
          <div className="table-frame">
            <table className="data-table">
              <thead>
                <tr>
                  <th>モデル</th>
                  <th className="r">型番数</th>
                  <th className="r">上限額（最高）</th>
                  <th className="r">店舗間の差額（最大）</th>
                </tr>
              </thead>
              <tbody>
                {summary
                  .slice()
                  .sort((x, y) => y.max - x.max)
                  .map((f) => (
                    <tr key={f.slug}>
                      <td className="whitespace-nowrap">
                        <Link href={`/model/${f.slug}/`}>{f.label}</Link>
                      </td>
                      <td className="r">{f.count}</td>
                      <td className="r strong">{f.max ? yen(f.max) : "—"}</td>
                      <td className="r">{f.spread ? yen(f.spread) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="table-scroll-hint">表は横にスクロールしてご覧いただけます。</p>
          <p className="note mt-4">
            ※ 各社が公開している買取価格を {date} に取得して掲載しています。
            型番ごとに年式や仕様が異なるため、ブランド全体の平均額は掲載しておりません。
          </p>
        </section>

        <EditorialSection data={editorial} heading={editorial?.title ? undefined : `${b.label}について`} />

        <section className="reveal">
          <h2 className="block-title"><IconLink />関連ページ</h2>
          <div className="chip-row">
            <a href="/ranking/" className="btn btn-sm">買取価格ランキング</a>
            <a href="/guide/how-to-read-prices/" className="btn btn-sm">売却ガイド：相場の見方</a>
            {b.label === "ロレックス" && <a href="/guide/rolex-reference-numbers/" className="btn btn-sm">売却ガイド：ロレックスの型番の読み方</a>}
            <a href="/guide/" className="btn btn-sm">売却ガイド一覧</a>
            <a href="/faq/" className="btn btn-sm">よくある質問</a>
          </div>
        </section>

        <section className="reveal">
          <h2 className="block-title"><IconLink />他のブランド</h2>
          <div className="chip-row">
            {brands()
              .filter((x) => x.slug !== slug)
              .map((x) => (
                <Link key={x.slug} href={`/brand/${x.slug}/`} className="btn btn-sm">
                  {x.label}
                </Link>
              ))}
          </div>
        </section>
      </div>
    </main>
    </>
  );
}
