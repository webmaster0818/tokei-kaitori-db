import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { latestDate, masterRefs, summarize, yen } from "@/lib/prices";
import { publishedBrandOf, publishedFamilies, refsByFamily } from "@/lib/models";
import { loadEditorial } from "@/lib/content";
import { EditorialSection } from "@/components/EditorialSection";
import { Arrow } from "@/components/Icons";
import { breadcrumb, graph, itemList, organization } from "@/lib/jsonld";
import { IconFigures, IconLink, IconTable } from "@/components/Icons";

/*
  モデル別ハブ（/model/daytona/ など）。
  ⚠️ 作った理由: GSC実測（2026-09-21）で流入が型番クエリだけだった。
     「デイトナ 買取相場」のようなモデル名クエリの受け皿がゼロだったため。
  ⚠️ 数値は全て summarize() の実データ。型番ページと同じ値しか出さない。
  ⚠️ 型番が1件しか無い家族はページを作らない（比較にならないページを増やさない）。
*/

// ⚠️ 型番が2件以上の家族＋既に公開しているハブ（data/hub-keep.json・1件以上）。lib/models.ts publishedFamilies()
function families() {
  return publishedFamilies();
}

export function generateStaticParams() {
  return families().map((f) => ({ slug: f.slug }));
}

type Row = { ref: string; model: string; max: number | null; min: number | null; spread: number | null; shops: number };

function rows(slug: string): Row[] {
  const master = masterRefs();
  const refs = refsByFamily()[slug] ?? [];
  return refs
    .map((ref) => {
      const s = summarize(ref);
      return {
        ref,
        model: s?.models[0] ?? master[ref]?.models?.[0] ?? "",
        max: s?.ceilingMax ?? null,
        min: s?.ceilingMin ?? null,
        spread: s?.spread ?? null,
        shops: s?.shops.length ?? 0,
      };
    })
    .sort((a, b) => (b.max ?? 0) - (a.max ?? 0));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = families().find((x) => x.slug === slug);
  if (!f) return { title: "ページが見つかりません" };
  const r = rows(slug);
  const top = r[0];
  const widest = r.reduce<Row | null>((a, b) => (!a || (b.spread ?? 0) > (a.spread ?? 0) ? b : a), null);
  const d = latestDate();
  // ⚠️ label を公式表記に改めた家族（例: デイトナ→コスモグラフ デイトナ）も、既存ページの title / description は変えない（seoLabel）
  const name = f.seoLabel ?? f.label;
  return {
    title: `${f.brand} ${name}の買取相場｜${r.length}型番を買取店で比較【${d.slice(0, 7).replace("-", "年")}月】`,
    description:
      `${f.brand} ${name}の買取価格を型番ごとに比較しています。${d}時点で上限額が最も高いのは、${top?.ref ?? ""}の${top?.max ? yen(top.max) : "—"}です。` +
      (widest?.spread ? `同じ型番でも、買取店により最大${yen(widest.spread)}の差があります。` : "") +
      `各社の公開情報を、出典とあわせて掲載しています。`,
    alternates: { canonical: `${SITE_URL}/model/${slug}/` },
  };
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = families().find((x) => x.slug === slug);
  if (!f) notFound();
  const r = rows(slug);
  const date = latestDate();
  const top = r[0];
  const widest = r.reduce<Row | null>((a, b) => (!a || (b.spread ?? 0) > (a.spread ?? 0) ? b : a), null);
  // 同じブランドの他モデル（兄弟ハブ）を先に、それ以外を「他のブランドのモデル」として分ける
  const siblings = families().filter((x) => x.slug !== slug && x.brand === f.brand);
  const others = families().filter((x) => x.slug !== slug && x.brand !== f.brand);
  const brandHub = publishedBrandOf(f.brand);
  const editorial = loadEditorial("models", slug);
  const siblingStats = siblings.map((sb) => {
    const rr = rows(sb.slug);
    return { ...sb, count: rr.length, max: rr[0]?.max ?? null };
  });

  const ld = graph(
    {
      "@type": "Dataset",
      name: `${f.brand} ${f.label} の買取価格比較データ`,
      description: `${f.brand} ${f.label}の${r.length}型番について、買取店が公開している買取価格を収集・比較したデータ（${date}時点）。`,
      creator: { "@id": `${SITE_URL}/#organization` },
      dateModified: date,
      url: `${SITE_URL}/model/${slug}/`,
    },
    organization,
    breadcrumb([{ name: "ホーム", path: "/" }, { name: f.label }]),
    // 画面の型番表に出ている行と同じ（URLは小文字。大文字だとCloudflareで404）
    itemList(`${f.brand} ${f.label}の型番`, r.map((x) => ({ name: x.ref, path: `/ref/${x.ref.toLowerCase()}/` }))),
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
              <span className="here">{f.label}</span>
            </nav>
            <h1 className="page-title">
              {f.brand} {f.label}の買取相場
            </h1>
            <p className="page-meta">
              {date} 時点 / {r.length}型番を比較
            </p>
          </div>
        </div>

        <div className="wrap-narrow page-body">
          {/* 結論を先に出す。数値はすべて型番ページと同じ実データ */}
          <section className="reveal">
            <h2 className="block-title"><IconFigures />買取価格の概要</h2>
            <div className="panel px-6 py-5 md:px-8 md:py-7">
              <ul className="plain-list summary-list">
                {top?.max && (
                  <li>
                    上限額が最も高いのは、<a className="underline decoration-[var(--silver-2)] underline-offset-2" href={`/ref/${top.ref.toLowerCase()}/`}>{top.ref}</a>
                    （{top.model}）の<strong>{yen(top.max)}</strong>です。
                  </li>
                )}
                {widest?.spread ? (
                  <li>
                    同じ型番でも、買取店により価格に差があります。差額が最も大きいのは
                    <a className="underline decoration-[var(--silver-2)] underline-offset-2" href={`/ref/${widest.ref.toLowerCase()}/`}>{widest.ref}</a>で、
                    <strong>{yen(widest.spread)}</strong>の差があります。
                  </li>
                ) : null}
                <li>売却の際は、複数社の買取価格を比較されることをおすすめします。</li>
              </ul>
            </div>
          </section>

          <section className="reveal">
            <h2 className="block-title"><IconTable />型番ごとの買取価格（{date} 時点）</h2>
            <div className="table-frame">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>型番</th>
                    <th>モデル</th>
                    <th className="r">上限額（最高）</th>
                    <th className="r">店舗間の差額</th>
                    <th className="r">比較社数</th>
                  </tr>
                </thead>
                <tbody>
                  {r.map((x) => (
                    <tr key={x.ref}>
                      <td className="whitespace-nowrap">
                        <a href={`/ref/${x.ref.toLowerCase()}/`}>{x.ref}</a>
                      </td>
                      <td>{x.model}</td>
                      <td className="r strong">{x.max ? yen(x.max) : "—"}</td>
                      <td className="r">{x.spread ? yen(x.spread) : "—"}</td>
                      <td className="r">{x.shops}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-scroll-hint">表は横にスクロールしてご覧いただけます。</p>
            <p className="note mt-4">
              ※ 各社が公開している買取価格を {date} に取得して掲載しています。「店舗間の差額」は、
              その型番における最も高い提示額と最も低い提示額の差です。実際の査定額は、個体の状態・付属品・時期により変動します。
            </p>
          </section>

          <EditorialSection data={editorial} heading={editorial?.title ? undefined : `${f.label}について`} />

          {siblingStats.length > 0 && (
            <section className="reveal">
              <h2 className="block-title"><IconLink />{f.brand}の他のモデル</h2>
              <div className="link-grid">
                {siblingStats.map((o) => (
                  <Link key={o.slug} href={`/model/${o.slug}/`} className="link-card">
                    <span className="link-card__label">{o.label}</span>
                    <span className="link-card__meta">
                      <span className="num">{o.count}型番{o.max ? ` / 最高${yen(o.max)}` : ""}</span>
                      <Arrow className="link-card__arrow" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="reveal">
            <h2 className="block-title"><IconLink />関連ページ</h2>
            <div className="chip-row">
              {brandHub && <Link href={`/brand/${brandHub.slug}/`} className="btn btn-sm">{brandHub.label}の買取相場</Link>}
              <a href="/ranking/" className="btn btn-sm">買取価格ランキング</a>
              <a href="/guide/how-to-read-prices/" className="btn btn-sm">売却ガイド：相場の見方</a>
              {f.brand === "ロレックス" && <a href="/guide/rolex-reference-numbers/" className="btn btn-sm">売却ガイド：ロレックスの型番の読み方</a>}
              <a href="/guide/" className="btn btn-sm">売却ガイド一覧</a>
              <a href="/faq/" className="btn btn-sm">よくある質問</a>
            </div>
          </section>

          {others.length > 0 && (
            <section className="reveal">
              <h2 className="block-title"><IconLink />他のブランドのモデル</h2>
              <div className="chip-row">
                {others.map((o) => (
                  <Link key={o.slug} href={`/model/${o.slug}/`} className="btn btn-sm">
                    {o.label}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
